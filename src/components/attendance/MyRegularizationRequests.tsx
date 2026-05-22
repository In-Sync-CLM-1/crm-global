import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Clock, CheckCircle, XCircle, FileEdit } from "lucide-react";
import { useAttendanceRegularization } from "@/hooks/useAttendanceRegularization";

const LABELS: Record<string, string> = {
  forgot_signin: "Forgot Sign In",
  forgot_signout: "Forgot Sign Out",
  time_correction: "Time Correction",
  location_issue: "Location Issue",
  other: "Other",
};

const STATUS: Record<string, { variant: "default" | "secondary" | "destructive"; icon: any }> = {
  pending: { variant: "secondary", icon: Clock },
  approved: { variant: "default", icon: CheckCircle },
  rejected: { variant: "destructive", icon: XCircle },
};

export function MyRegularizationRequests({ showTitle = true }: { showTitle?: boolean }) {
  const { myRegularizations, loadingMyRegularizations, deleteRegularization } = useAttendanceRegularization();

  if (loadingMyRegularizations) return <div className="text-center py-4 text-muted-foreground">Loading…</div>;
  if (!myRegularizations?.length) return null;

  const fmtTime = (t: string | null) =>
    t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            My Regularization Requests
          </CardTitle>
          <CardDescription>Track the status of your submitted requests</CardDescription>
        </CardHeader>
      )}
      <CardContent className={showTitle ? "" : "pt-6"}>
        <div className="space-y-3">
          {myRegularizations.map((r) => {
            const cfg = STATUS[r.status];
            const StatusIcon = cfg.icon;
            const inTime = fmtTime(r.requested_sign_in_time);
            const outTime = fmtTime(r.requested_sign_out_time);
            return (
              <div key={r.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{format(parseISO(r.attendance_date), "EEE, MMM d, yyyy")}</span>
                    <Badge variant={cfg.variant} className="flex items-center gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {r.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{LABELS[r.regularization_type]}</div>
                  <div className="text-sm">
                    {inTime && <span className="mr-4">In: {inTime}</span>}
                    {outTime && <span>Out: {outTime}</span>}
                    {!inTime && !outTime && <span className="text-muted-foreground">No time specified</span>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{r.reason}</p>
                  {r.status === "rejected" && r.rejection_reason && (
                    <p className="text-xs text-destructive mt-1">Rejection reason: {r.rejection_reason}</p>
                  )}
                </div>
                {r.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteRegularization.mutate(r.id)}
                    disabled={deleteRegularization.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
