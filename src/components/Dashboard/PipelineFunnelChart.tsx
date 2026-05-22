import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface PipelineStage {
  stage_id: string;
  stage_name: string;
  stage_order: number;
  stage_color: string | null;
  contact_count: number;
}

interface PipelineFunnelChartProps {
  stages: PipelineStage[];
}

const STAGE_COLORS = [
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f97316", // orange
  "#ef4444", // red
  "#8b5cf6", // violet
];

export function PipelineFunnelChart({ stages }: PipelineFunnelChartProps) {
  const sorted = [...stages].sort((a, b) => a.stage_order - b.stage_order);
  const maxCount = Math.max(...sorted.map((s) => s.contact_count), 1);
  const total = sorted.reduce((sum, s) => sum + s.contact_count, 0);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Pipeline Funnel</h3>
          <p className="text-[10px] text-muted-foreground">{total} contacts across {sorted.length} stages</p>
        </div>
        <Link
          to="/pipeline"
          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Open Pipeline <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
          No pipeline data yet
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((stage, idx) => {
            const pct = maxCount > 0 ? (stage.contact_count / maxCount) * 100 : 0;
            const conversionFromPrev =
              idx > 0 && sorted[idx - 1].contact_count > 0
                ? Math.round((stage.contact_count / sorted[idx - 1].contact_count) * 100)
                : null;
            const color = stage.stage_color || STAGE_COLORS[idx % STAGE_COLORS.length];

            return (
              <div key={stage.stage_id}>
                {/* Conversion arrow between stages */}
                {conversionFromPrev !== null && (
                  <div className="flex items-center gap-1 mb-1 pl-1">
                    <div className="h-3 w-px bg-border ml-1" />
                    <span className="text-[9px] text-muted-foreground">{conversionFromPrev}% conversion</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground w-24 shrink-0 truncate text-right">
                    {stage.stage_name}
                  </span>
                  <div className="flex-1 relative h-7 bg-muted/40 rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                    />
                    <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold text-white mix-blend-normal z-10">
                      {stage.contact_count}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">
                    {total > 0 ? Math.round((stage.contact_count / total) * 100) : 0}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
