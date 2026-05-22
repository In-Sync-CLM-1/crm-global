import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOLNA_BASE = "https://api.bolna.ai";
const TERMINAL_STATUSES = new Set([
  "completed", "failed", "no-answer", "busy", "canceled",
  "stopped", "balance-low", "error", "call-disconnected",
]);

// Re-fetch any Bolna call we have not yet seen reach "completed" — caught webhook-drop
// stragglers and updates to call_logs to mirror Bolna's own view.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const bolnaKey = Deno.env.get("BOLNA_API_KEY");
  if (!bolnaKey) {
    return new Response(JSON.stringify({ ok: false, error: "BOLNA_API_KEY missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let lookbackHours = 24;
  let maxRows = 200;
  try {
    const body = req.method === "POST" ? await req.json() : {};
    if (typeof body.lookback_hours === "number") lookbackHours = body.lookback_hours;
    if (typeof body.max_rows === "number") maxRows = body.max_rows;
  } catch { /* defaults */ }

  const cutoff = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();

  // Rows worth re-checking: have a Bolna execution id, created in window, not yet completed.
  const { data: rows, error } = await supabase
    .from("call_logs")
    .select("id, bolna_execution_id, status, call_duration")
    .not("bolna_execution_id", "is", null)
    .gte("created_at", cutoff)
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(maxRows);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let updated = 0;
  let unchanged = 0;
  let errors = 0;
  const changes: Array<Record<string, unknown>> = [];

  for (const row of rows ?? []) {
    try {
      const res = await fetch(`${BOLNA_BASE}/executions/${row.bolna_execution_id}`, {
        headers: { "Authorization": `Bearer ${bolnaKey}` },
      });
      if (!res.ok) { errors++; continue; }
      const exec = await res.json();

      const rawStatus = (exec.status as string) || "unknown";
      const telephony = (exec.telephony_data as Record<string, unknown>) || {};
      const telDur = telephony.duration != null ? Number(telephony.duration) : null;
      const convDur = exec.conversation_duration != null ? Number(exec.conversation_duration) : null;
      const dur = telDur ?? convDur;
      const recordingUrl = (telephony.recording_url as string) || null;
      const providerCallSid = (telephony.provider_call_id as string) || null;
      const transcript = (exec.transcript as string) || null;

      // Mirror the webhook's normalization rules (raw Bolna outcome — no threshold reclass).
      let normalizedStatus = rawStatus;
      if (rawStatus === "in-progress" || rawStatus === "ringing" || rawStatus === "initiated") {
        normalizedStatus = "in_progress";
      } else if (rawStatus === "call-disconnected") {
        normalizedStatus = "completed";
      }

      const isTerminal = TERMINAL_STATUSES.has(rawStatus);

      // Skip if Bolna's still in flight and we already have an in_progress row.
      if (normalizedStatus === row.status && (dur == null || (row.call_duration || 0) >= dur)) {
        unchanged++;
        continue;
      }

      const update: Record<string, unknown> = { status: normalizedStatus };
      if (dur != null) {
        update.call_duration = dur;
        update.conversation_duration = dur;
      }
      if (recordingUrl) update.recording_url = recordingUrl;
      if (providerCallSid) update.exotel_call_sid = providerCallSid;
      if (isTerminal) update.ended_at = new Date().toISOString();
      if (transcript && isTerminal) {
        update.transcript = transcript;
        update.transcribed_at = new Date().toISOString();
      }

      const { error: uerr } = await supabase
        .from("call_logs")
        .update(update)
        .eq("id", row.id);
      if (uerr) { errors++; continue; }
      updated++;
      changes.push({ id: row.id, from: row.status, to: normalizedStatus, dur });
    } catch (_e) {
      errors++;
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    scanned: rows?.length || 0,
    updated, unchanged, errors,
    lookback_hours: lookbackHours,
    changes: changes.slice(0, 20),
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
