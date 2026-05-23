// Transliterates English names to Devanagari (Hindi script) for use by the Bolna
// voice agent. Returns one Devanagari string per input — never errors a whole batch
// because of one bad row; falls back to the original English on failure.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  names: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json(500, { error: "OPENAI_API_KEY missing" });

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const names = Array.isArray(body?.names) ? body.names : [];
  if (names.length === 0) return json(200, { names_hi: [] });
  if (names.length > 500) return json(400, { error: "Max 500 names per call" });

  // OpenAI structured prompt: deterministic mapping from English → Devanagari.
  // We send the whole batch at once so the model can keep a consistent style
  // (e.g. matra choices). gpt-4o-mini is plenty for this.
  const prompt = [
    "You are transliterating Indian personal names from English (Latin script) to Hindi (Devanagari script).",
    "Rules:",
    "1. Output ONLY the Devanagari version, preserving the order of the input.",
    "2. Do NOT translate. \"Vibhu Dixit\" → \"विभु दीक्षित\" (not \"Mr Vibhu\" or any English word).",
    "3. Keep first-name + last-name as separate words separated by a single space.",
    "4. Use the standard north-Indian pronunciation. For ambiguous names, use the most common Hindi-belt spelling.",
    "5. If a name is already in Devanagari, return it unchanged.",
    "6. Return strict JSON: {\"names\": [\"...\", \"...\"]} with the same array length as the input.",
    "",
    "Input names:",
    ...names.map((n, i) => `${i + 1}. ${n}`),
  ].join("\n");

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a precise Hindi transliteration engine." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("openai error:", r.status, text);
      return json(200, { names_hi: names.slice() });
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { names?: string[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("openai returned non-JSON:", content);
      return json(200, { names_hi: names.slice() });
    }

    const out = Array.isArray(parsed.names) ? parsed.names : [];
    // Align lengths defensively — fall back to English for any missing index.
    const aligned: string[] = names.map((src, i) => {
      const v = out[i];
      return typeof v === "string" && v.trim() ? v.trim() : src;
    });

    return json(200, { names_hi: aligned });
  } catch (e) {
    console.error("transliterate exception:", String(e));
    return json(200, { names_hi: names.slice() });
  }
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
