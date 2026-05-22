import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QUESTIONS, SECTIONS, TIME_LIMIT_MINUTES } from "@/data/sdrQuestions";
import type { Question } from "@/data/sdrQuestions";
import { Clock, Save, AlertTriangle, ChevronRight } from "lucide-react";

const ATTEMPT_KEY = "sdr_test_attempt_id";
const ANSWERS_KEY = "sdr_test_answers";
const SECTION_KEY = "sdr_test_section";

type Answers = Record<string, string>;

function fmtMSS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

interface AttemptRow {
  id: string;
  candidate_name: string;
  started_at: string;
  submitted_at: string | null;
  tab_switch_count: number;
}

export default function SdrTestRun() {
  const navigate = useNavigate();
  const attemptId = typeof window !== "undefined" ? localStorage.getItem(ATTEMPT_KEY) : null;

  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [sectionIdx, setSectionIdx] = useState<number>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(SECTION_KEY) : null;
    return stored ? Math.max(0, parseInt(stored, 10) || 0) : 0;
  });

  const [answers, setAnswers] = useState<Answers>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(ANSWERS_KEY) || "{}") as Answers;
    } catch {
      return {};
    }
  });

  const [savingSection, setSavingSection] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const tabSwitchRef = useRef(0);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!attemptId) {
      navigate("/recruit/sdr-test");
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("sdr_test_attempts")
        .select("id, candidate_name, started_at, submitted_at, tab_switch_count")
        .eq("id", attemptId)
        .maybeSingle();
      if (error || !data) {
        localStorage.removeItem(ATTEMPT_KEY);
        navigate("/recruit/sdr-test");
        return;
      }
      if (data.submitted_at) {
        navigate("/recruit/sdr-test/done");
        return;
      }
      setAttempt(data as AttemptRow);
      setTabSwitches(data.tab_switch_count || 0);
      tabSwitchRef.current = data.tab_switch_count || 0;
      setLoading(false);
    })();
  }, [attemptId, navigate]);

  // Tick clock every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Persist answers + section locally as user types
  useEffect(() => {
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
  }, [answers]);
  useEffect(() => {
    localStorage.setItem(SECTION_KEY, String(sectionIdx));
  }, [sectionIdx]);

  // Tab-switch detection
  useEffect(() => {
    function onBlur() {
      tabSwitchRef.current += 1;
      setTabSwitches(tabSwitchRef.current);
      if (attemptId) {
        void supabase
          .from("sdr_test_attempts")
          .update({ tab_switch_count: tabSwitchRef.current })
          .eq("id", attemptId);
      }
    }
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [attemptId]);

  const startedAt = attempt ? new Date(attempt.started_at).getTime() : null;
  const deadline = startedAt ? startedAt + TIME_LIMIT_MINUTES * 60 * 1000 : null;
  const remainingSec = deadline ? Math.floor((deadline - now) / 1000) : TIME_LIMIT_MINUTES * 60;
  const warningPhase = remainingSec <= 5 * 60 && remainingSec > 0;
  const expired = remainingSec <= 0;

  const currentSection = SECTIONS[sectionIdx];
  const sectionQuestions = useMemo(
    () => QUESTIONS.filter((q) => q.section === currentSection?.id),
    [currentSection],
  );

  const handleAnswerChange = (qid: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const persistResponses = useCallback(
    async (qids: string[]) => {
      if (!attemptId) return;
      const rows = qids.map((qid) => {
        const q = QUESTIONS.find((qq) => qq.id === qid)!;
        return {
          attempt_id: attemptId,
          question_id: qid,
          section: q.section,
          response_text: answers[qid] ?? null,
        };
      });
      if (!rows.length) return;
      await supabase
        .from("sdr_test_responses")
        .upsert(rows, { onConflict: "attempt_id,question_id" });
    },
    [answers, attemptId],
  );

  const submitAll = useCallback(
    async (reason: "manual" | "timeout") => {
      if (!attemptId || submittingRef.current) return;
      submittingRef.current = true;
      try {
        // Persist all answers (entire bank, not just current section)
        const allQids = QUESTIONS.map((q) => q.id);
        await persistResponses(allQids);

        const elapsedSec = startedAt
          ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
          : null;

        await supabase
          .from("sdr_test_attempts")
          .update({
            submitted_at: new Date().toISOString(),
            time_taken_seconds: elapsedSec,
            tab_switch_count: tabSwitchRef.current,
          })
          .eq("id", attemptId);

        // Trigger scoring + email via edge function (best-effort)
        try {
          await supabase.functions.invoke("submit-sdr-test", {
            body: { attempt_id: attemptId, reason },
          });
        } catch (err) {
          console.warn("submit-sdr-test invoke failed (best-effort):", err);
        }

        localStorage.removeItem(ANSWERS_KEY);
        localStorage.removeItem(SECTION_KEY);
        navigate("/recruit/sdr-test/done");
      } finally {
        submittingRef.current = false;
      }
    },
    [attemptId, navigate, persistResponses, startedAt],
  );

  // Auto-submit on expiry
  useEffect(() => {
    if (expired && !loading && !submittingRef.current) {
      void submitAll("timeout");
    }
  }, [expired, loading, submitAll]);

  const handleSectionAdvance = async () => {
    setSavingSection(true);
    try {
      await persistResponses(sectionQuestions.map((q) => q.id));
      if (sectionIdx < SECTIONS.length - 1) {
        setSectionIdx(sectionIdx + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        await submitAll("manual");
      }
    } finally {
      setSavingSection(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading test…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      {/* Sticky timer header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{attempt?.candidate_name}</div>
            <div className="text-xs text-muted-foreground">
              Section {sectionIdx + 1} of {SECTIONS.length} · {currentSection?.title}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tabSwitches > 0 && (
              <div className="hidden sm:flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{tabSwitches} tab switch{tabSwitches > 1 ? "es" : ""} logged</span>
              </div>
            )}
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-base font-semibold ${
                warningPhase
                  ? "bg-rose-100 text-rose-700 animate-pulse"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              }`}
            >
              <Clock className="h-4 w-4" />
              {fmtMSS(remainingSec)}
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <Progress value={((sectionIdx + 1) / SECTIONS.length) * 100} className="h-1.5" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {currentSection?.title} · {currentSection?.marks} marks
            </CardTitle>
            {currentSection?.description && (
              <CardDescription>{currentSection.description}</CardDescription>
            )}
          </CardHeader>
        </Card>

        {sectionQuestions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            q={q}
            number={idx + 1}
            value={answers[q.id] || ""}
            onChange={(v) => handleAnswerChange(q.id, v)}
          />
        ))}

        <div className="flex items-center justify-between pt-4">
          <div className="text-xs text-muted-foreground">
            {sectionIdx < SECTIONS.length - 1
              ? "Once you continue, you cannot return to this section."
              : "Submitting will end the assessment."}
          </div>
          <Button
            onClick={handleSectionAdvance}
            disabled={savingSection || submittingRef.current}
            size="lg"
          >
            {savingSection ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-pulse" /> Saving…
              </>
            ) : sectionIdx < SECTIONS.length - 1 ? (
              <>
                Save & Continue <ChevronRight className="h-4 w-4 ml-1" />
              </>
            ) : (
              <>Submit Test</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  number,
  value,
  onChange,
}: {
  q: Question;
  number: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const handlePaste = (e: React.ClipboardEvent) => e.preventDefault();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold leading-relaxed flex items-start gap-2">
          <span className="text-muted-foreground shrink-0">{q.id}.</span>
          <span className="flex-1">{q.prompt}</span>
          <span className="text-xs font-normal text-muted-foreground shrink-0">{q.marks} marks</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {q.type === "mcq" && q.options ? (
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt}
                className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 select-none"
              >
                <input
                  type="radio"
                  name={q.id}
                  value={opt}
                  checked={value === opt}
                  onChange={(e) => onChange(e.target.value)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-relaxed">{opt}</span>
              </label>
            ))}
          </div>
        ) : q.type === "short" ? (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            placeholder="Your answer"
          />
        ) : q.type === "list" ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            rows={4}
            placeholder="One item per line, or separated by commas / arrows"
          />
        ) : (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            rows={q.type === "roleplay" ? 8 : 5}
            placeholder="Write your answer"
          />
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Question {number} · Pasting is disabled
        </p>
      </CardContent>
    </Card>
  );
}
