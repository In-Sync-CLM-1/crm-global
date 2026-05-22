import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Phone, PhoneOff, SkipForward, Loader2, CheckCircle2, XCircle, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";

interface BulkCallContact {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  primaryPhone?: string | null;
  company?: string | null;
}

interface Disposition {
  id: string;
  name: string;
  category: string;
}

interface SubDisposition {
  id: string;
  name: string;
  disposition_id: string;
}

type CallState =
  | { kind: "idle" }
  | { kind: "dialing"; contactId: string }
  | { kind: "live"; contactId: string; sessionId: string; exotelCallSid: string; startedAt: number }
  | { kind: "disposition"; contactId: string; callLogId: string; duration: number }
  | { kind: "paused"; nextIndex: number }
  | { kind: "done" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: BulkCallContact[];
  onComplete?: (calledCount: number) => void;
}

export function BulkCallDialog({ open, onOpenChange, contacts, onComplete }: Props) {
  const notify = useNotification();
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<CallState>({ kind: "idle" });
  const [completed, setCompleted] = useState<Record<string, "called" | "skipped" | "failed">>({});
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [subDispositions, setSubDispositions] = useState<SubDisposition[]>([]);
  const [selectedDisp, setSelectedDisp] = useState("");
  const [selectedSubDisp, setSelectedSubDisp] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const validContacts = contacts.filter((c) => c.primaryPhone || c.phone);
  const skippedNoPhoneCount = contacts.length - validContacts.length;
  const totalCalls = validContacts.length;
  const current = validContacts[index];
  const progressPct = totalCalls === 0 ? 100 : Math.min(100, (index / totalCalls) * 100);

  // Load dispositions once
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile) return;
      const [{ data: d }, { data: sd }] = await Promise.all([
        supabase.from("call_dispositions").select("*").eq("org_id", profile.org_id).eq("is_active", true).order("name"),
        supabase.from("call_sub_dispositions").select("*").eq("org_id", profile.org_id).eq("is_active", true).order("name"),
      ]);
      setDispositions(d || []);
      setSubDispositions(sd || []);
    })();
  }, [open]);

  // Subscribe to call session updates while live
  useEffect(() => {
    if (state.kind !== "live") return;
    const sessionId = state.sessionId;
    const channel = supabase
      .channel(`bulk-call-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_call_sessions", filter: `id=eq.${sessionId}` },
        async (payload) => {
          const status = (payload.new as any)?.status;
          if (status === "ended") {
            const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
            const { data: cl } = await supabase
              .from("call_logs")
              .select("id")
              .eq("exotel_call_sid", state.exotelCallSid)
              .maybeSingle();
            setDuration(elapsed);
            setState({
              kind: "disposition",
              contactId: state.contactId,
              callLogId: cl?.id || "",
              duration: elapsed,
            });
          }
        }
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [state]);

  // Tick duration during live call (for display only — real elapsed used on end)
  useEffect(() => {
    if (state.kind !== "live") return;
    const startedAt = state.startedAt;
    const id = setInterval(() => {
      setDuration(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  // Reset when dialog opens fresh
  useEffect(() => {
    if (open) {
      setIndex(0);
      setState({ kind: "idle" });
      setCompleted({});
      setSelectedDisp("");
      setSelectedSubDisp("");
      setNotes("");
      setDuration(0);
    }
  }, [open]);

  const startCall = async () => {
    if (!current) {
      setState({ kind: "done" });
      return;
    }
    const phoneToCall = current.primaryPhone || current.phone;
    if (!phoneToCall) {
      setCompleted((p) => ({ ...p, [current.id]: "skipped" }));
      moveNext();
      return;
    }

    setState({ kind: "dialing", contactId: current.id });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.phone) {
        notify.error("Set your phone number first", "Add your phone in profile before calling.");
        setState({ kind: "paused", nextIndex: index });
        return;
      }
      const { data, error } = await supabase.functions.invoke("exotel-make-call", {
        body: {
          contactId: current.id,
          agentPhoneNumber: profile.phone,
          customerPhoneNumber: phoneToCall,
        },
      });
      if (error) throw error;
      setState({
        kind: "live",
        contactId: current.id,
        sessionId: data?.callLog?.id || "",
        exotelCallSid: data?.exotelCallSid || "",
        startedAt: Date.now(),
      });
    } catch (e: any) {
      notify.error("Call failed", e?.message || String(e));
      setCompleted((p) => ({ ...p, [current.id]: "failed" }));
      moveNext();
    }
  };

  const endCall = async () => {
    if (state.kind !== "live") return;
    try {
      await supabase
        .from("agent_call_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", state.sessionId);
    } catch (e: any) {
      notify.error("Failed to end call", e?.message);
    }
  };

  const saveDispositionAndNext = async () => {
    if (state.kind !== "disposition") return;
    if (!selectedDisp) {
      notify.error("Select a disposition", "Pick a call outcome before moving on.");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (state.callLogId) {
        await supabase
          .from("call_logs")
          .update({
            disposition_id: selectedDisp,
            sub_disposition_id: selectedSubDisp || null,
            notes,
          })
          .eq("id", state.callLogId);

        const { data: callLog } = await supabase
          .from("call_logs")
          .select("activity_id, org_id")
          .eq("id", state.callLogId)
          .maybeSingle();
        if (callLog?.activity_id) {
          await supabase
            .from("contact_activities")
            .update({
              call_disposition_id: selectedDisp,
              call_sub_disposition_id: selectedSubDisp || null,
              description: notes ? `${notes}\n\nDuration: ${fmtDuration(state.duration)}` : `Duration: ${fmtDuration(state.duration)}`,
              completed_at: new Date().toISOString(),
            })
            .eq("id", callLog.activity_id);
        } else if (callLog?.org_id) {
          const { data: newActivity } = await supabase
            .from("contact_activities")
            .insert({
              org_id: callLog.org_id,
              contact_id: state.contactId,
              activity_type: "call",
              subject: "Phone Call",
              description: notes ? `${notes}\n\nDuration: ${fmtDuration(state.duration)}` : `Duration: ${fmtDuration(state.duration)}`,
              call_disposition_id: selectedDisp,
              call_sub_disposition_id: selectedSubDisp || null,
              call_duration: state.duration,
              created_by: user.id,
              completed_at: new Date().toISOString(),
            })
            .select()
            .maybeSingle();
          if (newActivity) {
            await supabase
              .from("call_logs")
              .update({ activity_id: newActivity.id })
              .eq("id", state.callLogId);
          }
        }
      }
      setCompleted((p) => ({ ...p, [state.contactId]: "called" }));
      setSelectedDisp("");
      setSelectedSubDisp("");
      setNotes("");
      setDuration(0);
      moveNext();
    } catch (e: any) {
      notify.error("Failed to save disposition", e?.message);
    }
  };

  const moveNext = () => {
    const next = index + 1;
    if (next >= totalCalls) {
      setState({ kind: "done" });
      return;
    }
    setIndex(next);
    setState({ kind: "idle" });
  };

  const skipCurrent = () => {
    if (!current) return;
    setCompleted((p) => ({ ...p, [current.id]: "skipped" }));
    setState({ kind: "idle" });
    moveNext();
  };

  const pauseQueue = () => {
    if (state.kind === "live") {
      notify.info("End current call first", "Hang up before pausing the queue.");
      return;
    }
    setState({ kind: "paused", nextIndex: index });
  };

  const resumeQueue = () => {
    if (state.kind !== "paused") return;
    setIndex(state.nextIndex);
    setState({ kind: "idle" });
  };

  const closeAndFinish = () => {
    const calledCount = Object.values(completed).filter((v) => v === "called").length;
    onComplete?.(calledCount);
    onOpenChange(false);
  };

  const filteredSubDisps = subDispositions.filter((sd) => sd.disposition_id === selectedDisp);

  const isLive = state.kind === "live" || state.kind === "dialing";
  const isDispositionStep = state.kind === "disposition";
  const isDone = state.kind === "done";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Prevent accidental close while a call is in progress
        if (!o && isLive) {
          notify.info("Call in progress", "End the current call first.");
          return;
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" /> Bulk Call Queue
          </DialogTitle>
          <DialogDescription>
            {totalCalls} contact{totalCalls === 1 ? "" : "s"} to call
            {skippedNoPhoneCount > 0 && (
              <span className="ml-1 text-amber-600">
                ({skippedNoPhoneCount} skipped — no phone)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>
                {isDone ? totalCalls : index + (isLive || isDispositionStep ? 1 : 0)} of {totalCalls}
              </span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>

          {/* Current call panel */}
          {isDone ? (
            <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <p className="font-semibold">Queue complete</p>
              <p className="text-sm text-muted-foreground">
                {Object.values(completed).filter((v) => v === "called").length} called ·{" "}
                {Object.values(completed).filter((v) => v === "skipped").length} skipped ·{" "}
                {Object.values(completed).filter((v) => v === "failed").length} failed
              </p>
            </div>
          ) : state.kind === "paused" ? (
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-4 text-center space-y-2">
              <Pause className="h-10 w-10 text-amber-600 mx-auto" />
              <p className="font-semibold">Queue paused</p>
              <p className="text-sm text-muted-foreground">Press Resume to continue with the next contact.</p>
            </div>
          ) : current ? (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-lg">
                    {current.first_name} {current.last_name || ""}
                  </div>
                  {current.company && <div className="text-sm text-muted-foreground">{current.company}</div>}
                  <div className="text-sm font-mono mt-1">{current.primaryPhone || current.phone}</div>
                </div>
                <Badge variant="outline">
                  {state.kind === "idle" && "Up next"}
                  {state.kind === "dialing" && (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Dialing
                    </span>
                  )}
                  {state.kind === "live" && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-emerald-600" /> Live · {fmtDuration(duration)}
                    </span>
                  )}
                  {state.kind === "disposition" && "Log outcome"}
                </Badge>
              </div>

              {state.kind === "idle" && (
                <Button onClick={startCall} className="w-full" size="lg">
                  <Phone className="h-4 w-4 mr-2" /> Call now
                </Button>
              )}
              {state.kind === "live" && (
                <Button onClick={endCall} variant="destructive" className="w-full" size="lg">
                  <PhoneOff className="h-4 w-4 mr-2" /> End call
                </Button>
              )}

              {isDispositionStep && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Disposition *</Label>
                    <Select value={selectedDisp} onValueChange={(v) => { setSelectedDisp(v); setSelectedSubDisp(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select call outcome" />
                      </SelectTrigger>
                      <SelectContent>
                        {dispositions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {filteredSubDisps.length > 0 && (
                    <div>
                      <Label className="text-xs">Sub-disposition</Label>
                      <Select value={selectedSubDisp} onValueChange={setSelectedSubDisp}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sub-disposition" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredSubDisps.map((sd) => (
                            <SelectItem key={sd.id} value={sd.id}>{sd.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Quick note about the call" />
                  </div>
                  <Button onClick={saveDispositionAndNext} className="w-full" disabled={!selectedDisp}>
                    Save & Call Next
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {/* Queue preview */}
          <div className="rounded-md border max-h-40 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {validContacts.map((c, i) => {
                  const status = completed[c.id];
                  const isCurrent = i === index && !isDone;
                  return (
                    <tr key={c.id} className={`border-b last:border-b-0 ${isCurrent ? "bg-primary/5" : ""}`}>
                      <td className="px-2 py-1 w-6 text-center text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1">
                        {c.first_name} {c.last_name || ""}
                        {c.company && <span className="text-muted-foreground"> · {c.company}</span>}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {status === "called" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 inline" />}
                        {status === "skipped" && <SkipForward className="h-3.5 w-3.5 text-amber-600 inline" />}
                        {status === "failed" && <XCircle className="h-3.5 w-3.5 text-rose-600 inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isDone && state.kind !== "paused" && state.kind !== "live" && state.kind !== "dialing" && (
            <Button variant="outline" size="sm" onClick={skipCurrent}>
              <SkipForward className="h-4 w-4 mr-1" /> Skip
            </Button>
          )}
          {!isDone && state.kind === "paused" && (
            <Button variant="outline" size="sm" onClick={resumeQueue}>
              <Play className="h-4 w-4 mr-1" /> Resume
            </Button>
          )}
          {!isDone && state.kind !== "paused" && state.kind !== "live" && state.kind !== "dialing" && state.kind !== "disposition" && (
            <Button variant="outline" size="sm" onClick={pauseQueue}>
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
          )}
          <Button onClick={closeAndFinish} variant={isDone ? "default" : "ghost"}>
            {isDone ? "Done" : "Close queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
