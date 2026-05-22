import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Organization {
  name: string;
  is_active?: boolean;
  userCount?: number;
  contactCount?: number;
}

interface Props {
  organizations: Organization[];
}

export function PlatformOrgHealth({ organizations }: Props) {
  const active = organizations.filter((o) => o.is_active !== false).length;
  const inactive = organizations.length - active;
  const withContacts = organizations.filter((o) => (o.contactCount || 0) > 0).length;
  const withUsers = organizations.filter((o) => (o.userCount || 0) > 1).length;

  const pieData = [
    { name: "Active", value: active, color: "hsl(142, 76%, 36%)" },
    { name: "Inactive", value: inactive, color: "hsl(0, 84%, 60%)" },
  ].filter((d) => d.value > 0);

  const metrics = [
    { label: "With contacts", value: withContacts, total: organizations.length },
    { label: "With 2+ users", value: withUsers, total: organizations.length },
    { label: "Active", value: active, total: organizations.length },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Organization Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center gap-4 mt-2 mb-4">
          {pieData.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-semibold">{d.value}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2 border-t">
          {metrics.map((m) => {
            const pct = m.total > 0 ? Math.round((m.value / m.total) * 100) : 0;
            return (
              <div key={m.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{m.label}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {m.value}/{m.total}
                  </Badge>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
