import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Recipients for the alert (configurable later if needed)
const ALERT_WA_NUMBER = "+917738919680"; // E.164 with +
const ALERT_EMAIL = "a@in-sync.co.in";
// Template chain — try the best one first, fall through to the next on failure.
// "crm_demo_alert" has a per-contact deep-link button (dynamic URL).
// "crm_demo_alert_v2" has a static "Open CRM" button to the dashboard.
// "crm_activity_reminder" is body-only and is the original approved template.
const TEMPLATE_CHAIN = ["crm_demo_alert", "crm_demo_alert_v2", "crm_activity_reminder"] as const;
const CRM_BASE_URL = "https://globalcrm.in-sync.co.in";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let callLogId: string | undefined;
  try {
    const body = await req.json();
    callLogId = body.call_log_id;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!callLogId) {
    return new Response(JSON.stringify({ ok: false, error: "call_log_id required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Load the call log + contact info
  const { data: call, error } = await supabase
    .from("call_logs")
    .select("id, org_id, contact_id, to_number, extracted_data, created_at, contacts:contact_id(first_name, last_name, company)")
    .eq("id", callLogId)
    .maybeSingle();
  if (error || !call) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Call log not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const outcome = (call.extracted_data as any)?.General?.outcome?.objective;
  if (outcome !== "demo_agreed") {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: `outcome is ${outcome}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const demoDt = (call.extracted_data as any)?.General?.demo_datetime?.subjective || "(time not captured)";
  const notesRaw = (call.extracted_data as any)?.General?.notes?.subjective || "";
  const prospectName = (call as any).contacts
    ? `${(call as any).contacts.first_name || ""} ${(call as any).contacts.last_name || ""}`.trim()
    : "(prospect)";
  const company = (call as any).contacts?.company || "";
  const prospectLabel = company ? `${prospectName} · ${company}` : prospectName;

  const results: Record<string, any> = {};

  // 1) WhatsApp alert via Exotel templated message
  try {
    const { data: exotel } = await supabase
      .from("exotel_settings")
      .select("api_key, api_token, subdomain, account_sid, whatsapp_api_key, whatsapp_api_token, whatsapp_subdomain, whatsapp_account_sid, whatsapp_source_number, waba_id")
      .eq("is_active", true)
      .eq("whatsapp_enabled", true)
      .limit(1)
      .maybeSingle();
    if (!exotel) throw new Error("No active Exotel WhatsApp settings");

    const waKey = (exotel as any).whatsapp_api_key || (exotel as any).api_key;
    const waToken = (exotel as any).whatsapp_api_token || (exotel as any).api_token;
    const waSub = (exotel as any).whatsapp_subdomain || (exotel as any).subdomain;
    const waSid = (exotel as any).whatsapp_account_sid || (exotel as any).account_sid;
    const fromNum = (exotel as any).whatsapp_source_number;

    const buildPayload = (templateName: string) => {
      const bodyParams = [
        { type: "text", text: "Amit" },
        { type: "text", text: `Demo with ${prospectLabel}` },
        { type: "text", text: demoDt },
      ];
      const components: any[] = [{ type: "body", parameters: bodyParams }];
      // Only the dynamic-URL template needs a button parameter; the static one
      // and the body-only fallback don't.
      if (templateName === "crm_demo_alert" && call.contact_id) {
        components.push({
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [{ type: "text", text: call.contact_id }],
        });
      }
      return {
        whatsapp: {
          messages: [{
            from: fromNum,
            to: ALERT_WA_NUMBER,
            content: {
              type: "template",
              template: {
                name: templateName,
                language: { code: "en" },
                components,
              },
            },
          }],
        },
      };
    };

    const trySend = async (templateName: string) => {
      const res = await fetch(
        `https://${waKey}:${waToken}@${waSub}/v2/accounts/${waSid}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(templateName)),
        },
      );
      const text = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* keep raw */ }
      const mr = parsed?.response?.whatsapp?.messages?.[0];
      const ok = res.ok && (mr?.code === 200 || mr?.code === 202 || mr?.status === "success");
      return { ok, status: res.status, message_id: mr?.data?.id || null, raw: text };
    };

    let waOutcome: Awaited<ReturnType<typeof trySend>> | null = null;
    let templateUsed: string | null = null;
    const attempts: Array<{ template: string; ok: boolean; status: number }> = [];
    for (const name of TEMPLATE_CHAIN) {
      const r = await trySend(name);
      attempts.push({ template: name, ok: r.ok, status: r.status });
      if (r.ok) {
        waOutcome = r;
        templateUsed = name;
        break;
      }
    }
    results.whatsapp = waOutcome?.ok
      ? { ok: true, template: templateUsed, status: waOutcome.status, message_id: waOutcome.message_id, attempts }
      : { ok: false, attempts };
  } catch (e) {
    results.whatsapp = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // 2) Email via Resend
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY missing");
    const subject = `New demo agreed — ${prospectLabel} · ${demoDt}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#111;line-height:1.5">
        <h2 style="margin:0 0 12px;font-size:18px;">📅 Demo agreed with ${prospectLabel}</h2>
        <p><b>Slot:</b> ${demoDt}</p>
        <p><b>Source call:</b> Riya AI · ${new Date(call.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
        ${notesRaw ? `<p><b>Notes from the call:</b><br>${notesRaw}</p>` : ""}
        <p style="margin-top:24px;">
          <a href="https://globalcrm.in-sync.co.in/contacts/${call.contact_id || ""}"
             style="display:inline-block;padding:10px 16px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;">
             Open contact
          </a>
        </p>
        <p style="margin-top:24px;font-size:12px;color:#666;">
          Triggered automatically when Bolna marked the call outcome as <code>demo_agreed</code>. Confirm the slot with the prospect before sending an invite.
        </p>
      </div>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Riya AI <noreply@in-sync.co.in>",
        to: [ALERT_EMAIL],
        subject,
        html,
      }),
    });
    const t = await r.text();
    results.email = { ok: r.ok, status: r.status, body: t.slice(0, 300) };
  } catch (e) {
    results.email = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // 3) In-app notification — insert one row per platform admin in this org
  try {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, org_id, is_platform_admin, email")
      .or(`is_platform_admin.eq.true,email.eq.${ALERT_EMAIL}`);
    const recipients = (admins || []).map((p: any) => p.id);
    if (recipients.length === 0) {
      results.in_app = { ok: true, skipped: true, reason: "no admin recipients found" };
    } else {
      const rows = recipients.map((uid: string) => ({
        org_id: call.org_id,
        user_id: uid,
        type: "demo_agreed",
        title: `📅 Demo agreed: ${prospectLabel}`,
        message: `Slot: ${demoDt}. Confirm before sending invite.`,
        entity_type: "contact",
        entity_id: call.contact_id,
        action_url: `/contacts/${call.contact_id || ""}`,
        metadata: { call_log_id: call.id, demo_datetime: demoDt, notes: notesRaw },
      }));
      const { error: nerr } = await supabase.from("notifications").insert(rows);
      results.in_app = nerr ? { ok: false, error: nerr.message } : { ok: true, recipients: recipients.length };
    }
  } catch (e) {
    results.in_app = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return new Response(JSON.stringify({ ok: true, call_log_id: callLogId, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
