// Sends approval-request emails to all admins in the requester's org.
// Triggered when a user submits a leave application or a regularization request.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const FROM = "In-Sync HR <noreply@in-sync.co.in>";
const APPROVAL_PAGE = "https://globalcrm.in-sync.co.in/hr-approvals";

// Org-scoped extra recipients: always cc this address for HR requests from In-Sync Demo
const EXTRA_RECIPIENTS_BY_ORG: Record<string, string[]> = {
  "61f7f96d-e80c-4d9b-a765-8eb32bd3c70d": ["a@in-sync.co.in"],
};

const LEAVE_LABELS: Record<string, string> = {
  sick_leave: "Sick Leave",
  casual_leave: "Casual Leave",
  earned_leave: "Earned Leave",
  unpaid_leave: "Unpaid Leave",
  compensatory_off: "Comp Off",
  maternity_leave: "Maternity Leave",
  paternity_leave: "Paternity Leave",
};

const REG_LABELS: Record<string, string> = {
  forgot_signin: "Forgot Sign In",
  forgot_signout: "Forgot Sign Out",
  time_correction: "Time Correction",
  location_issue: "Location Issue",
  other: "Other",
};

async function sendResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Resend ${r.status}: ${err}`);
  }
  return r.json();
}

function profileName(p: any) {
  if (!p) return "Unknown";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown";
}

function fmtDate(s: string) {
  return new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(s: string | null) {
  return s
    ? new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "N/A";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { request_type, request_id } = body as {
      request_type: "leave" | "regularization";
      request_id: string;
    };

    if (!request_type || !request_id) {
      return new Response(JSON.stringify({ error: "request_type and request_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Fetch the request
    const table = request_type === "leave" ? "leave_applications" : "attendance_regularizations";
    const { data: request, error: reqErr } = await admin
      .from(table)
      .select("*")
      .eq("id", request_id)
      .single();
    if (reqErr || !request) throw new Error(reqErr?.message || "Request not found");

    // 2. Fetch requester profile
    const { data: requester } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", request.user_id)
      .single();

    // 3. Find admin emails in the same org
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role")
      .eq("org_id", request.org_id)
      .in("role", ["admin", "super_admin"]);

    const adminIds = [...new Set((roles || []).map((r: any) => r.user_id))];
    let adminProfiles: any[] = [];
    if (adminIds.length) {
      const { data } = await admin
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", adminIds);
      adminProfiles = data || [];
    }

    const emailSet = new Set<string>();
    adminProfiles.forEach((p: any) => { if (p.email) emailSet.add(p.email.toLowerCase()); });
    (EXTRA_RECIPIENTS_BY_ORG[request.org_id] || []).forEach((e) => emailSet.add(e.toLowerCase()));

    if (!emailSet.size) {
      console.warn("No recipients for org", request.org_id);
      return new Response(JSON.stringify({ sent: 0, message: "No recipients" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const recipients = Array.from(emailSet).map((email) => ({ email }));

    // 4. Build email body
    const requesterName = profileName(requester);
    let subject = "";
    let body_html = "";

    if (request_type === "leave") {
      subject = `Leave request from ${requesterName}`;
      body_html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a9181;">New Leave Request</h2>
          <p><strong>${requesterName}</strong> has applied for leave:</p>
          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding:6px 0;color:#666;">Type</td><td style="padding:6px 0;">${LEAVE_LABELS[request.leave_type] || request.leave_type}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">From</td><td style="padding:6px 0;">${fmtDate(request.start_date)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">To</td><td style="padding:6px 0;">${fmtDate(request.end_date)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Total days</td><td style="padding:6px 0;">${request.total_days}</td></tr>
            <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Reason</td><td style="padding:6px 0;">${(request.reason || "").replace(/</g, "&lt;")}</td></tr>
          </table>
          <p>
            <a href="${APPROVAL_PAGE}" style="display:inline-block;padding:10px 20px;background:#1a9181;color:#fff;border-radius:6px;text-decoration:none;">Review &amp; Approve</a>
          </p>
        </div>
      `;
    } else {
      subject = `Attendance regularization request from ${requesterName}`;
      body_html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a9181;">Attendance Regularization Request</h2>
          <p><strong>${requesterName}</strong> requested a correction:</p>
          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding:6px 0;color:#666;">For date</td><td style="padding:6px 0;">${fmtDate(request.attendance_date)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Type</td><td style="padding:6px 0;">${REG_LABELS[request.regularization_type] || request.regularization_type}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Original</td><td style="padding:6px 0;">In: ${fmtTime(request.original_sign_in_time)} · Out: ${fmtTime(request.original_sign_out_time)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Requested</td><td style="padding:6px 0;">In: ${fmtTime(request.requested_sign_in_time)} · Out: ${fmtTime(request.requested_sign_out_time)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Reason</td><td style="padding:6px 0;">${(request.reason || "").replace(/</g, "&lt;")}</td></tr>
          </table>
          <p>
            <a href="${APPROVAL_PAGE}" style="display:inline-block;padding:10px 20px;background:#1a9181;color:#fff;border-radius:6px;text-decoration:none;">Review &amp; Approve</a>
          </p>
        </div>
      `;
    }

    // 5. Send to each admin (best-effort)
    let sent = 0;
    const errors: string[] = [];
    for (const p of recipients) {
      try {
        await sendResend(p.email, subject, body_html);
        sent++;
      } catch (e: any) {
        console.error("send fail:", p.email, e.message);
        errors.push(`${p.email}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ sent, total: recipients.length, errors }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
