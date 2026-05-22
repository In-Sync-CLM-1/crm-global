import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";

interface OrgContextType {
  userOrgId: string | null;
  effectiveOrgId: string | null;
  isPlatformAdmin: boolean;
  isLoading: boolean;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

interface OrgContextProviderProps {
  children: ReactNode;
}

/**
 * Centralized Org Context Provider - Single source of truth for org context
 * Uses AuthProvider's session to trigger org fetch
 */
export function OrgContextProvider({ children }: OrgContextProviderProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch profile data when user changes
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setUserOrgId(null);
      setIsPlatformAdmin(false);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const fetchProfile = async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("org_id, is_platform_admin")
          .eq("id", user.id)
          .single();

        if (!mounted) return;

        if (error) {
          console.error("[OrgContext] Failed to fetch profile:", error);
          setIsLoading(false);
          return;
        }

        setUserOrgId(profile?.org_id || null);
        setIsPlatformAdmin(profile?.is_platform_admin || false);
      } catch (err) {
        console.error("[OrgContext] Error fetching profile:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  const value: OrgContextType = {
    userOrgId,
    effectiveOrgId: userOrgId,
    isPlatformAdmin,
    isLoading: authLoading || isLoading,
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrgContextProvider() {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error("useOrgContextProvider must be used within an OrgContextProvider");
  }
  return context;
}
