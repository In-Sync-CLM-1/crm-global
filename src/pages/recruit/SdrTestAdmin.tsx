import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QUESTIONS, SECTIONS, TOTAL_MARKS } from "@/data/sdrQuestions";
import type { SectionId } from "@/data/sdrQuestions";
import { ChevronLeft, Save, RefreshCw, ExternalLink, Copy } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import { useOrgContext } from "@/hooks/useOrgContext";

interface AttemptRow {
  id: string;
  org_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  years_experience: number | null;
  started_at: string;
  submitted_at: string | null;
  time_taken_seconds: number | null;
  tab_switch_count: number | null;
  auto_score: number | null;
  final_score: number | null;
  verdict: string | null;
  evaluator_notes: string | null;
}

interface ResponseRow {
  id: string;
  attempt_id: string;
  question_id: string;
  response_text: string | null;
  auto_score: number | null;
  manual_score: number | null;
  flagged_for_review: boolean | null;
}

function verdictColor(v: string | null): string {
  if (!v) return "bg-slate-200 text-slate-700";
  if (v.startsWith("Strong")) return "bg-emerald-100 text-emerald-800";
  if (v.startsWith("Hire")) return "bg-emerald-50 text-emerald-700";
  if (v.startsWith("Conditional")) return "bg-amber-100 text-amber-800";
  if (v.startsWith("Borderline")) return "bg-orange-100 text-orange-800";
  return "bg-rose-100 text-rose-800";
}

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export default function SdrTestAdmin() {
  const { attemptId } = useParams<{ attemptId?: string }>();
  return attemptId ? <AttemptDetail attemptId={attemptId} /> : <AttemptList />;
}

function AttemptList() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { effectiveOrgId } = useOrgContext();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const candidateUrl = typeof window !== "undefined" ? `${window.location.origin}/recruit/sdr-test` : "";

  const load = async () => {
    if (!effectiveOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("sdr_test_attempts")
      .select("*")
      .eq("org_id", effectiveOrgId)
      .order("submitted_at", { ascending: false, nullsFirst: false });
    setAttempts((data || []) as AttemptRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [effectiveOrgId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(candidateUrl);
      notify.success("Candidate link copied", candidateUrl);
    } catch {
      notify.error("Could not copy", new Error("Copy to clipboard failed"));
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">SDR Test Attempts</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${attempts.length} candidate${attempts.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-2" /> Candidate link
            </Button>
            <a href={candidateUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" /> Open
              </Button>
            </a>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2">Candidate</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Submitted</th>
                  <th className="text-left px-3 py-2">Time</th>
                  <th className="text-left px-3 py-2">Tabs</th>
                  <th className="text-left px-3 py-2">Score</th>
                  <th className="text-left px-3 py-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
                ) : attempts.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No attempts yet. Share the candidate link to begin.</td></tr>
                ) : (
                  attempts.map((a) => (
                    <tr
                      key={a.id}
                      className="border-t hover:bg-muted/20 cursor-pointer"
                      onClick={() => navigate(`/admin/sdr-test/${a.id}`)}
                    >
                      <td className="px-3 py-2 font-medium">{a.candidate_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.candidate_email}</td>
                      <td className="px-3 py-2">{a.submitted_at ? new Date(a.submitted_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : <span className="text-amber-600">In progress</span>}</td>
                      <td className="px-3 py-2">{fmtDuration(a.time_taken_seconds)}</td>
                      <td className={`px-3 py-2 ${(a.tab_switch_count || 0) > 3 ? "text-rose-600 font-semibold" : ""}`}>{a.tab_switch_count || 0}</td>
                      <td className="px-3 py-2 font-semibold">{a.final_score ?? a.auto_score ?? "—"}/{TOTAL_MARKS}</td>
                      <td className="px-3 py-2">
                        {a.verdict ? <Badge className={verdictColor(a.verdict)} variant="outline">{a.verdict.split(" — ")[0]}</Badge> : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function AttemptDetail({ attemptId }: { attemptId: string }) {
  const navigate = useNavigate();
  const notify = useNotification();
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualScores, setManualScores] = useState<Record<string, string>>({});
  const [evalNotes, setEvalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: r }] = await Promise.all([
      supabase.from("sdr_test_attempts").select("*").eq("id", attemptId).maybeSingle(),
      supabase.from("sdr_test_responses").select("*").eq("attempt_id", attemptId),
    ]);
    if (a) {
      setAttempt(a as AttemptRow);
      setEvalNotes(a.evaluator_notes || "");
    }
    if (r) {
      setResponses(r as ResponseRow[]);
      const ms: Record<string, string> = {};
      r.forEach((row: any) => {
        if (row.manual_score !== null && row.manual_score !== undefined) ms[row.question_id] = String(row.manual_score);
      });
      setManualScores(ms);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [attemptId]);

  const respMap = useMemo(() => new Map(responses.map((r) => [r.question_id, r])), [responses]);

  const computedTotal = useMemo(() => {
    let total = 0;
    for (const q of QUESTIONS) {
      const r = respMap.get(q.id);
      const manual = manualScores[q.id];
      if (manual !== undefined && manual !== "") {
        total += Math.min(q.marks, Math.max(0, Number(manual) || 0));
      } else {
        total += r?.auto_score || 0;
      }
    }
    return Math.min(total, TOTAL_MARKS);
  }, [respMap, manualScores]);

  const bySection = useMemo(() => {
    const out: Record<SectionId, { score: number; max: number }> = {
      A: { score: 0, max: 0 }, B: { score: 0, max: 0 }, C: { score: 0, max: 0 },
      D: { score: 0, max: 0 }, E: { score: 0, max: 0 }, F: { score: 0, max: 0 },
    };
    for (const q of QUESTIONS) {
      const r = respMap.get(q.id);
      const manual = manualScores[q.id];
      const score = manual !== undefined && manual !== ""
        ? Math.min(q.marks, Math.max(0, Number(manual) || 0))
        : r?.auto_score || 0;
      out[q.section].score += score;
      out[q.section].max += q.marks;
    }
    return out;
  }, [respMap, manualScores]);

  const save = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(manualScores).map(([qid, val]) => ({
        attempt_id: attemptId,
        question_id: qid,
        manual_score: val === "" ? null : Math.min(QUESTIONS.find((q) => q.id === qid)!.marks, Math.max(0, Number(val) || 0)),
        response_text: respMap.get(qid)?.response_text ?? null,
      }));
      if (updates.length) {
        await supabase.from("sdr_test_responses").upsert(updates, { onConflict: "attempt_id,question_id" });
      }
      await supabase
        .from("sdr_test_attempts")
        .update({
          final_score: computedTotal,
          evaluator_notes: evalNotes || null,
        })
        .eq("id", attemptId);
      notify.success("Saved", "Manual scores and notes updated.");
      await load();
    } catch (e: any) {
      notify.error("Failed to save", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !attempt) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Loading…</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/sdr-test")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to attempts
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{attempt.candidate_name}</CardTitle>
            <CardDescription>
              {attempt.candidate_email} · {attempt.candidate_phone || "—"} · {attempt.years_experience ?? 0} yr exp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Time taken</div><div className="font-semibold">{fmtDuration(attempt.time_taken_seconds)}</div></div>
              <div><div className="text-xs text-muted-foreground">Tab switches</div><div className={`font-semibold ${(attempt.tab_switch_count || 0) > 3 ? "text-rose-600" : ""}`}>{attempt.tab_switch_count || 0}</div></div>
              <div><div className="text-xs text-muted-foreground">Auto-score</div><div className="font-semibold">{attempt.auto_score ?? "—"}/{TOTAL_MARKS}</div></div>
              <div><div className="text-xs text-muted-foreground">Final score</div><div className="font-semibold text-emerald-700">{computedTotal}/{TOTAL_MARKS}</div></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs pt-2">
              {SECTIONS.map((s) => (
                <div key={s.id} className="rounded-md border p-2">
                  <div className="text-muted-foreground">Section {s.id}</div>
                  <div className="font-semibold">{bySection[s.id].score}/{bySection[s.id].max}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {SECTIONS.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="text-base">Section {s.id} — {s.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {QUESTIONS.filter((q) => q.section === s.id).map((q) => {
                const r = respMap.get(q.id);
                const flagged = r?.flagged_for_review;
                return (
                  <div key={q.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-medium flex-1">
                        <span className="text-muted-foreground mr-1">{q.id}.</span>{q.prompt}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">{q.marks} marks</div>
                    </div>
                    <div className="bg-muted/40 rounded-md p-2 text-sm whitespace-pre-wrap min-h-[2.5rem]">
                      {r?.response_text || <span className="text-muted-foreground italic">No answer</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      <span className="text-muted-foreground">Auto:</span>
                      <span className="font-semibold">{r?.auto_score ?? 0}/{q.marks}</span>
                      <span className="text-muted-foreground ml-2">Manual:</span>
                      <Input
                        type="number"
                        min={0}
                        max={q.marks}
                        value={manualScores[q.id] ?? ""}
                        onChange={(e) => setManualScores((p) => ({ ...p, [q.id]: e.target.value }))}
                        className="h-7 w-20"
                        placeholder={`/${q.marks}`}
                      />
                      {flagged && <Badge variant="outline" className="bg-amber-50 text-amber-700">flagged</Badge>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evaluator notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={evalNotes} onChange={(e) => setEvalNotes(e.target.value)} rows={4} placeholder="Hiring decision rationale, mock-call observations, etc." />
          </CardContent>
        </Card>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save final scores"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
