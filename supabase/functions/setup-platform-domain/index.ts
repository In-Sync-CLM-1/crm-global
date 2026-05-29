// Platform sending-domain setup (admin/ops, service-role only).
// Uses the server-side RESEND_API_KEY to register / inspect / verify a sending
// domain in Resend WITHOUT coupling it to any org's email_settings (unlike
// manage-resend-domain, which is per-org). Used to stand up the shared
// notifications@globalcrm.in-sync.co.in sender.
//
// POST { domain, action }  where action ∈ "ensure" | "get" | "verify"
//   ensure : find the domain in Resend, create it if missing; return id+status+records
//   get    : return current status + DNS records
//   verify : trigger Resend verification; return status
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND = "https://api.resend.com";

async function resend(path: string, key: string, init?: RequestInit) {
  const r = await fetch(`${RESEND}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* raw */ }
  return { ok: r.ok, status: r.status, json, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) throw new Error("RESEND_API_KEY not configured");

    const { domain, action = "ensure" } = await req.json();
    if (!domain) throw new Error("domain is required");

    // Find existing domain by name.
    const list = await resend("/domains", key);
    if (!list.ok) throw new Error(`list domains failed: ${list.text}`);
    const domains = list.json?.data || list.json || [];
    let found = (Array.isArray(domains) ? domains : []).find((d: any) => d.name === domain);

    if (action === "ensure" && !found) {
      const created = await resend("/domains", key, {
        method: "POST",
        body: JSON.stringify({ name: domain, region: "us-east-1" }),
      });
      if (!created.ok) throw new Error(`create domain failed: ${created.text}`);
      found = created.json;
    }

    if (!found) {
      return json(404, { error: `domain ${domain} not found in Resend`, action });
    }

    if (action === "verify") {
      const v = await resend(`/domains/${found.id}/verify`, key, { method: "POST" });
      if (!v.ok) throw new Error(`verify failed: ${v.text}`);
    }

    // Always return the current detail (incl. DNS records) after the action.
    const detail = await resend(`/domains/${found.id}`, key);
    return json(200, {
      id: found.id,
      name: found.name ?? domain,
      status: detail.json?.status ?? found.status,
      records: detail.json?.records ?? found.records ?? [],
    });
  } catch (e: any) {
    return json(400, { error: String(e?.message || e) });
  }
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
