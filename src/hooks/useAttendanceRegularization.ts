import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrgContext } from "@/hooks/useOrgContext";

export type RegularizationType =
  | "forgot_signin"
  | "forgot_signout"
  | "time_correction"
  | "location_issue"
  | "other";

export type RegularizationStatus = "pending" | "approved" | "rejected";

export interface AttendanceRegularization {
  id: string;
  org_id: string;
  user_id: string;
  attendance_date: string;
  regularization_type: RegularizationType;
  original_sign_in_time: string | null;
  original_sign_out_time: string | null;
  requested_sign_in_time: string | null;
  requested_sign_out_time: string | null;
  reason: string;
  status: RegularizationStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegularizationWithProfile extends AttendanceRegularization {
  profile?: { id: string; first_name: string | null; last_name: string | null; email: string | null };
}

export interface CreateRegularizationInput {
  attendance_date: string;
  regularization_type: RegularizationType;
  original_sign_in_time?: string | null;
  original_sign_out_time?: string | null;
  requested_sign_in_time?: string | null;
  requested_sign_out_time?: string | null;
  reason: string;
}

export function useAttendanceRegularization() {
  const queryClient = useQueryClient();
  const { effectiveOrgId } = useOrgContext();

  const { data: user } = useQuery({
    queryKey: ["user"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: canApprove } = useQuery({
    queryKey: ["can-approve-hr", user?.id, effectiveOrgId],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id || !effectiveOrgId) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("org_id", effectiveOrgId);
      return !!data?.some((r: any) => r.role === "admin" || r.role === "super_admin");
    },
    enabled: !!user?.id && !!effectiveOrgId,
  });

  const { data: myRegularizations, isLoading: loadingMyRegularizations } = useQuery({
    queryKey: ["my-regularizations", user?.id],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("attendance_regularizations" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AttendanceRegularization[];
    },
    enabled: !!user?.id,
  });

  const { data: pendingRegularizations, isLoading: loadingPending } = useQuery({
    queryKey: ["pending-regularizations", effectiveOrgId],
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const { data, error } = await supabase
        .from("attendance_regularizations" as any)
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);
      return data.map((r: any) => ({
        ...r,
        profile: profiles?.find((p) => p.id === r.user_id) ?? null,
      })) as RegularizationWithProfile[];
    },
    enabled: !!effectiveOrgId && canApprove === true,
  });

  const createRegularization = useMutation({
    mutationFn: async (input: CreateRegularizationInput) => {
      if (!user?.id || !effectiveOrgId) throw new Error("Missing user/org");
      const { data, error } = await supabase
        .from("attendance_regularizations" as any)
        .insert({ org_id: effectiveOrgId, user_id: user.id, ...input })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (created: any) => {
      queryClient.invalidateQueries({ queryKey: ["my-regularizations"] });
      toast.success("Regularization request submitted!");
      try {
        if (created?.id) {
          await supabase.functions.invoke("send-approval-email", {
            body: { request_type: "regularization", request_id: created.id },
          });
        }
      } catch (e) {
        console.error("send-approval-email failed", e);
      }
    },
    onError: (e: Error) => toast.error("Failed to submit: " + e.message),
  });

  const approveRegularization = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("No user");
      const { error } = await supabase
        .from("attendance_regularizations" as any)
        .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-regularizations"] });
      queryClient.invalidateQueries({ queryKey: ["my-regularizations"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-recent"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      toast.success("Regularization approved.");
    },
    onError: (e: Error) => toast.error("Failed to approve: " + e.message),
  });

  const rejectRegularization = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (!user?.id) throw new Error("No user");
      const { error } = await supabase
        .from("attendance_regularizations" as any)
        .update({
          status: "rejected",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-regularizations"] });
      queryClient.invalidateQueries({ queryKey: ["my-regularizations"] });
      toast.success("Regularization rejected.");
    },
    onError: (e: Error) => toast.error("Failed to reject: " + e.message),
  });

  const deleteRegularization = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance_regularizations" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-regularizations"] });
      toast.success("Request deleted.");
    },
    onError: (e: Error) => toast.error("Failed to delete: " + e.message),
  });

  const getAttendanceForDate = async (date: string) => {
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  return {
    user,
    canApprove,
    myRegularizations,
    loadingMyRegularizations,
    pendingRegularizations,
    loadingPending,
    createRegularization,
    approveRegularization,
    rejectRegularization,
    deleteRegularization,
    getAttendanceForDate,
  };
}
