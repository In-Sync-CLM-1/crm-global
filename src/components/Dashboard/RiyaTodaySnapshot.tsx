import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneCall, Calendar, Clock, Ban, MessageCircle, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const BOLNA_CALLER_ID = "+911169323462";

type Extracted = {
  General?: {
    outcome?: { objective?: string | null };
    notes?: { subjective?: string | null };
    demo_datetime?: { subjective?: string | null };
    callback_datetime?: { subjective?: string | null };
  };
};

interface Row {
  id: string;
  status: string | null;
  call_duration: number | null;
  conversation_duration: number | null;
  extracted_data: Extracted | null;
  created_at: string;
  to_number: string | null;
}

const fmtIST = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

const istDayBounds = () => {
  const now = new Date();
  const istOffset = 5.5 * 3600 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - istOffset).toISOString();
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - istOffset).toISOString();
  return { start, end };
};

export function RiyaTodaySnapshot() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { start, end } = istDayBounds();
      const { data, error } = await supabase
        .from("call_logs")
        .select("id, status, call_duration, conversation_duration, extracted_data, created_at, to_number")
        .eq("from_number", BOLNA_CALLER_ID)
        .gte("created_at", start)
        .lte("created_at", end);
      if (!error && data) setRows(data as unknown as Row[]);
      setLoading(false);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const total = rows.length;
  const connected = rows.filter((r) => r.status === "completed").length;
  const conv = rows.filter((r) => (r.conversation_duration ?? 0) > 0).length;

  const outcomeOf = (r: Row) => r.extracted_data?.General?.outcome?.objective ?? null;
  const demos = rows.filter((r) => outcomeOf(r) === "demo_agreed");
  const callbacks = rows.filter((r) => outcomeOf(r) === "callback");
  const dnc = rows.filter((r) => outcomeOf(r) === "do_not_call");
  const notInt = rows.filter((r) => outcomeOf(r) === "not_interested");
  const noResp = rows.filter((r) => outcomeOf(r) === "no_response");

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const talkSec = rows.reduce((a, r) => a + (r.conversation_duration ?? 0), 0);

  // Caller rating — average call quality 0-10 based on Bolna outcomes.
  // Only call_logs with an extracted outcome contribute; missed calls don't penalize the bot.
  const OUTCOME_SCORES: Record<string, number> = {
    demo_agreed: 10,
    callback: 7,
    not_interested: 5,
    no_response: 3,
    do_not_call: 1,
  };
  const ratedScores = rows
    .map((r) => OUTCOME_SCORES[outcomeOf(r) || ""])
    .filter((s): s is number => typeof s === "number");
  const rating = ratedScores.length
    ? ratedScores.reduce((a, b) => a + b, 0) / ratedScores.length
    : null;
  const ratingTone: "default" | "success" | "warning" | "danger" =
    rating == null ? "default" : rating >= 7 ? "success" : rating >= 4 ? "warning" : "danger";

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">Loading Riya's day…</CardContent>
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Sparkles className="h-5 w-5 opacity-50" />
          Riya hasn't placed any calls yet today.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.04]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          Riya Today
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {(talkSec / 60).toFixed(1)} min talk · avg {conv ? Math.round(talkSec / conv) : 0}s
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatTile icon={<Phone className="h-5 w-5" />} value={total} label="Dials" tone="default" />
          <StatTile icon={<PhoneCall className="h-5 w-5" />} value={connected} label={`Connected · ${pct(connected)}%`} tone="info" />
          <StatTile icon={<Calendar className="h-5 w-5" />} value={demos.length} label="Demos" tone={demos.length ? "success" : "default"} />
          <StatTile icon={<Clock className="h-5 w-5" />} value={callbacks.length} label="Callbacks" tone={callbacks.length ? "warning" : "default"} />
          <StatTile icon={<Ban className="h-5 w-5" />} value={dnc.length} label="DNC" tone={dnc.length ? "danger" : "default"} />
          <RatingTile rating={rating} tone={ratingTone} sample={ratedScores.length} />
        </div>

        <div className="space-y-1.5">
          <FunnelRow label="Dialed" count={total} max={total} color="bg-blue-500" />
          <FunnelRow label="Connected" count={connected} max={total} color="bg-emerald-500" />
          <FunnelRow label="Engaged" count={conv} max={total} color="bg-cyan-500" />
          <FunnelRow label="Demo or Callback" count={demos.length + callbacks.length} max={total} color="bg-purple-500" />
        </div>

        <div className="flex flex-wrap gap-2">
          <OutcomeBadge tone="success" icon={<Calendar className="h-3.5 w-3.5" />} label="Demo" count={demos.length} />
          <OutcomeBadge tone="info" icon={<Clock className="h-3.5 w-3.5" />} label="Callback" count={callbacks.length} />
          <OutcomeBadge tone="muted" icon={<MessageCircle className="h-3.5 w-3.5" />} label="No response" count={noResp.length} />
          <OutcomeBadge tone="warning" icon={<MessageCircle className="h-3.5 w-3.5" />} label="Not interested" count={notInt.length} />
          <OutcomeBadge tone="danger" icon={<Ban className="h-3.5 w-3.5" />} label="DNC" count={dnc.length} />
        </div>

        {(demos.length > 0 || callbacks.length > 0 || dnc.length > 0) && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {demos.map((r) => (
              <ActionTile
                key={r.id}
                tone="success"
                icon={<Calendar className="h-4 w-4" />}
                title={r.extracted_data?.General?.demo_datetime?.subjective || "Demo agreed"}
                subtitle={r.extracted_data?.General?.notes?.subjective || ""}
                hint={`${fmtIST(r.created_at)} · ${r.to_number || ""}`}
              />
            ))}
            {callbacks.map((r) => (
              <ActionTile
                key={r.id}
                tone="info"
                icon={<Clock className="h-4 w-4" />}
                title={r.extracted_data?.General?.callback_datetime?.subjective || "Callback"}
                subtitle={r.extracted_data?.General?.notes?.subjective || ""}
                hint={`${fmtIST(r.created_at)} · ${r.to_number || ""}`}
              />
            ))}
            {dnc.map((r) => (
              <ActionTile
                key={r.id}
                tone="danger"
                icon={<Ban className="h-4 w-4" />}
                title="Do not call"
                subtitle={r.extracted_data?.General?.notes?.subjective || ""}
                hint={`${fmtIST(r.created_at)} · ${r.to_number || ""}`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TONES = {
  default: "bg-muted text-foreground",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20",
  danger: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  muted: "bg-muted text-muted-foreground border-muted-foreground/20",
} as const;

type Tone = keyof typeof TONES;

function StatTile({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: Tone }) {
  return (
    <div className={cn("rounded-lg p-3 flex flex-col gap-1 border", TONES[tone])}>
      <div>{icon}</div>
      <div className="text-2xl font-bold leading-none tabular-nums">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function RatingTile({ rating, tone, sample }: { rating: number | null; tone: Tone; sample: number }) {
  return (
    <div className={cn("rounded-lg p-3 flex flex-col gap-1 border", TONES[tone])}>
      <div><Star className="h-5 w-5" /></div>
      <div className="text-2xl font-bold leading-none tabular-nums">
        {rating == null ? "—" : rating.toFixed(1)}
        {rating != null && <span className="text-base font-normal opacity-70">/10</span>}
      </div>
      <div className="text-xs opacity-80">Caller rating · {sample} call{sample === 1 ? "" : "s"}</div>
    </div>
  );
}

function FunnelRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-36 shrink-0 text-muted-foreground">{label}</div>
      <div className="flex-1 h-2.5 bg-muted rounded overflow-hidden">
        <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-12 text-right font-medium tabular-nums">{count}</div>
    </div>
  );
}

function OutcomeBadge({ tone, icon, label, count }: { tone: Tone; icon: React.ReactNode; label: string; count: number }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 py-1 px-2 border", TONES[tone])}>
      {icon}
      <span>{label}</span>
      <span className="font-semibold ml-0.5">{count}</span>
    </Badge>
  );
}

function ActionTile({ tone, icon, title, subtitle, hint }: { tone: Tone; icon: React.ReactNode; title: string; subtitle: string; hint: string }) {
  return (
    <div className={cn("rounded-md p-2.5 flex gap-2 items-start border", TONES[tone])}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle && <div className="text-xs opacity-80 line-clamp-1">{subtitle}</div>}
        <div className="text-[10px] opacity-60 mt-0.5">{hint}</div>
      </div>
    </div>
  );
}
