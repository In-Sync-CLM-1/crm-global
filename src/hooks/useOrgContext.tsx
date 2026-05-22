import { useOrgContextProvider } from "@/contexts/OrgContextProvider";

/**
 * Organization context hook for multi-tenant applications
 *
 * @returns Organization context state
 * @property {string | null} userOrgId - User's actual organization ID
 * @property {string | null} effectiveOrgId - Active org ID
 * @property {boolean} isPlatformAdmin - Whether user has platform admin privileges
 * @property {boolean} isLoading - Loading state during context initialization
 */
export function useOrgContext() {
  const context = useOrgContextProvider();

  return {
    userOrgId: context.userOrgId,
    effectiveOrgId: context.effectiveOrgId,
    isPlatformAdmin: context.isPlatformAdmin,
    isLoading: context.isLoading,
  };
}
