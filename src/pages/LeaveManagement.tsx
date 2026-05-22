import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Plus, Calendar, Briefcase, Clock, Baby, X, Loader2, AlertTriangle, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { useOrgContext } from "@/hooks/useOrgContext";

interface SandwichLeaveResult {
  requested_days: number;
  weekend_days: number;
  holiday_days: number;
  total_deduction: number;
  has_sandwich: boolean;
  weekend_dates: string[];
  holiday_dates: string[];
}

const LEAVE_TYPES = [
  { value: "casual_leave", label: "Casual Leave", icon: Calendar, color: "text-blue-500", balanceKey: "casual_leave_balance", limitKey: "casual_leave_limit" },
  { value: "sick_leave", label: "Sick Leave", icon: HeartPulse, color: "text-red-500", balanceKey: "sick_leave_balance", limitKey: "sick_leave_limit" },
  { value: "earned_leave", label: "Earned Leave", icon: Briefcase, color: "text-green-500", balanceKey: "earned_leave_balance", limitKey: "earned_leave_limit" },
  { value: "compensatory_off", label: "Comp Off", icon: Clock, color: "text-purple-500", balanceKey: "compensatory_off_balance", limitKey: "compensatory_off_limit" },
  { value: "maternity_leave", label: "Maternity Leave", icon: Baby, color: "text-pink-500", balanceKey: "maternity_leave_balance", limitKey: "maternity_leave_limit" },
  { value: "paternity_leave", label: "Paternity Leave", icon: Baby, color: "text-cyan-500", balanceKey: "paternity_leave_balance", limitKey: "paternity_leave_limit" },
  { value: "unpaid_leave", label: "Unpaid Leave", icon: Calendar, color: "text-gray-500", balanceKey: "", limitKey: "" },
];

export default function LeaveManagement() {
  const [open, setOpen] = useState(false);
  const [sandwich, setSandwich] = useState<SandwichLeaveResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: "",
    start_date: "",
    end_date: "",
    total_days: "",
    reason: "",
  });
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const { effectiveOrgId } = useOrgContext();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: leaveBalance } = useQuery({
    queryKey: ["leave-balance", user?.id, currentYear],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", currentYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ["leave-applications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("leave_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const applyMut = useMutation({
    mutationFn: async (d: typeof formData) => {
      if (!user?.id || !effectiveOrgId) throw new Error("Missing user/org");
      const { data, error } = await supabase
        .from("leave_applications")
        .insert({
          org_id: effectiveOrgId,
          user_id: user.id,
          leave_type: d.leave_type as any,
          start_date: d.start_date,
          end_date: d.end_date,
          total_days: parseFloat(d.total_days),
          reason: d.reason,
          sandwich_days: sandwich?.has_sandwich ? sandwich.weekend_days + sandwich.holiday_days : 0,
          leave_calculation: sandwich as any,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (created: any) => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      setOpen(false);
      setFormData({ leave_type: "", start_date: "", end_date: "", total_days: "", reason: "" });
      setSandwich(null);
      toast.success("Leave application submitted!");
      try {
        if (created?.id) {
          await supabase.functions.invoke("send-approval-email", {
            body: { request_type: "leave", request_id: created.id },
          });
        }
      } catch (e) {
        console.error("send-approval-email failed", e);
      }
    },
    onError: (e: Error) => toast.error("Failed to submit leave: " + e.message),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("leave_applications")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      toast.success("Leave cancelled!");
    },
    onError: (e: Error) => toast.error("Failed to cancel: " + e.message),
  });

  const handleDateChange = async (field: "start_date" | "end_date", value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    if (next.start_date && next.end_date && next.end_date >= next.start_date) {
      setCalculating(true);
      try {
        const { data, error } = await (supabase.rpc as any)("calculate_sandwich_leave_days", {
          p_start_date: next.start_date,
          p_end_date: next.end_date,
          p_user_id: user?.id,
        });
        if (error) throw error;
        const r = data as SandwichLeaveResult;
        setSandwich(r);
        setFormData((p) => ({ ...p, total_days: String(r.total_deduction) }));
      } catch (e) {
        console.error(e);
      } finally {
        setCalculating(false);
      }
    }
  };

  const balance = (k: string) => (leaveBalance && k ? (leaveBalance as any)[k] || 0 : 0);
  const limit = (k: string) => (leaveBalance && k ? (leaveBalance as any)[k] || 0 : 0);
  const lowBalance = (b: number, l: number) => l > 0 && b <= 2;

  const statusBadge = (s: string) => {
    const v: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      cancelled: "outline",
    };
    return <Badge variant={v[s] || "default"}>{s.toUpperCase()}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leave Management</h1>
            <p className="text-muted-foreground">Apply for leave and track your applications</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Apply for Leave
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {LEAVE_TYPES.filter((t) => t.balanceKey).map((t) => {
            const Icon = t.icon;
            const b = balance(t.balanceKey);
            const l = limit(t.limitKey);
            const low = lowBalance(b, l);
            const none = !leaveBalance;
            return (
              <Card key={t.value} className={low ? "border-destructive" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${t.color}`} />
                    <span className="text-sm font-medium truncate">{t.label}</span>
                  </div>
                  <div className={`text-3xl font-bold ${low ? "text-destructive" : ""}`}>
                    {none ? "-" : b} <span className="text-lg font-normal text-muted-foreground">/ {none ? "-" : l}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{none ? "No record" : low ? "Low balance!" : "days remaining"}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              My Leave Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {applications?.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{LEAVE_TYPES.find((t) => t.value === a.leave_type)?.label || a.leave_type}</span>
                        {statusBadge(a.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(a.start_date), "MMM d")} – {format(new Date(a.end_date), "MMM d, yyyy")} ({a.total_days} days)
                      </div>
                      {a.reason && <div className="text-sm mt-1">{a.reason}</div>}
                    </div>
                    {a.status === "pending" && (
                      <Button variant="ghost" size="sm" onClick={() => cancelMut.mutate(a.id)} disabled={cancelMut.isPending}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {!applications?.length && <div className="text-center py-8 text-muted-foreground">No leave applications yet</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="overflow-visible">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); applyMut.mutate(formData); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select value={formData.leave_type} onValueChange={(v) => setFormData({ ...formData, leave_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((t) => {
                      const b = balance(t.balanceKey);
                      const l = limit(t.limitKey);
                      return (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label} {t.balanceKey ? `(${b}/${l || "-"} available)` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={formData.start_date} onChange={(e) => handleDateChange("start_date", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={formData.end_date} min={formData.start_date} onChange={(e) => handleDateChange("end_date", e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Total Days {calculating && <Loader2 className="h-3 w-3 inline animate-spin ml-1" />}</Label>
                <Input type="number" step="0.5" value={formData.total_days} onChange={(e) => setFormData({ ...formData, total_days: e.target.value })} placeholder="e.g., 1, 0.5 for half day" required />
                {sandwich?.has_sandwich && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">Sandwich Leave Policy Applied</p>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        {sandwich.requested_days} working + {sandwich.weekend_days} weekend + {sandwich.holiday_days} holiday = <strong>{sandwich.total_deduction} total days</strong>
                      </p>
                    </div>
                  </div>
                )}
                {!sandwich?.has_sandwich && formData.start_date && formData.end_date && (
                  <p className="text-xs text-muted-foreground">Weekends and holidays are excluded from deduction</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Enter reason for leave" required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={applyMut.isPending}>{applyMut.isPending ? "Submitting…" : "Submit Application"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
