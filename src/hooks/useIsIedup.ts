import { useOrgContext } from "@/hooks/useOrgContext";

export const IEDUP_ORG_ID = "6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d";

export function useIsIedup(): { isIedup: boolean; isLoading: boolean; orgId: string | null } {
  const { effectiveOrgId, isLoading } = useOrgContext();
  return {
    isIedup: effectiveOrgId === IEDUP_ORG_ID,
    isLoading,
    orgId: effectiveOrgId,
  };
}
