import { Card } from "@/components/ui/card";
import { Users, Target, PhoneCall, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

interface DashboardStatsCardsProps {
  stats: {
    totalContacts: number;
    conversionRate: number;
    callsToday: number;
    dealsWonThisMonth: number;
    contactGrowth: number;
  };
}

export function DashboardStatsCards({ stats }: DashboardStatsCardsProps) {
  return (
    <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total Contacts</span>
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="text-xl font-bold mt-1">{stats.totalContacts}</div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
          {stats.contactGrowth >= 0 ? (
            <>
              <ArrowUpRight className="h-2.5 w-2.5 text-green-500" />
              <span className="text-green-500">{stats.contactGrowth}%</span>
            </>
          ) : (
            <>
              <ArrowDownRight className="h-2.5 w-2.5 text-red-500" />
              <span className="text-red-500">{Math.abs(stats.contactGrowth)}%</span>
            </>
          )}
          {' '}from last week
        </p>
      </Card>

      <Card className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Conversion Rate</span>
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="text-xl font-bold mt-1">{`${stats.conversionRate}%`}</div>
        <p className="text-[10px] text-muted-foreground">{stats.dealsWonThisMonth} deals won</p>
      </Card>

      <Card className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Calls Today</span>
          <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="text-xl font-bold mt-1">{stats.callsToday}</div>
        <p className="text-[10px] text-muted-foreground">Calls logged today</p>
      </Card>

      <Card className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Deals Won</span>
          <TrendingUp className="h-3.5 w-3.5 text-green-500" />
        </div>
        <div className="text-xl font-bold text-green-600 mt-1">{stats.dealsWonThisMonth}</div>
        <p className="text-[10px] text-muted-foreground">This month</p>
      </Card>
    </div>
  );
}
