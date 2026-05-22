import { Card } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";

interface RepPerformance {
  user_id: string;
  user_name: string;
  total_contacts: number;
  total_calls: number;
  total_emails: number;
  total_meetings: number;
  deals_won: number;
  conversion_rate: number;
}

interface SalesLeaderboardProps {
  reps: RepPerformance[];
  isLoading?: boolean;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-amber-400" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return <span className="text-xs text-muted-foreground w-4 text-center">{rank}</span>;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export function SalesLeaderboard({ reps, isLoading }: SalesLeaderboardProps) {
  const sorted = [...reps].sort((a, b) => b.deals_won - a.deals_won || b.total_contacts - a.total_contacts);

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Sales Leaderboard</h3>
        <p className="text-[10px] text-muted-foreground">Rep performance for selected period</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-6 h-4 bg-muted rounded" />
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="flex-1 h-4 bg-muted rounded" />
              <div className="w-16 h-4 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
          No rep data for this period
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-2 text-[10px] font-medium text-muted-foreground w-6">#</th>
                <th className="text-left pb-2 text-[10px] font-medium text-muted-foreground">Rep</th>
                <th className="text-right pb-2 text-[10px] font-medium text-muted-foreground">Contacts</th>
                <th className="text-right pb-2 text-[10px] font-medium text-muted-foreground">Calls</th>
                <th className="text-right pb-2 text-[10px] font-medium text-muted-foreground">Meetings</th>
                <th className="text-right pb-2 text-[10px] font-medium text-muted-foreground">Won</th>
                <th className="text-right pb-2 text-[10px] font-medium text-muted-foreground">Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sorted.map((rep, idx) => (
                <tr key={rep.user_id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 pr-2">
                    <div className="flex justify-center">
                      <RankBadge rank={idx + 1} />
                    </div>
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}
                      >
                        {initials(rep.user_name || "?")}
                      </div>
                      <span className="font-medium text-foreground truncate max-w-[120px]">
                        {rep.user_name || "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground">{rep.total_contacts}</td>
                  <td className="py-2.5 text-right text-muted-foreground">{rep.total_calls}</td>
                  <td className="py-2.5 text-right text-muted-foreground">{rep.total_meetings}</td>
                  <td className="py-2.5 text-right">
                    <span className="font-semibold text-emerald-600">{rep.deals_won}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`font-medium ${
                        rep.conversion_rate >= 30
                          ? "text-emerald-600"
                          : rep.conversion_rate >= 15
                          ? "text-amber-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {Number(rep.conversion_rate).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
