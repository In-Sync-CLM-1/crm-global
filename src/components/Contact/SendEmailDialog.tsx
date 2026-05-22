import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotification } from "@/hooks/useNotification";
import { useOrgContext } from "@/hooks/useOrgContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { format } from "date-fns";
import { updateContactStageToContacted } from "@/utils/pipelineStageUtils";

interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  html_content: string | null;
  body_content: string | null;
}

const DEMO_TEMPLATE_NAME = "Work-Sync: Demo Confirmation";
const SALES_REP_NAME = "Amit Sengupta";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  onEmailSent?: () => void;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  onEmailSent,
}: SendEmailDialogProps) {
  const notify = useNotification();
  const { effectiveOrgId } = useOrgContext();
  const [loading, setLoading] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bodyIsHtml, setBodyIsHtml] = useState(false);
  const [userInfo, setUserInfo] = useState<{ firstName: string; lastName: string; email: string; phone: string } | null>(null);

  // Template picker
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
  const [demoDate, setDemoDate] = useState<string>("");
  const [demoTime, setDemoTime] = useState<string>("");

  // Scheduling
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates-picker", effectiveOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, subject, html_content, body_content")
        .eq("org_id", effectiveOrgId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as TemplateOption[];
    },
    enabled: !!effectiveOrgId && open,
  });

  useEffect(() => {
    if (open) {
      fetchPrimaryEmail();
      fetchUserInfo();
    }
  }, [open, contactId]);

  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserInfo({
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          email: user.email || "",
          phone: profile.phone || "",
        });
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const fetchPrimaryEmail = async () => {
    try {
      const { data, error } = await supabase
        .from("contact_emails")
        .select("email")
        .eq("contact_id", contactId)
        .eq("is_primary", true)
        .maybeSingle();

      if (error) throw error;

      if (data?.email) {
        setRecipientEmail(data.email);
      } else {
        // Fallback to legacy email field
        const { data: contact } = await supabase
          .from("contacts")
          .select("email")
          .eq("id", contactId)
          .single();

        if (contact?.email) {
          setRecipientEmail(contact.email);
        }
      }
    } catch (error: any) {
      console.error("Error fetching email:", error);
    }
  };

  const formatDemoDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };
  const formatDemoDay = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "long" });
  };
  const formatDemoTime = (t: string) => {
    if (!t) return "";
    const parts = t.split(":");
    let h = parseInt(parts[0] || "0", 10);
    const m = parts[1] || "00";
    const period = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${period}`;
  };

  const applyMergeFields = (text: string, prospectFirst: string, prospectLast: string) => {
    if (!text) return "";
    const prospectName = `${prospectFirst} ${prospectLast}`.trim() || "there";
    const callerName = userInfo ? `${userInfo.firstName} ${userInfo.lastName}`.trim() : "";
    return text
      .replace(/{{prospect_name}}/g, prospectName)
      .replace(/{{full_name}}/g, prospectName)
      .replace(/{{first_name}}/g, prospectFirst)
      .replace(/{{last_name}}/g, prospectLast)
      .replace(/{{prospect_email}}/g, recipientEmail)
      .replace(/{{email}}/g, recipientEmail)
      .replace(/{{caller_name}}/g, callerName)
      .replace(/{{caller_email}}/g, userInfo?.email || "")
      .replace(/{{caller_phone}}/g, userInfo?.phone || "")
      .replace(/{{sales_rep_name}}/g, SALES_REP_NAME)
      .replace(/{{demo_date}}/g, formatDemoDate(demoDate))
      .replace(/{{demo_day}}/g, formatDemoDay(demoDate))
      .replace(/{{demo_time}}/g, formatDemoTime(demoTime));
  };

  const handleTemplateChange = async (id: string) => {
    setSelectedTemplateId(id);
    if (!id) {
      setSelectedTemplateName("");
      setSubject("");
      setBody("");
      setBodyIsHtml(false);
      return;
    }
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setSelectedTemplateName(tpl.name);

    // Fetch prospect name for merge fields
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", contactId)
      .single();
    const first = contact?.first_name || "";
    const last = contact?.last_name || "";

    const html = tpl.html_content || tpl.body_content || "";
    const isHtml = /<[a-z][\s\S]*>/i.test(html);
    setBody(applyMergeFields(html, first, last));
    setBodyIsHtml(isHtml);
    setSubject(applyMergeFields(tpl.subject, first, last));
  };

  useEffect(() => {
    if (!selectedTemplateId) return;
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    (async () => {
      const { data: contact } = await supabase
        .from("contacts")
        .select("first_name, last_name")
        .eq("id", contactId)
        .single();
      const first = contact?.first_name || "";
      const last = contact?.last_name || "";
      const html = tpl.html_content || tpl.body_content || "";
      setBody(applyMergeFields(html, first, last));
      setSubject(applyMergeFields(tpl.subject, first, last));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoDate, demoTime]);

  const handleSend = async () => {
    if (!recipientEmail || !subject || !body) {
      notify.error("Missing fields", new Error("Please fill in all fields before sending."));
      return;
    }

    if (!sendImmediately && !scheduledAt) {
      notify.error("Missing schedule", new Error("Please select a scheduled date and time."));
      return;
    }

    if (selectedTemplateName === DEMO_TEMPLATE_NAME && (!demoDate || !demoTime)) {
      notify.error("Demo details required", new Error("Please pick the demo date and time before sending."));
      return;
    }

    setLoading(true);

    try {
      const htmlPayload = bodyIsHtml ? body : body.replace(/\n/g, '<br>');

      if (sendImmediately) {
        // Send immediately via edge function
        const { data, error } = await supabase.functions.invoke("send-email", {
          body: {
            to: recipientEmail,
            subject: subject,
            htmlContent: htmlPayload,
            contactId: contactId,
          },
        });

        if (error) throw error;

        // Update pipeline stage from New to Contacted
        await updateContactStageToContacted(contactId);

        notify.success("Email sent", `Email sent successfully to ${contactName}`);
      } else {
        // Create scheduled email record
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .single();

        if (!profile) throw new Error("Profile not found");

        const conversationId = crypto.randomUUID();
        
        const { error } = await supabase
          .from("email_conversations")
          .insert([{
            org_id: profile.org_id,
            conversation_id: conversationId,
            contact_id: contactId,
            from_email: userInfo?.email || user.email || "",
            from_name: `${userInfo?.firstName} ${userInfo?.lastName}`,
            to_email: recipientEmail,
            subject: subject,
            email_content: htmlPayload,
            html_content: htmlPayload,
            direction: "outbound",
            status: "scheduled",
            scheduled_at: scheduledAt?.toISOString(),
            sent_by: user.id,
          }]);

        if (error) throw error;

        notify.success("Email scheduled", `Email will be sent on ${format(scheduledAt, "PPP 'at' p")}`);

      }

      // Reset form
      setSubject("");
      setBody("");
      setBodyIsHtml(false);
      setSelectedTemplateId("");
      setSelectedTemplateName("");
      setDemoDate("");
      setDemoTime("");
      setSendImmediately(true);
      setScheduledAt(null);

      onEmailSent?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      notify.error("Failed to send email", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Email to {contactName}</DialogTitle>
          <DialogDescription>
            Compose and send an email message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
              type="email"
            />
            {userInfo && (
              <p className="text-sm text-muted-foreground">
                Sending as: {userInfo.firstName} {userInfo.lastName} (replies will go to {userInfo.email})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Pick a template (optional)</Label>
            <Select value={selectedTemplateId || "none"} onValueChange={(v) => handleTemplateChange(v === "none" ? "" : v)}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Compose from scratch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Compose from scratch</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplateName === DEMO_TEMPLATE_NAME && (
            <div className="rounded-md border border-teal-200 bg-teal-50/40 p-4 space-y-3">
              <div className="text-sm font-medium text-teal-700">
                Demo details (these will appear in the confirmation email)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dlg-demo-date">Demo Date *</Label>
                  <input
                    id="dlg-demo-date"
                    type="date"
                    value={demoDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setDemoDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dlg-demo-time">Demo Time *</Label>
                  <input
                    id="dlg-demo-time"
                    type="time"
                    value={demoTime}
                    onChange={(e) => setDemoTime(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Product Specialist will be <strong>{SALES_REP_NAME}</strong>.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message {bodyIsHtml && <span className="text-xs text-muted-foreground">(HTML preview will render in the email)</span>}</Label>
            {bodyIsHtml ? (
              <>
                <div className="rounded-md border bg-white p-3 max-h-72 overflow-auto" dangerouslySetInnerHTML={{ __html: body }} />
                <p className="text-xs text-muted-foreground">To edit the HTML directly, switch templates or compose from scratch.</p>
              </>
            ) : (
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message here..."
                rows={8}
              />
            )}
          </div>

          <div className="space-y-4 border-t pt-4">
            <Label>Sending Schedule</Label>
            <RadioGroup value={sendImmediately ? "now" : "scheduled"} onValueChange={(v) => setSendImmediately(v === "now")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="now" id="send-email-now" />
                <Label htmlFor="send-email-now" className="cursor-pointer font-normal">Send immediately</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scheduled" id="send-email-scheduled" />
                <Label htmlFor="send-email-scheduled" className="cursor-pointer font-normal">Schedule for later</Label>
              </div>
            </RadioGroup>
            
            {!sendImmediately && (
              <DateTimePicker
                value={scheduledAt}
                onChange={setScheduledAt}
                minDate={new Date()}
                label="Select date and time"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sendImmediately ? 'Send Email' : 'Schedule Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}