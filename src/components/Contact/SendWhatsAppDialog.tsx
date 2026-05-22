import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNotification } from "@/hooks/useNotification";
import { Loader2 } from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { format } from "date-fns";
import { updateContactStageToContacted } from "@/utils/pipelineStageUtils";

interface TemplateButton {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
}

interface Template {
  id: string;
  template_name: string;
  content: string;
  // The DB stores this as either a raw array of placeholder strings
  // (e.g. ["{{1}}","{{2}}","{{2}}"]) or an array of objects {index,name}.
  variables: Array<{ index: number | string; name?: string }> | string[] | null;
  field_mappings: { header?: Record<string, string>; body?: Record<string, string> } | null;
  header_type: string | null;
  header_content: string | null;
  footer_text: string | null;
  buttons: TemplateButton[] | null;
}

// Render WhatsApp-style inline formatting: *bold*, _italic_, ~strike~, ```mono```.
function renderWhatsAppFormatted(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split(/\n/);
  const tokenize = (line: string): React.ReactNode[] => {
    // Single regex covering the four marker types.
    const re = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`\n]+```)/g;
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) out.push(line.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("```") && tok.endsWith("```")) {
        out.push(<code key={key++} className="font-mono bg-black/5 px-1 rounded">{tok.slice(3, -3)}</code>);
      } else if (tok.startsWith("*")) {
        out.push(<strong key={key++}>{tok.slice(1, -1)}</strong>);
      } else if (tok.startsWith("_")) {
        out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
      } else if (tok.startsWith("~")) {
        out.push(<span key={key++} className="line-through">{tok.slice(1, -1)}</span>);
      }
      last = m.index + tok.length;
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  };
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {tokenize(line)}
      {i < lines.length - 1 && <br />}
    </React.Fragment>
  ));
}

// Extracts a sorted list of unique placeholder indices (as strings) from the
// raw `variables` JSON, which may be a flat string array or array of objects.
function extractUniqueVariableIndices(variables: Template["variables"]): string[] {
  if (!variables || !Array.isArray(variables)) return [];
  const seen = new Set<string>();
  for (const v of variables) {
    let idx: string | null = null;
    if (typeof v === "string") {
      const m = /\{\{\s*(\w+)\s*\}\}/.exec(v);
      idx = m ? m[1] : null;
    } else if (v && typeof v === "object") {
      const raw = (v as any).index;
      if (raw !== undefined && raw !== null) idx = String(raw);
    }
    if (idx) seen.add(idx);
  }
  return Array.from(seen).sort((a, b) => Number(a) - Number(b));
}

// Friendly label for a field-mapping field name.
function friendlyFieldLabel(fieldName: string): string {
  const map: Record<string, string> = {
    first_name: "Customer first name",
    last_name: "Customer last name",
    full_name: "Customer full name",
    company: "Company",
    email: "Email",
    phone: "Phone",
    assigned_to_name: "Assigned agent",
  };
  return map[fieldName] || fieldName;
}

interface SendWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  phoneNumber: string;
  onMessageSent?: () => void;
  initialTemplateId?: string | null;
}

export function SendWhatsAppDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  phoneNumber,
  onMessageSent,
  initialTemplateId,
}: SendWhatsAppDialogProps) {
  const { effectiveOrgId } = useOrgContext();
  const notify = useNotification();
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [customMessage, setCustomMessage] = useState("");
  const [messageType, setMessageType] = useState<"template" | "custom">("template");
  
  // Scheduling
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  useEffect(() => {
    if (open && effectiveOrgId) {
      fetchTemplates();
    }
  }, [open, effectiveOrgId]);

  // When the dialog opens with an initialTemplateId (e.g. from Resend),
  // pre-select it once templates have loaded.
  useEffect(() => {
    if (
      open &&
      initialTemplateId &&
      templates.length > 0 &&
      selectedTemplateId !== initialTemplateId &&
      templates.some((t) => t.id === initialTemplateId)
    ) {
      setMessageType("template");
      handleTemplateChange(initialTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTemplateId, templates]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("communication_templates")
        .select("id, template_name, content, variables, field_mappings, header_type, header_content, footer_text, buttons")
        .eq("org_id", effectiveOrgId)
        .eq("template_type", "whatsapp")
        .eq("status", "approved")
        .order("template_name");

      if (error) throw error;
      setTemplates((data || []) as Template[]);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      notify.error("Error", new Error("Failed to load templates"));
    }
  };

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      setTemplateVariables({});
      return;
    }

    const indices = extractUniqueVariableIndices(template.variables);
    const vars: Record<string, string> = {};
    indices.forEach((i) => { vars[i] = ""; });

    // Pre-fill values from field_mappings using this contact's data.
    const bodyMappings = template.field_mappings?.body || {};
    const mappedFieldNames = Object.values(bodyMappings);
    if (mappedFieldNames.length > 0) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("first_name, last_name, company, email, phone, assigned_to")
        .eq("id", contactId)
        .maybeSingle();
      let assignedAgentName = "";
      if (contact?.assigned_to && mappedFieldNames.includes("assigned_to_name")) {
        const { data: agent } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", contact.assigned_to)
          .maybeSingle();
        assignedAgentName = agent
          ? `${agent.first_name || ""} ${agent.last_name || ""}`.trim()
          : "";
      }
      for (const [pos, fieldName] of Object.entries(bodyMappings)) {
        if (fieldName === "full_name") {
          vars[pos] = contact
            ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
            : "";
        } else if (fieldName === "assigned_to_name") {
          vars[pos] = assignedAgentName;
        } else if (contact && (contact as any)[fieldName] != null) {
          vars[pos] = String((contact as any)[fieldName]);
        }
      }
    }

    setTemplateVariables(vars);
  };

  const handleSend = async () => {
    if (messageType === "template" && !selectedTemplateId) {
      notify.error("Validation Error", new Error("Please select a template"));
      return;
    }

    if (messageType === "custom" && !customMessage.trim()) {
      notify.error("Validation Error", new Error("Please enter a message"));
      return;
    }

    // Runtime guard against unfilled template variables (also blocks any
    // path where the disabled-button state was bypassed).
    if (messageType === "template") {
      const tpl = templates.find((t) => t.id === selectedTemplateId);
      const requiredIndices = tpl ? extractUniqueVariableIndices(tpl.variables) : [];
      const blank = requiredIndices.find(
        (idx) => !templateVariables[idx] || !String(templateVariables[idx]).trim()
      );
      if (blank) {
        notify.error(
          "Validation Error",
          new Error(`Variable {{${blank}}} is blank. Fill in every template variable before sending.`)
        );
        return;
      }
    }

    if (!sendImmediately && !scheduledAt) {
      notify.error("Validation Error", new Error("Please select a scheduled date and time"));
      return;
    }

    setSending(true);
    try {
      if (sendImmediately) {
        // Send immediately via edge function
        const payload: any = {
          contactId,
          phoneNumber: phoneNumber.replace(/[^\d]/g, ""),
        };

        if (messageType === "template") {
          payload.templateId = selectedTemplateId;
          payload.templateVariables = templateVariables;
        } else {
          payload.message = customMessage;
        }

        const { error } = await supabase.functions.invoke("send-whatsapp-message", {
          body: payload,
        });

        if (error) throw error;

        // Update pipeline stage from New to Contacted
        await updateContactStageToContacted(contactId);

        notify.success("Success", "WhatsApp message sent successfully");
      } else {
        // Create scheduled message record
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const messageContent = messageType === "custom" 
          ? customMessage 
          : templates.find(t => t.id === selectedTemplateId)?.content || "";

        const { error } = await supabase
          .from("whatsapp_messages")
          .insert([{
            org_id: effectiveOrgId,
            contact_id: contactId,
            phone_number: phoneNumber.replace(/[^\d]/g, ""),
            message_content: messageContent,
            template_id: messageType === "template" ? selectedTemplateId : null,
            sent_by: user.id,
            status: "scheduled",
            scheduled_at: scheduledAt?.toISOString(),
          }]);

        if (error) throw error;

        notify.success("Message scheduled", `Message will be sent on ${format(scheduledAt, "PPP 'at' p")}`);
      }

      onOpenChange(false);
      onMessageSent?.();
    } catch (error: any) {
      console.error("Error sending message:", error);
      notify.error("Error", error);
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const indices = selectedTemplate ? extractUniqueVariableIndices(selectedTemplate.variables) : [];
  const bodyMappings = selectedTemplate?.field_mappings?.body || {};
  const substitute = (s: string) =>
    (s || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => {
      const v = templateVariables[k];
      return v && String(v).length > 0 ? String(v) : `{{${k}}}`;
    });
  const renderedBody = selectedTemplate ? substitute(selectedTemplate.content || "") : "";
  const renderedHeader = selectedTemplate && selectedTemplate.header_type === "TEXT"
    ? substitute(selectedTemplate.header_content || "")
    : "";
  const renderedFooter = selectedTemplate?.footer_text || "";
  const allFilled = indices.every((i) => templateVariables[i] && templateVariables[i].length > 0);

  const previewBubble = (
    <div className="bg-[#ECE5DD] p-4 rounded-md border border-[#d6cfc6] h-full min-h-[300px] flex items-start">
      {selectedTemplate ? (
        <div className="bg-white rounded-lg shadow-sm p-3 w-full max-w-[320px] relative text-sm text-[#111B21]">
          {renderedHeader && (
            <div className="font-semibold mb-1">{renderWhatsAppFormatted(renderedHeader)}</div>
          )}
          <div className="whitespace-pre-wrap leading-snug break-words">
            {renderWhatsAppFormatted(renderedBody)}
          </div>
          {renderedFooter && (
            <div className="text-xs text-[#667781] mt-2">{renderedFooter}</div>
          )}
          <div className="text-[10px] text-[#667781] text-right mt-1">12:30 pm</div>

          {Array.isArray(selectedTemplate.buttons) && selectedTemplate.buttons.length > 0 && (
            <div className="-mx-3 mt-2 border-t border-[#E9EDEF]">
              {selectedTemplate.buttons.map((btn, i) => (
                <div
                  key={i}
                  className="text-center text-[#00A5F4] py-2 text-sm font-medium border-b last:border-b-0 border-[#E9EDEF]"
                >
                  {btn.type === "URL" && (
                    <span className="inline-flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      {btn.text}
                    </span>
                  )}
                  {btn.type === "PHONE_NUMBER" && (
                    <span className="inline-flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      {btn.text}
                    </span>
                  )}
                  {btn.type !== "URL" && btn.type !== "PHONE_NUMBER" && (
                    <span>{btn.text}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : messageType === "custom" && customMessage ? (
        <div className="bg-white rounded-lg shadow-sm p-3 w-full max-w-[320px] text-sm text-[#111B21]">
          <div className="whitespace-pre-wrap leading-snug break-words">
            {renderWhatsAppFormatted(customMessage)}
          </div>
          <div className="text-[10px] text-[#667781] text-right mt-1">12:30 pm</div>
        </div>
      ) : (
        <div className="text-sm text-[#667781] m-auto">Pick a template or type a message to see a preview.</div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Send WhatsApp Message</DialogTitle>
          <DialogDescription>
            Send a WhatsApp message to {contactName} ({phoneNumber})
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 py-2 flex-1 overflow-hidden">
          {/* LEFT — controls */}
          <div className="space-y-4 overflow-y-auto px-1 min-w-0">
            <div className="space-y-2">
              <Label>Message Type</Label>
              <Select
                value={messageType}
                onValueChange={(value: "template" | "custom") => setMessageType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Use Template</SelectItem>
                  <SelectItem value="custom">Custom Message</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {messageType === "template" ? (
              <>
                <div className="space-y-2">
                  <Label>Select Template</Label>
                  <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTemplate && indices.length > 0 && (
                  <div className="space-y-3">
                    <Label>Template Variables</Label>
                    {indices.map((idx) => {
                      const mappedField = bodyMappings[idx];
                      const isAutofilled = !!mappedField && !!templateVariables[idx];
                      const label = mappedField
                        ? `${friendlyFieldLabel(mappedField)} — {{${idx}}}`
                        : `Variable {{${idx}}}`;
                      return (
                        <div key={idx} className="space-y-1.5">
                          <Label htmlFor={`var-${idx}`} className="text-sm">
                            {label}
                            {isAutofilled && (
                              <span className="ml-2 text-xs text-muted-foreground">(auto-filled, you can edit)</span>
                            )}
                          </Label>
                          <Input
                            id={`var-${idx}`}
                            value={templateVariables[idx] || ""}
                            onChange={(e) =>
                              setTemplateVariables({
                                ...templateVariables,
                                [idx]: e.target.value,
                              })
                            }
                            placeholder={mappedField ? `Auto: ${friendlyFieldLabel(mappedField)}` : `Enter value for {{${idx}}}`}
                          />
                        </div>
                      );
                    })}
                    {!allFilled && (
                      <p className="text-xs text-amber-600">
                        Fill in all variables — anything still showing <code>{'{{N}}'}</code> in the preview won't send correctly.
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="custom-message">Message</Label>
                <Textarea
                  id="custom-message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Note: Session messages can only be sent within 24 hours of the last customer interaction
                </p>
              </div>
            )}
          </div>

          {/* RIGHT — live preview */}
          <div className="hidden lg:block">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Preview (what the customer will receive)
            </Label>
            {previewBubble}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              sending ||
              (messageType === "template" && !!selectedTemplate && !allFilled) ||
              (messageType === "template" && !selectedTemplateId) ||
              (messageType === "custom" && !customMessage.trim())
            }
            title={
              messageType === "template" && !!selectedTemplate && !allFilled
                ? "Fill in all template variables before sending"
                : undefined
            }
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Message"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}