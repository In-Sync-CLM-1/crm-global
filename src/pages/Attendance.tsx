import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogOut, Calendar, Camera, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { AttendanceCapture } from "@/components/attendance/AttendanceCapture";
import { AttendanceRegularizationDialog } from "@/components/attendance/AttendanceRegularizationDialog";
import { MyRegularizationRequests } from "@/components/attendance/MyRegularizationRequests";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Attendance() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCapture, setShowCapture] = useState(false);
  const [showReg, setShowReg] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: todayAttendance, isLoading: loadingToday } = useQuery({
    queryKey: ["attendance-today", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", todayLocal())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: monthlyStats } = useQuery({
    queryKey: ["attendance-monthly", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const start = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const end = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end);
      if (error) throw error;
      const present = data?.filter((r: any) => r.status === "present").length || 0;
      const halfDay = data?.filter((r: any) => r.status === "half_day").length || 0;
      const totalHours = data?.reduce((s: number, r: any) => s + (Number(r.total_hours) || 0), 0) || 0;
      return { present, halfDay, totalHours, total: data?.length || 0 };
    },
    enabled: !!user?.id,
  });

  const signOutMut = useMutation({
    mutationFn: async () => {
      if (!todayAttendance?.id || !todayAttendance.sign_in_time) throw new Error("No attendance record");
      const signOut = new Date().toISOString();
      const totalHours = (new Date().getTime() - new Date(todayAttendance.sign_in_time).getTime()) / 3600000;
      const { error } = await supabase
        .from("attendance_records")
        .update({ sign_out_time: signOut, total_hours: totalHours })
        .eq("id", todayAttendance.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Signed out successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
    },
    onError: (e: Error) => toast.error("Failed to sign out: " + e.message),
  });

  const fmtTime = (t: string | null) =>
    t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A";

  const calcWorked = () => {
    if (!todayAttendance?.sign_in_time) return "00:00:00";
    const inT = new Date(todayAttendance.sign_in_time);
    const now = todayAttendance.sign_out_time ? new Date(todayAttendance.sign_out_time) : new Date();
    const diff = now.getTime() - inT.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const statusBadge = (status: string) => {
    const v: Record<string, "default" | "secondary" | "destructive"> = {
      present: "default",
      half_day: "secondary",
      absent: "destructive",
    };
    return <Badge variant={v[status] || "default"}>{(status || "").replace("_", " ").toUpperCase()}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Attendance</h1>
            <p className="text-muted-foreground">Track your daily attendance</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setShowReg(true)}>
              <FileEdit className="mr-2 h-4 w-4" />
              Request Regularization
            </Button>
            <div className="text-right">
              <div className="text-2xl font-bold">{format(currentTime, "HH:mm:ss")}</div>
              <div className="text-sm text-muted-foreground">{format(currentTime, "EEEE, MMMM d, yyyy")}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Today's Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingToday ? (
                <div>Loading…</div>
              ) : !todayAttendance ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground">You haven't signed in today</p>
                  <Button onClick={() => setShowCapture(true)} size="lg" className="w-full">
                    <Camera className="mr-2 h-5 w-5" />
                    Check In with Photo & GPS
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {statusBadge(todayAttendance.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Sign In:</span>
                    <span className="font-semibold">{fmtTime(todayAttendance.sign_in_time)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Sign Out:</span>
                    <span className="font-semibold">{fmtTime(todayAttendance.sign_out_time)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Hours Worked:</span>
                    <span className="font-semibold text-lg">{todayAttendance.total_hours?.toFixed(2) || calcWorked()}</span>
                  </div>
                  {!todayAttendance.sign_out_time && (
                    <Button
                      onClick={() => signOutMut.mutate()}
                      disabled={signOutMut.isPending}
                      size="lg"
                      className="w-full"
                      variant="destructive"
                    >
                      <LogOut className="mr-2 h-5 w-5" />
                      {signOutMut.isPending ? "Signing Out…" : "Check Out"}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Monthly Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Present Days:</span>
                  <span className="font-semibold text-lg">{monthlyStats?.present || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Half Days:</span>
                  <span className="font-semibold text-lg">{monthlyStats?.halfDay || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Days:</span>
                  <span className="font-semibold text-lg">{monthlyStats?.total || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Hours:</span>
                  <span className="font-semibold text-lg">{monthlyStats?.totalHours.toFixed(2) || "0.00"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <MyRegularizationRequests />

        <Dialog open={showCapture} onOpenChange={setShowCapture}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {user && (
              <AttendanceCapture
                type="sign_in"
                userId={user.id}
                onComplete={() => {
                  setShowCapture(false);
                  queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
                  queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
                }}
                onCancel={() => setShowCapture(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        <AttendanceRegularizationDialog open={showReg} onOpenChange={setShowReg} />
      </div>
    </DashboardLayout>
  );
}
