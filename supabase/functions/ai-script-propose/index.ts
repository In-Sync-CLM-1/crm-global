import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

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
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return new Response(JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Optional override: orgId, for_date
  let orgIdInput: string | null = null;
  let forDate: string | null = null;
  try {
    const body = req.method === "POST" ? await req.json() : {};
    if (typeof body.org_id === "string") orgIdInput = body.org_id;
    if (typeof body.for_date === "string") forDate = body.for_date;
  } catch { /* default */ }

  // 1) Latest insights row (today by default)
  let insightsQuery = supabase
    .from("ai_daily_insights")
    .select("org_id, for_date, insights, completed_count")
    .order("for_date", { ascending: false })
    .limit(1);
  if (forDate) insightsQuery = supabase.from("ai_daily_insights").select("org_id, for_date, insights, completed_count").eq("for_date", forDate).limit(1);
  const { data: insightRow, error: insErr } = await insightsQuery.maybeSingle();
  if (insErr || !insightRow) {
    return new Response(JSON.stringify({ ok: false, error: "No daily insights available to propose from" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const orgId = orgIdInput ?? insightRow.org_id;
  const basedOnDate = insightRow.for_date;
  const tweaks = (insightRow.insights as any)?.tweaks || [];
  const wins = (insightRow.insights as any)?.wins || [];
  const losses = (insightRow.insights as any)?.losses || [];

  // 2) Current active script
  const { data: script, error: scriptErr } = await supabase
    .from("ai_call_scripts")
    .select("id, opening, objective, key_points, closing, objection_handling, behavioral_guidelines, product_name, language")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (scriptErr || !script) {
    return new Response(JSON.stringify({ ok: false, error: "No active script for org" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const objHandlingObj = (script as any).objection_handling && typeof (script as any).objection_handling === "object"
    ? (script as any).objection_handling as Record<string, string>
    : {};
  const objHandlingLines = Object.entries(objHandlingObj).map(([k, v]) => `  • ${k} → ${v}`).join("\n") || "  (none)";

  // 3) Build prompt — ask for full new version + rationale
  const prompt = `You are editing a sales-call playbook used by an AI voice agent. The playbook has three layers:
1) Script content — what to say (opening, objective, key points, closing)
2) Objection handling — keyed rebuttals: "if prospect raises X, respond with Y"
3) Behavioral guidelines — how to conduct the call (timing, tone, exit rules, what NOT to do). NOT the words to say.

CURRENT PLAYBOOK (active):
- Opening line: ${script.opening || "(none)"}
- Objective: ${script.objective || "(none)"}
- Key points:
${(Array.isArray(script.key_points) ? script.key_points : []).map((p: string) => `  • ${p}`).join("\n") || "  (none)"}
- Closing: ${script.closing || "(none)"}
- Objection handling:
${objHandlingLines}
- Behavioral guidelines:
${(script as any).behavioral_guidelines || "(none)"}

TODAY'S CALL-ANALYSIS FINDINGS (based on ${insightRow.completed_count} completed calls on ${basedOnDate}):

What worked:
${wins.map((w: any, i: number) => `${i + 1}. ${w.title} — ${w.detail}`).join("\n") || "(none)"}

What leaked:
${losses.map((l: any, i: number) => `${i + 1}. ${l.title} — ${l.detail}`).join("\n") || "(none)"}

Suggested tweaks (in priority order):
${tweaks.map((t: any, i: number) => `${i + 1}. ${t.title}: ${t.change}`).join("\n") || "(none)"}

TASK: Produce an updated playbook that integrates the tweaks while preserving what's working. Decide for each tweak which layer it belongs to:
- Wording changes → opening / key_points / closing
- "If they say X, say Y" → objection_handling
- "When situation X, do Y" / call-flow rules / exit conditions / timing → behavioral_guidelines

Be concrete. No placeholders. Keep the same product intent.

Return ONLY this JSON (no markdown, no commentary):
{
  "proposed": {
    "opening": "<rewritten opening, single spoken sentence>",
    "objective": "<rewritten objective, one short sentence>",
    "key_points": ["<3 to 6 bullets>"],
    "closing": "<rewritten closing>",
    "objection_handling": { "<objection_key>": "<one-line response>", "...": "..." },
    "behavioral_guidelines": "<plain-text, one rule per line, max 8 lines>"
  },
  "rationale": "<2-3 plain-English lines explaining what you changed and which layer each change went to>"
}`;

  // 4) Call Claude
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return new Response(JSON.stringify({ ok: false, error: `Anthropic error: ${err.slice(0, 500)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const anthropicJson = await anthropicRes.json();
  const text = anthropicJson.content?.[0]?.text || "{}";
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Could not parse model output as JSON", raw: text.slice(0, 800) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const proposed = parsed.proposed || {};
  const rationale: string = parsed.rationale || "";

  // 5) Supersede any earlier pending proposal for this script
  await supabase
    .from("ai_script_proposals")
    .update({ status: "superseded" })
    .eq("script_id", script.id)
    .eq("status", "pending");

  // 6) Upsert today's proposal
  const { data: row, error: upErr } = await supabase
    .from("ai_script_proposals")
    .upsert({
      org_id: orgId,
      script_id: script.id,
      based_on_date: basedOnDate,
      proposed_opening: proposed.opening || null,
      proposed_objective: proposed.objective || null,
      proposed_key_points: Array.isArray(proposed.key_points) ? proposed.key_points : null,
      proposed_closing: proposed.closing || null,
      proposed_objection_handling: proposed.objection_handling && typeof proposed.objection_handling === "object" ? proposed.objection_handling : null,
      proposed_behavioral_guidelines: typeof proposed.behavioral_guidelines === "string" ? proposed.behavioral_guidelines : null,
      rationale,
      status: "pending",
      generated_at: new Date().toISOString(),
    }, { onConflict: "script_id,based_on_date" })
    .select()
    .maybeSingle();

  if (upErr) {
    return new Response(JSON.stringify({ ok: false, error: upErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({
    ok: true,
    proposal_id: row?.id,
    based_on_date: basedOnDate,
    rationale,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
