import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface ActivityDay {
  date: string;
  calls: number;
  emails: number;
  meetings: number;
}

interface SalesActivityTrendProps {
  data: ActivityDay[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function SalesActivityTrend({ data, isLoading }: SalesActivityTrendProps) {
  const totalCalls = data.reduce((s, d) => s + d.calls, 0);
  const totalEmails = data.reduce((s, d) => s + d.emails, 0);
  const totalMeetings = data.reduce((s, d) => s + d.meetings, 0);

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Activity Trend</h3>
        <div className="flex gap-4 mt-1">
          <span className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-blue-500">{totalCalls}</span> calls
          </span>
          <span className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-emerald-500">{totalEmails}</span> emails
          </span>
          <span className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-violet-500">{totalMeetings}</span> meetings
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground animate-pulse">
          Loading…
        </div>
      ) : data.length === 0 || (totalCalls + totalEmails + totalMeetings === 0) ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
          No activity data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCalls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradEmails" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradMeetings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
              formatter={(value) => <span className="capitalize text-muted-foreground">{value}</span>}
            />
            <Area type="monotone" dataKey="calls" stroke="#3b82f6" strokeWidth={1.5} fill="url(#gradCalls)" />
            <Area type="monotone" dataKey="emails" stroke="#10b981" strokeWidth={1.5} fill="url(#gradEmails)" />
            <Area type="monotone" dataKey="meetings" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#gradMeetings)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
