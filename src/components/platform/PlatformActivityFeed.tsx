import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Users, Contact } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Organization {
  id: string;
  name: string;
  created_at: string;
  userCount?: number;
  contactCount?: number;
}

interface Props {
  organizations: Organization[];
}

export function PlatformActivityFeed({ organizations }: Props) {
  const feed = [...organizations]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15)
    .map((org) => ({
      id: org.id,
      icon: Building2,
      color: "text-primary bg-primary/10",
      detail: `${org.name} joined the platform`,
      sub: `${org.userCount || 0} users, ${org.contactCount || 0} contacts`,
      timestamp: org.created_at,
    }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {feed.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">No activity yet</p>
        ) : (
          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-3">
              {feed.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.detail}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
