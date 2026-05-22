import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TIME_LIMIT_MINUTES, TOTAL_MARKS, SECTIONS } from "@/data/sdrQuestions";
import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";

const ATTEMPT_KEY = "sdr_test_attempt_id";
// In-Sync Demo org — the only org running this assessment for now
const ORG_ID = "61f7f96d-e80c-4d9b-a765-8eb32bd3c70d";

export default function SdrTestLanding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [years, setYears] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill name, email and phone.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!acknowledged) {
      setError("Please confirm the integrity statement to begin.");
      return;
    }

    setSubmitting(true);
    try {
      // Check for existing attempt by email
      const { data: existing } = await supabase
        .from("sdr_test_attempts")
        .select("id, submitted_at")
        .eq("org_id", ORG_ID)
        .eq("candidate_email", email.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        if (existing.submitted_at) {
          setError("You have already submitted this test. One attempt is permitted per email address.");
          setSubmitting(false);
          return;
        }
        // Resume in-progress attempt
        localStorage.setItem(ATTEMPT_KEY, existing.id);
        navigate("/recruit/sdr-test/run");
        return;
      }

      const { data: created, error: insertError } = await supabase
        .from("sdr_test_attempts")
        .insert({
          org_id: ORG_ID,
          candidate_name: name.trim(),
          candidate_email: email.trim().toLowerCase(),
          candidate_phone: phone.trim(),
          years_experience: years ? parseInt(years, 10) : null,
          user_agent: navigator.userAgent,
        })
        .select("id")
        .single();

      if (insertError || !created) {
        setError(insertError?.message || "Could not start the test. Please try again.");
        setSubmitting(false);
        return;
      }

      localStorage.setItem(ATTEMPT_KEY, created.id);
      navigate("/recruit/sdr-test/run");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Work-Sync SDR Assessment</h1>
          <p className="text-muted-foreground">Pre-employment evaluation for SDR candidates</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" /> What to expect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{TIME_LIMIT_MINUTES}</div>
                <div className="text-xs text-muted-foreground">minutes total</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{SECTIONS.length}</div>
                <div className="text-xs text-muted-foreground">sections</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{TOTAL_MARKS}</div>
                <div className="text-xs text-muted-foreground">total marks</div>
              </div>
            </div>

            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                <span>Sections cover Product, Call Flow, Objections, Competitive Awareness, CRM, and a written Role-play.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                <span>The timer is server-authoritative and continues even if you refresh.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                <span>You can save progress between sections. There is no "Back" once a section is submitted.</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                <span>Tab switching is logged. Copy/paste into answer fields is disabled.</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                <span>You may attempt the test only once per email address.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={startTest} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Full name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone</label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98XXX XXXXX" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Years of experience</label>
                  <Input type="number" min={0} max={40} value={years} onChange={(e) => setYears(e.target.value)} placeholder="0" />
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer pt-2 select-none">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I confirm that I will complete this test on my own without referring to notes, the Work-Sync website, or any other resource, and I understand that tab-switches are logged.
                </span>
              </label>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-md p-3">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full" size="lg">
                {submitting ? "Starting…" : "Start Test"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          By submitting, you agree to be evaluated based on this test as part of the recruitment process.
        </p>
      </div>
    </div>
  );
}
