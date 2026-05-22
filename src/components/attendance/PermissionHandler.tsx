import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Camera, MapPin, AlertCircle, CheckCircle2 } from "lucide-react";

interface PermissionStatus {
  camera: "prompt" | "granted" | "denied";
  location: "prompt" | "granted" | "denied";
}

interface PermissionHandlerProps {
  onPermissionsGranted: () => void;
}

export function PermissionHandler({ onPermissionsGranted }: PermissionHandlerProps) {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: "prompt",
    location: "prompt",
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkPermissions = async () => {
    setIsChecking(true);
    try {
      const cameraStatus = await navigator.permissions.query({ name: "camera" as PermissionName });
      const locationStatus = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      setPermissions({
        camera: cameraStatus.state as PermissionStatus["camera"],
        location: locationStatus.state as PermissionStatus["location"],
      });
      if (cameraStatus.state === "granted" && locationStatus.state === "granted") {
        onPermissionsGranted();
      }
    } finally {
      setIsChecking(false);
    }
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissions((p) => ({ ...p, camera: "granted" }));
      await checkPermissions();
    } catch {
      setPermissions((p) => ({ ...p, camera: "denied" }));
    }
  };

  const requestLocation = async () => {
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      setPermissions((p) => ({ ...p, location: "granted" }));
      await checkPermissions();
    } catch {
      setPermissions((p) => ({ ...p, location: "denied" }));
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  if (permissions.camera === "granted" && permissions.location === "granted") return null;

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Attendance requires camera and location access.</AlertDescription>
      </Alert>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5" />
            <div>
              <p className="font-medium">Camera Access</p>
              <p className="text-sm text-muted-foreground">Required for photo capture</p>
            </div>
          </div>
          {permissions.camera === "granted" ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Button onClick={requestCamera} size="sm" disabled={isChecking}>
              {permissions.camera === "denied" ? "Retry" : "Grant"}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5" />
            <div>
              <p className="font-medium">Location Access</p>
              <p className="text-sm text-muted-foreground">Required for GPS verification</p>
            </div>
          </div>
          {permissions.location === "granted" ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Button onClick={requestLocation} size="sm" disabled={isChecking}>
              {permissions.location === "denied" ? "Retry" : "Grant"}
            </Button>
          )}
        </div>
      </div>
      {(permissions.camera === "denied" || permissions.location === "denied") && (
        <Alert variant="destructive">
          <AlertDescription>
            Some permissions were denied. Enable them in browser settings to continue.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
