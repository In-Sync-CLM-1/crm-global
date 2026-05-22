import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";

// Session cache
const insightCache: { text: string; ts: number } | null = null;
let cachedInsight: { text: string; ts: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

export function PlatformAiInsights() {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = async (force = false) => {
    if (!force && cachedInsight && Date.now() - cachedInsight.ts < CACHE_TTL) {
      setInsight(cachedInsight.text);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: fnError } = await supabase.functions.invoke("platform-ai-insights", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const text = data?.insight || "No insights available.";
      setInsight(text);
      cachedInsight = { text, ts: Date.now() };
    } catch (err: any) {
      setError("Could not generate insights. Check that ANTHROPIC_API_KEY is configured.");
      console.error("Platform AI Insights error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-violet-500/[0.03]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Platform Insights
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchInsight(true)}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {insight ? "Refresh" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent>
        {!insight && !loading && !error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-center">
              Click <strong>Generate</strong> to get AI-powered insights about your platform health, adoption trends, and recommendations.
            </p>
          </div>
        ) : loading && !insight ? (
          <div className="space-y-2 py-4">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : insight ? (
          <div className="text-sm text-foreground/90 space-y-1">
            {insight.split("\n").map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              if (line.startsWith("**") && line.endsWith("**")) {
                return <p key={i} className="mt-3 font-semibold text-foreground">{line.replace(/\*\*/g, "")}</p>;
              }
              if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                const content = line.trim().replace(/^[-*]\s/, "");
                const parts = content.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <div key={i} className="ml-3 flex gap-1.5 py-0.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>
                      {parts.map((part, j) =>
                        part.startsWith("**") && part.endsWith("**")
                          ? <strong key={j}>{part.replace(/\*\*/g, "")}</strong>
                          : <span key={j}>{part}</span>
                      )}
                    </span>
                  </div>
                );
              }
              if (/^\d+\.\s/.test(line.trim())) {
                const content = line.trim().replace(/^\d+\.\s/, "");
                const parts = content.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <div key={i} className="ml-3 py-0.5">
                    <span>
                      {parts.map((part, j) =>
                        part.startsWith("**") && part.endsWith("**")
                          ? <strong key={j}>{part.replace(/\*\*/g, "")}</strong>
                          : <span key={j}>{part}</span>
                      )}
                    </span>
                  </div>
                );
              }
              const parts = line.split(/(\*\*[^*]+\*\*)/g);
              return (
                <p key={i} className="py-0.5">
                  {parts.map((part, j) =>
                    part.startsWith("**") && part.endsWith("**")
                      ? <strong key={j}>{part.replace(/\*\*/g, "")}</strong>
                      : <span key={j}>{part}</span>
                  )}
                </p>
              );
            })}
            {loading && <p className="mt-2 text-xs text-muted-foreground">Refreshing...</p>}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
