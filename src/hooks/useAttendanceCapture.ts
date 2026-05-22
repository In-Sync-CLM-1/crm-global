import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrgContext } from "@/hooks/useOrgContext";

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  city?: string;
  state?: string;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  timestamp: string;
}

interface AttendanceCaptureData {
  photo: Blob;
  photoDataUrl: string;
  location: LocationData;
  deviceInfo: DeviceInfo;
  networkStatus: string;
}

const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function useAttendanceCapture() {
  const { effectiveOrgId } = useOrgContext();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedData, setCapturedData] = useState<Partial<AttendanceCaptureData>>({});

  const getDeviceInfo = (): DeviceInfo => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timestamp: new Date().toISOString(),
  });

  const uploadPhoto = async (
    photoBlob: Blob,
    userId: string,
    type: "sign_in" | "sign_out"
  ): Promise<string> => {
    const fileName = `${userId}/${todayLocal()}/${type}_${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, photoBlob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("attendance-photos").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const markAttendance = async (
    type: "sign_in" | "sign_out",
    userId: string,
    attendanceRecordId?: string
  ) => {
    if (!capturedData.photo || !capturedData.location) {
      toast.error("Please capture photo and location first");
      return;
    }
    if (!effectiveOrgId) {
      toast.error("No organization context");
      return;
    }

    setIsCapturing(true);
    try {
      const deviceInfo = getDeviceInfo();
      const networkStatus = navigator.onLine ? "online" : "offline";
      const photoUrl = await uploadPhoto(capturedData.photo, userId, type);

      const data: Record<string, any> = {
        [`${type}_time`]: new Date().toISOString(),
        [`${type}_photo_url`]: photoUrl,
        [`${type}_location_accuracy`]: capturedData.location.accuracy,
        [`${type}_location_city`]: capturedData.location.city ?? null,
        [`${type}_location_state`]: capturedData.location.state ?? null,
        [`${type}_device_info`]: deviceInfo,
        location_lat: capturedData.location.latitude,
        location_lng: capturedData.location.longitude,
        network_status: networkStatus,
        sync_status: "synced",
      };

      if (type === "sign_in") {
        data.org_id = effectiveOrgId;
        data.user_id = userId;
        data.date = todayLocal();
        data.status = "present";
        const { error } = await supabase.from("attendance_records").insert(data as any);
        if (error) throw error;
      } else {
        if (!attendanceRecordId) throw new Error("Attendance record ID required for sign out");
        const { error } = await supabase
          .from("attendance_records")
          .update(data as any)
          .eq("id", attendanceRecordId);
        if (error) throw error;
      }

      toast.success(`${type === "sign_in" ? "Signed in" : "Signed out"} successfully!`);
      setCapturedData({});
    } catch (err: any) {
      toast.error("Failed to mark attendance: " + err.message);
    } finally {
      setIsCapturing(false);
    }
  };

  return { capturedData, setCapturedData, isCapturing, markAttendance };
}
