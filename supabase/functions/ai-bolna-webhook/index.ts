import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import {
  isInsideWorkingWindow,
  triggerBolnaCall,
} from "../_shared/aiCalling.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TERMINAL_STATUSES = new Set([
  "completed", "failed", "no-answer", "busy", "canceled",
  "stopped", "balance-low", "error", "call-disconnected",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid json" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const status = (payload.status as string) || "unknown";
  const executionId = (payload.execution_id as string) || (payload.id as string) || null;
  const telephony = (payload.telephony_data as Record<string, unknown>) || {};
  const contextDetails = (payload.context_details as Record<string, unknown>) || {};
  const callLogIdFromContext = contextDetails?.call_log_id as string | undefined;

  if (!executionId) {
    return new Response(JSON.stringify({ ok: true, warning: "missing execution_id" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Find the call_logs row — first by execution_id, then by call_log_id from context_details
  let callLog: any = null;
  {
    const { data } = await supabase
      .from("call_logs")
      .select("id, batch_id_proxy:bolna_batch_id, queue_position:bolna_queue_position, status, org_id, contact_id, started_at")
      .eq("bolna_execution_id", executionId)
      .maybeSingle();
    callLog = data;
  }
  if (!callLog && callLogIdFromContext) {
    const { data } = await supabase
      .from("call_logs")
      .select("id, batch_id_proxy:bolna_batch_id, queue_position:bolna_queue_position, status, org_id, contact_id, started_at")
      .eq("id", callLogIdFromContext)
      .maybeSingle();
    callLog = data;
    if (callLog) {
      await supabase
        .from("call_logs")
        .update({ bolna_execution_id: executionId })
        .eq("id", callLog.id);
    }
  }

  if (!callLog) {
    return new Response(JSON.stringify({ ok: true, warning: "unknown execution" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const isTerminal = TERMINAL_STATUSES.has(status);
  const durationSec = telephony.duration != null ? Number(telephony.duration) : null;
  const recordingUrl = (telephony.recording_url as string) || null;
  const providerCallSid = (telephony.provider_call_id as string) || null;
  const hangupReason = (telephony.hangup_reason as string) || null;
  const transcript = (payload.transcript as string) || null;

  // Decide a normalized status to write into call_logs.
  // Mirror Bolna's raw outcome so the dashboard matches Bolna's own definitions.
  let normalizedStatus = status;
  if (status === "in-progress" || status === "ringing" || status === "initiated") {
    normalizedStatus = "in_progress";
  } else if (status === "call-disconnected") {
    normalizedStatus = "completed";
  }

  const update: Record<string, unknown> = { status: normalizedStatus };
  if (durationSec != null) {
    update.call_duration = durationSec;
    update.conversation_duration = durationSec;
  }
  if (recordingUrl) update.recording_url = recordingUrl;
  if (providerCallSid) update.exotel_call_sid = providerCallSid;
  if (isTerminal) update.ended_at = new Date().toISOString();
  if (!callLog.started_at && (status === "in-progress" || status === "initiated")) {
    update.started_at = new Date().toISOString();
  }
  if (transcript && isTerminal) {
    update.transcript = transcript;
    update.transcript_status = "ok";
    update.transcribed_at = new Date().toISOString();
  }

  await supabase.from("call_logs").update(update).eq("id", callLog.id);

  if (!isTerminal) {
    return new Response(JSON.stringify({ ok: true, status, terminal: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Dispatch the next queued call in the same batch — but only inside working window
  const window = isInsideWorkingWindow();
  if (!window.inside) {
    return new Response(JSON.stringify({ ok: true, terminal: true, dispatched_next: false, reason: window.reason }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const batchId = (callLog as any).batch_id_proxy as string | null;
  if (!batchId) {
    return new Response(JSON.stringify({ ok: true, terminal: true, dispatched_next: false, reason: "no batch id" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  await dispatchNextInBatch(supabase, batchId);

  return new Response(JSON.stringify({ ok: true, terminal: true, dispatched_next: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

async function dispatchNextInBatch(supabase: any, batchId: string): Promise<void> {
  const bolnaKey = Deno.env.get("BOLNA_API_KEY");
  if (!bolnaKey) return;

  const { data: nextRow } = await supabase
    .from("call_logs")
    .select("id, contact_id, to_number, ai_script_id, ai_call_scripts:ai_script_id(bolna_agent_id)")
    .eq("bolna_batch_id", batchId)
    .eq("caller_type", "ai")
    .eq("status", "queued")
    .order("bolna_queue_position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextRow) return;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title")
    .eq("id", nextRow.contact_id)
    .maybeSingle();

  if (!contact) {
    await supabase.from("call_logs").update({ status: "error" }).eq("id", nextRow.id);
    return;
  }

  const agentId = (nextRow as any).ai_call_scripts?.bolna_agent_id as string | undefined;
  if (!agentId) {
    await supabase.from("call_logs").update({ status: "error" }).eq("id", nextRow.id);
    return;
  }

  const result = await triggerBolnaCall(bolnaKey, {
    agentId,
    toNumber: nextRow.to_number,
    callLogId: nextRow.id,
    contact,
  });

  if (result.error) {
    await supabase.from("call_logs").update({ status: "error" }).eq("id", nextRow.id);
    // Try the next one in the chain
    await dispatchNextInBatch(supabase, batchId);
    return;
  }

  await supabase
    .from("call_logs")
    .update({
      status: "in_progress",
      bolna_execution_id: result.execution_id,
      started_at: new Date().toISOString(),
    })
    .eq("id", nextRow.id);
}
