import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, Clock, ExternalLink, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useNotification } from "@/hooks/useNotification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DueItem = {
  id: string;
  source: "task" | "activity";
  title: string;
  due: string;
  isCompleted: boolean;
  contactId?: string | null;
  contactName?: string | null;
  priority?: string | null;
};

export function DueTodayCard() {
  const { effectiveOrgId } = useOrgContext();
  const navigate = useNavigate();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const startIso = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); })();
  const endIso = (() => { const d = new Date(); d.setHours(23,59,59,999); return d.toISOString(); })();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["due-today", effectiveOrgId, userId, startIso],
    queryFn: async (): Promise<DueItem[]> => {
      if (!effectiveOrgId || !userId) return [];

      // Tasks assigned to user, due today
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, due_date, status, priority")
        .eq("org_id", effectiveOrgId)
        .eq("assigned_to", userId)
        .gte("due_date", startIso)
        .lte("due_date", endIso);

      // Contacts assigned to user — for picking up activities on their leads
      const { data: ownedContacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("org_id", effectiveOrgId)
        .eq("assigned_to", userId);
      const ownedById = new Map<string, { name: string }>();
      (ownedContacts ?? []).forEach((c: any) => ownedById.set(c.id, { name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() }));
      const ownedIds = Array.from(ownedById.keys());

      // Activities created by user OR tied to user's contacts, scheduled today, not completed
      let actsCreated: any[] = [];
      let actsAssigned: any[] = [];

      const baseSelect = "id, subject, activity_type, scheduled_at, next_action_date, completed_at, contact_id, priority";

      const { data: created } = await supabase
        .from("contact_activities")
        .select(baseSelect)
        .eq("org_id", effectiveOrgId)
        .eq("created_by", userId)
        .is("completed_at", null)
        .or(`scheduled_at.gte.${startIso},next_action_date.gte.${startIso}`)
        .or(`scheduled_at.lte.${endIso},next_action_date.lte.${endIso}`);
      actsCreated = created ?? [];

      if (ownedIds.length > 0) {
        const { data: assigned } = await supabase
          .from("contact_activities")
          .select(baseSelect)
          .eq("org_id", effectiveOrgId)
          .in("contact_id", ownedIds)
          .is("completed_at", null)
          .or(`scheduled_at.gte.${startIso},next_action_date.gte.${startIso}`)
          .or(`scheduled_at.lte.${endIso},next_action_date.lte.${endIso}`);
        actsAssigned = assigned ?? [];
      }

      const byId = new Map<string, any>();
      [...actsCreated, ...actsAssigned].forEach((a) => byId.set(a.id, a));

      const taskItems: DueItem[] = (tasks ?? []).map((t: any) => ({
        id: t.id,
        source: "task" as const,
        title: t.title,
        due: t.due_date,
        isCompleted: t.status === "completed",
        priority: t.priority,
      }));

      const actItems: DueItem[] = Array.from(byId.values()).map((a: any) => ({
        id: a.id,
        source: "activity" as const,
        title: a.subject || a.activity_type || "Activity",
        due: a.scheduled_at || a.next_action_date,
        isCompleted: !!a.completed_at,
        contactId: a.contact_id,
        contactName: ownedById.get(a.contact_id)?.name ?? null,
        priority: a.priority,
      }));

      return [...taskItems, ...actItems]
        .filter((i) => !i.isCompleted)
        .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
    },
    enabled: !!effectiveOrgId && !!userId,
  });

  const completeMutation = useMutation({
    mutationFn: async (item: DueItem) => {
      if (item.source === "task") {
        const { error } = await supabase.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contact_activities").update({ completed_at: new Date().toISOString() }).eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      notify.success("Marked complete", "");
      queryClient.invalidateQueries({ queryKey: ["due-today"] });
    },
    onError: (err: any) => notify.error("Error", err.message ?? String(err)),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          Due Today
          {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing on the list today. </p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={`${it.source}-${it.id}`}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{it.title}</span>
                    {it.priority && it.priority !== "normal" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {it.priority}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                      {it.source}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(it.due), "h:mm a")}
                    </span>
                    {it.contactName && <span className="truncate">· {it.contactName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {it.contactId && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => navigate(`/contacts/${it.contactId}`)}
                      title="Open contact"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate(it)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Done
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
