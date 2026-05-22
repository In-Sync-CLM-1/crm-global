import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const ATTEMPT_KEY = "sdr_test_attempt_id";

export default function SdrTestDone() {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear local attempt reference but keep DB record
    localStorage.removeItem(ATTEMPT_KEY);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
      <Card className="max-w-md w-full">
        <CardContent className="text-center p-8 space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold">Submitted</h1>
          <p className="text-muted-foreground">
            Thank you for completing the Work-Sync SDR assessment. The hiring team will review your responses and revert within 48 hours on the email and phone you shared.
          </p>
          <p className="text-xs text-muted-foreground">
            You may close this tab now.
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Return to home
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
