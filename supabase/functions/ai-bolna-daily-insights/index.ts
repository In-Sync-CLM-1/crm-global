import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOLNA_CALLER_ID = "+911169323462";

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

  // For-date (defaults to today IST, can override via body)
  let forDate: string | null = null;
  try {
    const body = req.method === "POST" ? await req.json() : {};
    if (typeof body.for_date === "string") forDate = body.for_date;
  } catch { /* default */ }

  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 3600 * 1000);
  if (!forDate) forDate = istNow.toISOString().slice(0, 10);

  const [y, m, d] = forDate.split("-").map(Number);
  const startUTC = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 3600 * 1000).toISOString();
  const endUTC = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 5.5 * 3600 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("call_logs")
    .select("org_id, status, conversation_duration, extracted_data, transcript")
    .eq("from_number", BOLNA_CALLER_ID)
    .gte("created_at", startUTC)
    .lte("created_at", endUTC);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const total = rows?.length || 0;
  const completed = (rows || []).filter((r: any) => r.status === "completed");

  if (completed.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "No completed calls to analyze", date: forDate, total }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Group by outcome
  const groups: Record<string, any[]> = {};
  for (const r of completed) {
    const o = (r.extracted_data as any)?.General?.outcome?.objective || "unknown";
    if (!groups[o]) groups[o] = [];
    groups[o].push({
      dur: r.conversation_duration || 0,
      notes: (r.extracted_data as any)?.General?.notes?.subjective || "",
      transcript: ((r.transcript as string) || "").slice(0, 1200),
    });
  }

  let promptText = `You are analyzing today's outbound AI sales calls made by Riya, an AI agent pitching WorkSync (a task-accountability product for Indian operations heads). Distill what was learned today.

Return ONLY a JSON object with this exact shape (no markdown fences, no commentary):
{
  "wins": [ { "title": "short label, max 6 words", "detail": "one concrete sentence with a name or quote" } ],
  "losses": [ { "title": "short label", "detail": "one concrete sentence" } ],
  "objections": [ { "label": "short phrase", "count": <number>, "issue": "one-sentence interpretation" } ],
  "tweaks": [ { "title": "verb-led action, max 6 words", "change": "concrete one-line change to the script or behavior" } ]
}

Max 4 items per array. Be specific (cite Bolna's extraction or transcript snippets). No filler.

`;
  for (const [outcome, arr] of Object.entries(groups)) {
    promptText += `===== Outcome: ${outcome} (${arr.length} calls) =====\n`;
    for (const c of arr.slice(0, 15)) {
      promptText += `[dur ${c.dur}s] ${c.notes}\n`;
      if (c.transcript) promptText += `Transcript: ${c.transcript}\n`;
      promptText += `---\n`;
    }
  }

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
      messages: [{ role: "user", content: promptText }],
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return new Response(JSON.stringify({ ok: false, error: "Anthropic error: " + err.slice(0, 500) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const anthropicJson = await anthropicRes.json();
  const text = anthropicJson.content?.[0]?.text || "{}";

  let insights: any = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    insights = JSON.parse(match ? match[0] : text);
  } catch (_e) {
    return new Response(JSON.stringify({ ok: false, error: "Failed to parse model output as JSON", raw: text.slice(0, 800) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const orgId = (rows?.[0] as any)?.org_id;
  if (!orgId) {
    return new Response(JSON.stringify({ ok: false, error: "Could not determine org_id" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { error: uerr } = await supabase
    .from("ai_daily_insights")
    .upsert({
      org_id: orgId,
      for_date: forDate,
      call_count: total,
      completed_count: completed.length,
      insights,
      generated_at: new Date().toISOString(),
    }, { onConflict: "org_id,for_date" });

  if (uerr) {
    return new Response(JSON.stringify({ ok: false, error: uerr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({
    ok: true,
    date: forDate,
    total,
    completed: completed.length,
    insights,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
