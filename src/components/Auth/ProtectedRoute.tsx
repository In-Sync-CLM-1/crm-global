import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "super_admin" | "admin" | "sales_manager" | "sales_agent" | "support_manager" | "support_agent" | "analyst";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { session, user, isLoading: authLoading } = useAuth();
  const location = useLocation();

  // Fetch profile to check onboarding status
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile-onboarding", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed, is_platform_admin")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("ProtectedRoute - Error checking profile:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Only fetch role if user is authenticated and role is required
  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("ProtectedRoute - Error checking role:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id && !!requiredRole,
    staleTime: 5 * 60 * 1000,
  });

  // Show loading while checking auth
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if no session
  if (!session || !user) {
    return <Navigate to="/login" replace />;
  }

  // Platform admin: only allow access to /platform-admin
  if (profileData?.is_platform_admin) {
    if (location.pathname !== "/platform-admin") {
      return <Navigate to="/platform-admin" replace />;
    }
    return <>{children}</>;
  }

  // Redirect to onboarding if not completed (skip if already on /onboarding)
  if (
    profileData &&
    !profileData.onboarding_completed &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  // If role is required, wait for role check
  if (requiredRole) {
    if (roleLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      );
    }

    const hasAccess = roleData?.role === "super_admin" || roleData?.role === requiredRole;

    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
