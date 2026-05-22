import { useState } from "react";
import { PermissionHandler } from "./PermissionHandler";
import { CameraCapture } from "./CameraCapture";
import { LocationCapture } from "./LocationCapture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";
import { useAttendanceCapture } from "@/hooks/useAttendanceCapture";

interface AttendanceCaptureProps {
  type: "sign_in" | "sign_out";
  userId: string;
  attendanceRecordId?: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = "permissions" | "location" | "camera" | "review" | "submitting";

export function AttendanceCapture({ type, userId, attendanceRecordId, onComplete, onCancel }: AttendanceCaptureProps) {
  const [step, setStep] = useState<Step>("permissions");
  const { capturedData, setCapturedData, isCapturing, markAttendance } = useAttendanceCapture();
  const steps: Step[] = ["permissions", "location", "camera", "review"];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {type === "sign_in" ? "Check In" : "Check Out"}
        </CardTitle>
        <CardDescription>
          {step === "permissions" && "We need camera and location access"}
          {step === "location" && "Acquiring GPS coordinates"}
          {step === "camera" && "Take your attendance photo"}
          {step === "review" && "Verify details before submitting"}
          {step === "submitting" && "Processing your attendance"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center mb-6">
          {steps.map((s, idx) => (
            <div key={s} className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : steps.indexOf(step) > idx
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {steps.indexOf(step) > idx ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </div>
              <span className="text-xs mt-1 capitalize">{s}</span>
            </div>
          ))}
        </div>

        {step === "permissions" && <PermissionHandler onPermissionsGranted={() => setStep("location")} />}

        {step === "location" && (
          <LocationCapture
            onLocationCaptured={(location) => {
              setCapturedData((p) => ({ ...p, location }));
              setStep("camera");
            }}
          />
        )}

        {step === "camera" && (
          <CameraCapture
            onCapture={(photoBlob, photoDataUrl) => {
              setCapturedData((p) => ({ ...p, photo: photoBlob, photoDataUrl }));
              setStep("review");
            }}
          />
        )}

        {step === "review" && capturedData.location && capturedData.photoDataUrl && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Captured Photo</h3>
              <img src={capturedData.photoDataUrl} alt="Attendance" className="w-full rounded-lg border" />
            </div>
            <div>
              <h3 className="font-medium mb-2">Location Details</h3>
              <div className="text-sm space-y-1 p-3 bg-muted rounded-lg">
                {capturedData.location.city && capturedData.location.state && (
                  <p>📍 {capturedData.location.city}, {capturedData.location.state}</p>
                )}
                <p>Coordinates: {capturedData.location.latitude.toFixed(6)}, {capturedData.location.longitude.toFixed(6)}</p>
                <p>Accuracy: ±{capturedData.location.accuracy.toFixed(0)} meters</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
              <Button
                onClick={async () => {
                  setStep("submitting");
                  await markAttendance(type, userId, attendanceRecordId);
                  onComplete();
                }}
                disabled={isCapturing}
                className="flex-1"
              >
                {isCapturing ? "Submitting…" : `Submit ${type === "sign_in" ? "Check In" : "Check Out"}`}
              </Button>
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p>Processing your attendance…</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
