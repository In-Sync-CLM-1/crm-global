import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Organization {
  name: string;
  usersActive1Day: number;
  usersActive7Days: number;
  usersActive30Days: number;
}

interface Props {
  organizations: Organization[];
}

export function PlatformUserActivityChart({ organizations }: Props) {
  const chartData = organizations
    .filter((o) => o.usersActive1Day > 0 || o.usersActive7Days > 0 || o.usersActive30Days > 0)
    .sort((a, b) => b.usersActive30Days - a.usersActive30Days)
    .slice(0, 8)
    .map((org) => ({
      name: org.name.length > 14 ? org.name.slice(0, 12) + "..." : org.name,
      fullName: org.name,
      "24h": org.usersActive1Day,
      "7d": org.usersActive7Days,
      "30d": org.usersActive30Days,
    }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>User Activity by Organization</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            No active users in any organization yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
              />
              <Bar dataKey="24h" fill="hsl(142, 76%, 36%)" radius={[2, 2, 0, 0]} name="Last 24h" />
              <Bar dataKey="7d" fill="hsl(217, 91%, 60%)" radius={[2, 2, 0, 0]} name="Last 7 days" />
              <Bar dataKey="30d" fill="hsl(263, 70%, 50%)" radius={[2, 2, 0, 0]} name="Last 30 days" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
