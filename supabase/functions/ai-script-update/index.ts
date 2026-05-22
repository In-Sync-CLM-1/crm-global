import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { composeSystemPrompt, bolnaHeaders, BOLNA } from "../_shared/aiCalling.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  let scriptId: string | undefined;
  try {
    const body = await req.json();
    scriptId = body.script_id;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!scriptId) {
    return new Response(JSON.stringify({ ok: false, error: "script_id required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: script, error } = await supabase
    .from("ai_call_scripts")
    .select("*")
    .eq("id", scriptId)
    .maybeSingle();
  if (error || !script) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Script not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!(script as any).bolna_agent_id) {
    return new Response(JSON.stringify({ ok: false, error: "Script has no bolna_agent_id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const systemPrompt = composeSystemPrompt(script as any);
  const welcomeMessage = (script as any).opening || "Hello, do you have a moment to talk?";

  const res = await fetch(`${BOLNA}/v2/agent/${(script as any).bolna_agent_id}`, {
    method: "PATCH",
    headers: bolnaHeaders(bolnaKey),
    body: JSON.stringify({
      agent_config: { agent_welcome_message: welcomeMessage },
      agent_prompts: { task_1: { system_prompt: systemPrompt } },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({ ok: false, error: `Bolna PATCH failed: ${res.status} ${text.slice(0, 500)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({
    ok: true,
    agent_id: (script as any).bolna_agent_id,
    prompt_length: systemPrompt.length,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
