import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSYNC_DEMO_ORG_ID = "61f7f96d-e80c-4d9b-a765-8eb32bd3c70d";
const BATCH_LIMIT = 10;
const HAIKU_MODEL = "claude-haiku-4-5";
const WHISPER_MODEL = "whisper-large-v3";

const ANALYSIS_SYSTEM_PROMPT = `You are an expert call quality analyst for an Indian B2B SaaS sales team. You review transcripts of outbound prospecting and follow-up calls between Sales Development Representatives (SDRs) and prospects, and you return a structured JSON evaluation of how the call went.

# What the SDR is trying to do
Outbound calls in this team are short (typically 30 seconds to 4 minutes). The SDR's job on each call is to:
1. Confirm they are speaking to the right person at the right company.
2. Briefly introduce the product (a CRM / sales-engagement platform) and the reason for the call.
3. Qualify interest with one or two discovery questions (current tool, team size, pain).
4. Move the conversation forward — usually by booking a demo, scheduling a callback, sending a follow-up email, or politely closing if there is no fit.
5. Behave professionally: greet the prospect, identify themselves and the company, listen without interrupting, never argue, and end the call cleanly.

# How to evaluate each field

## summary
2–3 sentence factual recap of the call. Cover: who was reached, what the prospect's response/state was, and what the SDR committed to as a next step. Do not editorialize. If the call never connected (voicemail, wrong number, immediate hangup), say that plainly.

## agent_tone
One of exactly these values, picked by the SDR's overall delivery across the call:
- "warm" — friendly, conversational, listens, builds rapport
- "professional" — neutral, polite, clear, business-like
- "robotic" — script-bound, monotone, no acknowledgement of what the prospect says
- "aggressive" — interrupts, argues, pressures, refuses to take a polite no
- "uncertain" — hesitant, long pauses, fumbles product or pricing details
- "rushed" — talks too fast, talks over the prospect, doesn't let them finish

When in doubt between two, pick the one that dominated the call.

## script_adherence
Free-text 1–2 sentences. State whether the SDR hit the key script beats (greeting + self-identification → reason for call → discovery question → clear next step) and call out any that were skipped. If there was no script-following because the call never engaged (voicemail, immediate hangup), say so.

## objections
Array of the top objections the prospect raised, in the order they came up. Use short noun phrases — e.g. "Already using competitor X", "Budget frozen until next quarter", "Not the decision maker", "Send email instead". If no objections were raised, return [].

## next_step
One sentence describing what should happen next, derived from what the SDR committed to OR what would be the obvious follow-up if they failed to commit. Examples: "Send pricing PDF and follow up Tuesday", "Book demo with decision-maker on Thursday 3pm", "Retry on direct line — gatekeeper blocked", "Close out — explicit do-not-contact".

## quality_score
Integer 1–10 of the SDR's overall performance on THIS call. Use the rubric:
- 9–10: Excellent. Hit all script beats, handled objections gracefully, secured a concrete and well-qualified next step.
- 7–8: Strong. Mostly on-script with good rapport; minor gaps (missed one discovery question, soft next step).
- 5–6: Average. Got through the basics but lacked rapport, missed obvious follow-ups, or accepted a vague next step.
- 3–4: Weak. Multiple script misses, poor tone, no real qualification, no clear next step.
- 1–2: Bad. Aggressive, unprofessional, hung up on, gave wrong info, or did not actually attempt a sales conversation when they should have.
- For voicemail / wrong-number / disconnected calls where the SDR had no real chance to talk: score 5 (neutral — no useful signal).

# Format and tone
- Respond ONLY with JSON matching the schema. No prose before or after.
- Be concrete and specific — use the prospect's actual words/positions where possible.
- Never invent details that aren't in the transcript. If something can't be determined from the transcript, say so explicitly in the relevant field (e.g. summary: "Brief call with no audible response from prospect; SDR left a voicemail").
- Indian English idioms, Hindi loanwords, and code-switching between English and Hindi are normal — treat them as ordinary speech, not as quality issues.`;

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    agent_tone: {
      type: "string",
      enum: ["warm", "professional", "robotic", "aggressive", "uncertain", "rushed"],
    },
    script_adherence: { type: "string" },
    objections: {
      type: "array",
      items: { type: "string" },
    },
    next_step: { type: "string" },
    quality_score: { type: "integer" },
  },
  required: ["summary", "agent_tone", "script_adherence", "objections", "next_step", "quality_score"],
  additionalProperties: false,
};

interface PendingRow {
  id: string;
  org_id: string;
  r2_key: string;
  conversation_duration: number | null;
  call_duration: number | null;
}

async function transcribeWithGroq(audio: ArrayBuffer, groqKey: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/mpeg" }), "recording.mp3");
  form.append("model", WHISPER_MODEL);
  form.append("language", "en");
  form.append("response_format", "json");
  form.append("temperature", "0");

  const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });
  if (!resp.ok) {
    throw new Error(`Groq transcription failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return (data.text || "").trim();
}

interface AnalysisResult {
  summary: string;
  agent_tone: string;
  script_adherence: string;
  objections: string[];
  next_step: string;
  quality_score: number;
}

async function analyzeWithClaude(
  transcript: string,
  duration: number,
  anthropicKey: string,
): Promise<AnalysisResult> {
  const userMessage = `Analyze the following sales call transcript and return the structured JSON evaluation.

Call duration: ${Math.floor(duration / 60)}m ${duration % 60}s

Transcript:
---
${transcript || "(empty transcript — likely a very short call, voicemail, or no audible speech)"}
---`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: ANALYSIS_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
      output_config: {
        format: {
          type: "json_schema",
          schema: ANALYSIS_SCHEMA,
        },
      },
    }),
  });

  if (!resp.ok) {
    throw new Error(`Anthropic analysis failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  if (!textBlock) {
    throw new Error(`Anthropic returned no text block: ${JSON.stringify(data)}`);
  }
  const parsed = JSON.parse(textBlock.text);
  return parsed as AnalysisResult;
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
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!workerUrl || !workerSecret || !groqKey || !anthropicKey) {
    return new Response(
      JSON.stringify({ error: "Missing required env vars (R2_RECORDINGS_*, GROQ_API_KEY, ANTHROPIC_API_KEY)" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: pending, error: pendingErr } = await supabase
    .from("call_logs")
    .select("id, org_id, r2_key, conversation_duration, call_duration")
    .eq("org_id", INSYNC_DEMO_ORG_ID)
    .not("r2_key", "is", null)
    .is("transcript", null)
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
      JSON.stringify({ ok: true, processed: 0, message: "Nothing to transcribe" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let transcribed = 0;
  let analyzed = 0;
  let failed = 0;
  const errors: Array<{ id: string; stage: string; error: string }> = [];

  for (const row of pending as PendingRow[]) {
    const duration = row.conversation_duration || row.call_duration || 0;

    let transcript = "";
    try {
      const r2Resp = await fetch(`${workerUrl}/${row.r2_key}`, {
        headers: { Authorization: `Bearer ${workerSecret}` },
      });
      if (!r2Resp.ok) {
        throw new Error(`R2 fetch failed: ${r2Resp.status}`);
      }
      const audio = await r2Resp.arrayBuffer();
      transcript = await transcribeWithGroq(audio, groqKey);

      await supabase
        .from("call_logs")
        .update({
          transcript,
          transcript_status: "ok",
          transcript_error: null,
          transcribed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      transcribed += 1;
    } catch (err: any) {
      failed += 1;
      const msg = err?.message || String(err);
      errors.push({ id: row.id, stage: "transcribe", error: msg });
      await supabase
        .from("call_logs")
        .update({
          transcript_status: "failed",
          transcript_error: msg.slice(0, 500),
        })
        .eq("id", row.id);
      continue;
    }

    try {
      const analysis = await analyzeWithClaude(transcript, duration, anthropicKey);
      await supabase
        .from("call_logs")
        .update({
          analysis_summary: analysis.summary,
          analysis_tone: analysis.agent_tone,
          analysis_script_adherence: analysis.script_adherence,
          analysis_objections: analysis.objections,
          analysis_next_step: analysis.next_step,
          analysis_quality_score: analysis.quality_score,
          analysis_status: "ok",
          analysis_error: null,
          analyzed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      analyzed += 1;
    } catch (err: any) {
      const msg = err?.message || String(err);
      errors.push({ id: row.id, stage: "analyze", error: msg });
      await supabase
        .from("call_logs")
        .update({
          analysis_status: "failed",
          analysis_error: msg.slice(0, 500),
        })
        .eq("id", row.id);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: pending.length,
      transcribed,
      analyzed,
      failed,
      errors: errors.slice(0, 10),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
