-- =============================================================================
-- WALLET-FLOOR APP LOCK (platform-wide policy extension)
--
-- Extends the existing "no money, no service" lockout (see
-- 20260530120000_billing_access_enforcement.sql) so that an EXTERNAL org whose
-- wallet has dropped to/below its ₹500 reserve is locked out of the app the same
-- way an overdue org is: login still works, but the only reachable thing is the
-- billing/pay screen. Paying the wallet back above the reserve auto-restores
-- access (the lock is a live computation, no cron needed).
--
-- Before this change, hitting the wallet floor only blocked paid actions
-- (AI calls, WhatsApp, email, SMS) while the rest of the app stayed usable.
--
-- Threshold note: locked when wallet_balance <= wallet_minimum_balance — the
-- SAME threshold the paid-action gate already uses (it allows only when
-- balance > reserve). This keeps "app locked" and "actions blocked" in lockstep,
-- so there is no in-between state where the app is open but nothing works.
--
-- Internal/demo orgs (is_internal = true) remain exempt. Platform admins bypass.
-- =============================================================================

-- 1. Lock helper now also fires on the wallet floor -------------------------
CREATE OR REPLACE FUNCTION public.is_org_locked(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_subscriptions s
    JOIN public.organizations o ON o.id = s.org_id
    WHERE s.org_id = _org_id
      AND coalesce(o.is_internal, false) = false
      AND (
        -- non-payment of the subscription itself (> 2 days overdue)
        s.subscription_status IN ('suspended_locked', 'cancelled')
        -- OR the wallet has hit/breached its reserve floor
        OR coalesce(s.wallet_balance, 0) <= coalesce(s.wallet_minimum_balance, 0)
      )
  )
$$;

-- 2. Caller-scoped lock check for the frontend ------------------------------
-- Returns whether the CURRENT user's org is locked, deriving the org from the
-- caller (no _org_id argument → no way to probe other orgs' lock state). Uses
-- the unlocked org lookup so it keeps working even once the org is locked.
CREATE OR REPLACE FUNCTION public.is_current_org_locked()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_org_locked(public.get_user_org_id_unlocked(auth.uid()))
$$;

GRANT EXECUTE ON FUNCTION public.is_current_org_locked() TO authenticated;
