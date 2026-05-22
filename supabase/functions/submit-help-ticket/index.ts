import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov"];
const MAX_IMAGES = 6;
const MAX_VIDEOS = 2;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10 MB

function getFileType(filename: string): "image" | "video" | "unknown" {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  return "unknown";
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  };
  return mimeMap[ext] || "application/octet-stream";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, subject, description, source, company_name, category, attachments } = await req.json();

    // Validate required fields
    if (!name || !email || !subject || !description || !source) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, subject, description, source" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce length limits
    if (subject.length > 200 || description.length > 5000 || name.length > 100) {
      return new Response(
        JSON.stringify({ error: "Input exceeds maximum length" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate attachments if provided
    let validatedAttachments: { name: string; data: string; type: "image" | "video"; size: number }[] = [];
    if (attachments && Array.isArray(attachments)) {
      let imageCount = 0;
      let videoCount = 0;

      for (const att of attachments) {
        if (!att.name || !att.data) continue;
        const fileType = getFileType(att.name);
        if (fileType === "unknown") {
          return new Response(
            JSON.stringify({ error: `Unsupported file type: ${att.name}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Decode base64 to check size
        const binaryData = Uint8Array.from(atob(att.data), (c) => c.charCodeAt(0));
        const fileSize = binaryData.length;

        if (fileType === "image") {
          imageCount++;
          if (imageCount > MAX_IMAGES) {
            return new Response(
              JSON.stringify({ error: `Maximum ${MAX_IMAGES} images allowed` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (fileSize > MAX_IMAGE_SIZE) {
            return new Response(
              JSON.stringify({ error: `Image ${att.name} exceeds 5 MB limit` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          videoCount++;
          if (videoCount > MAX_VIDEOS) {
            return new Response(
              JSON.stringify({ error: `Maximum ${MAX_VIDEOS} videos allowed` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (fileSize > MAX_VIDEO_SIZE) {
            return new Response(
              JSON.stringify({ error: `Video ${att.name} exceeds 10 MB limit` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        validatedAttachments.push({ name: att.name, data: att.data, type: fileType, size: fileSize });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use the main org (ECR TIPL)
    const mainOrgId = "65e22e43-f23d-4c0a-9d84-2eba65ad0e12";

    // Get a system user for created_by
    const { data: systemUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("org_id", mainOrgId)
      .limit(1)
      .single();

    if (!systemUser) {
      return new Response(
        JSON.stringify({ error: "System configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        org_id: mainOrgId,
        created_by: systemUser.id,
        subject: subject.trim(),
        description: description.trim(),
        category: category || "general",
        priority: "medium",
        contact_name: name.trim(),
        contact_email: email.trim(),
        contact_phone: phone?.trim() || null,
        company_name: company_name?.trim() || null,
        source: source.trim(),
        ticket_number: "TEMP",
      })
      .select("ticket_number, id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create ticket" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload attachments to storage
    const uploadedAttachments: { name: string; url: string; type: string; size: number }[] = [];
    if (validatedAttachments.length > 0) {
      for (const att of validatedAttachments) {
        const binaryData = Uint8Array.from(atob(att.data), (c) => c.charCodeAt(0));
        const filePath = `${mainOrgId}/${ticket.id}/${Date.now()}_${att.name}`;
        const mimeType = getMimeType(att.name);

        const { error: uploadError } = await supabase.storage
          .from("ticket-attachments")
          .upload(filePath, binaryData, { contentType: mimeType, upsert: false });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("ticket-attachments")
          .getPublicUrl(filePath);

        uploadedAttachments.push({
          name: att.name,
          url: urlData.publicUrl,
          type: att.type,
          size: att.size,
        });
      }

      // Update ticket with attachments
      if (uploadedAttachments.length > 0) {
        await supabase
          .from("support_tickets")
          .update({ attachments: uploadedAttachments })
          .eq("id", ticket.id);
      }
    }

    // Send confirmation email directly via Resend API (no JWT needed)
    try {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        console.error("[submit-help-ticket] RESEND_API_KEY not configured, skipping email");
      } else {
        // Fetch org email settings to get verified sending domain
        const { data: emailSettings } = await supabase
          .from("email_settings")
          .select("sending_domain, verification_status, is_active")
          .eq("org_id", mainOrgId)
          .eq("is_active", true)
          .maybeSingle();

        const fromEmail = emailSettings?.sending_domain && emailSettings.verification_status === "verified"
          ? `noreply@${emailSettings.sending_domain}`
          : "noreply@in-sync.app";

        const emailSubject = `Your Support Ticket ${ticket.ticket_number} Has Been Received`;
        const emailHtml = `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#333;">
            <p style="font-size:15px;">Dear ${name.trim()},</p>
            <p style="font-size:15px;">Thank you for reaching out to <strong>In-Sync</strong>.</p>
            <p style="font-size:15px;">Your support ticket <strong>${ticket.ticket_number}</strong> regarding <strong>${subject}</strong> has been successfully created. Our team will get back to you shortly.</p>
            <p style="font-size:15px;">This is an automated email and replies to this address are not monitored.</p>
            <p style="font-size:15px;margin-top:24px;">Best regards,<br/><strong>Team In-Sync</strong></p>
          </div>
        `;

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `In-Sync Support <${fromEmail}>`,
            to: [email.trim()],
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (resendResponse.ok) {
          console.log("[submit-help-ticket] Confirmation email sent successfully");
          // Mark ticket as notified
          await supabase
            .from("support_tickets")
            .update({ client_notified: true, client_notified_at: new Date().toISOString() })
            .eq("id", ticket.id);

          // Log notification for audit trail
          await supabase.from("support_ticket_notifications").insert({
            ticket_id: ticket.id,
            org_id: mainOrgId,
            channel: "email",
            recipient: email.trim(),
            subject: emailSubject,
            message_preview: `Ticket ${ticket.ticket_number} received confirmation`,
            status: "sent",
          });
        } else {
          const resendError = await resendResponse.text();
          console.error("[submit-help-ticket] Resend API error:", resendResponse.status, resendError);
          // Log failed notification
          await supabase.from("support_ticket_notifications").insert({
            ticket_id: ticket.id,
            org_id: mainOrgId,
            channel: "email",
            recipient: email.trim(),
            subject: emailSubject,
            status: "failed",
            error_message: resendError,
          });
        }
      }
    } catch (emailErr) {
      console.error("[submit-help-ticket] Email notification error:", emailErr);
      // best-effort — don't fail ticket creation
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket_number: ticket.ticket_number,
        message: "Your ticket has been submitted successfully!" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
