import { Card } from "@/components/ui/card";
import { Users, TrendingUp, Trophy, Target, PhoneCall, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface SalesKPICardsProps {
  newLeads: number;
  newLeadsDelta: number; // % change vs prev period
  activePipeline: number;
  dealsWon: number;
  winRate: number; // percentage
  totalActivities: number;
  activitiesDelta: number;
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="flex items-center gap-0.5 text-muted-foreground"><Minus className="h-2.5 w-2.5" />0%</span>;
  if (delta > 0) return <span className="flex items-center gap-0.5 text-emerald-500"><ArrowUpRight className="h-2.5 w-2.5" />+{delta}%</span>;
  return <span className="flex items-center gap-0.5 text-red-500"><ArrowDownRight className="h-2.5 w-2.5" />{delta}%</span>;
}

export function SalesKPICards({ newLeads, newLeadsDelta, activePipeline, dealsWon, winRate, totalActivities, activitiesDelta }: SalesKPICardsProps) {
  const cards = [
    {
      label: "New Leads",
      value: newLeads,
      sub: <DeltaBadge delta={newLeadsDelta} />,
      subText: "vs prev period",
      icon: Users,
      gradient: "from-blue-500/10 to-blue-600/5",
      iconColor: "text-blue-500",
    },
    {
      label: "Active Pipeline",
      value: activePipeline,
      sub: null,
      subText: "contacts in stages",
      icon: Target,
      gradient: "from-violet-500/10 to-violet-600/5",
      iconColor: "text-violet-500",
    },
    {
      label: "Deals Won",
      value: dealsWon,
      sub: null,
      subText: "this period",
      icon: Trophy,
      gradient: "from-emerald-500/10 to-emerald-600/5",
      iconColor: "text-emerald-500",
    },
    {
      label: "Win Rate",
      value: `${winRate}%`,
      sub: null,
      subText: "won / (won + lost)",
      icon: TrendingUp,
      gradient: "from-amber-500/10 to-amber-600/5",
      iconColor: "text-amber-500",
    },
    {
      label: "Activities",
      value: totalActivities,
      sub: <DeltaBadge delta={activitiesDelta} />,
      subText: "calls · emails · meetings",
      icon: PhoneCall,
      gradient: "from-primary/10 to-primary/5",
      iconColor: "text-primary",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className={`p-4 bg-gradient-to-br ${card.gradient} border-border/50`}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              <div className={`p-1.5 rounded-md bg-background/60`}>
                <Icon className={`h-3.5 w-3.5 ${card.iconColor}`} />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight">{card.value}</div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              {card.sub && <>{card.sub} &middot; </>}
              {card.subText}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
