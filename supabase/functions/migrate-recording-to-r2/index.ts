import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSYNC_DEMO_ORG_ID = "61f7f96d-e80c-4d9b-a765-8eb32bd3c70d";
const BATCH_LIMIT = 50;

interface CallLogRow {
  id: string;
  org_id: string;
  recording_url: string;
  created_at: string;
}

function r2KeyFor(row: CallLogRow): string {
  const created = new Date(row.created_at);
  const yyyy = created.getUTCFullYear();
  const mm = String(created.getUTCMonth() + 1).padStart(2, "0");
  return `${row.org_id}/${yyyy}/${mm}/${row.id}.mp3`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const workerUrl = Deno.env.get("R2_RECORDINGS_WORKER_URL");
  const workerSecret = Deno.env.get("R2_RECORDINGS_SECRET");

  if (!workerUrl || !workerSecret) {
    return new Response(
      JSON.stringify({ error: "R2 worker config missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Pending call logs: have a recording URL but no R2 copy
  const { data: pending, error: pendingErr } = await supabase
    .from("call_logs")
    .select("id, org_id, recording_url, created_at")
    .eq("org_id", INSYNC_DEMO_ORG_ID)
    .not("recording_url", "is", null)
    .neq("recording_url", "")
    .is("r2_key", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (pendingErr) {
    return new Response(
      JSON.stringify({ error: pendingErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!pending || pending.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, message: "Nothing to migrate" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Fetch Exotel creds for the demo org (single lookup)
  const { data: exotelSettings } = await supabase
    .from("exotel_settings")
    .select("api_key, api_token")
    .eq("org_id", INSYNC_DEMO_ORG_ID)
    .maybeSingle();

  if (!exotelSettings) {
    return new Response(
      JSON.stringify({ error: "Exotel settings not found for org" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const exotelAuth = "Basic " + btoa(`${exotelSettings.api_key}:${exotelSettings.api_token}`);

  let uploaded = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const row of pending as CallLogRow[]) {
    try {
      const key = r2KeyFor(row);

      const exotelResp = await fetch(row.recording_url, {
        headers: { Authorization: exotelAuth },
      });

      if (!exotelResp.ok) {
        throw new Error(`Exotel fetch failed: ${exotelResp.status}`);
      }

      const contentType = exotelResp.headers.get("content-type") || "audio/mpeg";
      const audioBuffer = await exotelResp.arrayBuffer();

      const putResp = await fetch(`${workerUrl}/${key}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${workerSecret}`,
          "Content-Type": contentType,
        },
        body: audioBuffer,
      });

      if (!putResp.ok) {
        throw new Error(`R2 PUT failed: ${putResp.status} ${await putResp.text()}`);
      }

      await supabase
        .from("call_logs")
        .update({
          r2_key: key,
          r2_uploaded_at: new Date().toISOString(),
          r2_upload_error: null,
        })
        .eq("id", row.id);

      uploaded += 1;
    } catch (err: any) {
      failed += 1;
      const msg = err?.message || String(err);
      errors.push({ id: row.id, error: msg });
      await supabase
        .from("call_logs")
        .update({ r2_upload_error: msg.slice(0, 500) })
        .eq("id", row.id);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: pending.length,
      uploaded,
      failed,
      errors: errors.slice(0, 10),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
