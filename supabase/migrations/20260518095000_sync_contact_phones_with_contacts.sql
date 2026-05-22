-- The CRM has two phone storage locations that were drifting out of sync:
--   * contacts.phone           — used by Click-to-Call, WhatsApp send, OTP, reminders
--   * public.contact_phones    — the multi-phone widget in the Edit Contact dialog
-- This migration backfills orphan contacts and keeps the two in lockstep via a
-- trigger, so any edit through either path immediately propagates.

-- 1) Backfill primary contact_phones row for any contact that has a phone but
--    no row in contact_phones (e.g. seeded leads, imports that bypassed the UI).
INSERT INTO public.contact_phones (contact_id, org_id, phone, phone_type, is_primary)
SELECT c.id, c.org_id, c.phone, 'mobile', TRUE
  FROM public.contacts c
  LEFT JOIN public.contact_phones cp ON cp.contact_id = c.id
 WHERE c.phone IS NOT NULL AND c.phone <> '' AND cp.id IS NULL;

-- 2) Sync trigger: whenever contact_phones changes, update contacts.phone to
--    reflect the primary entry (or the oldest remaining entry if no primary).
CREATE OR REPLACE FUNCTION public.sync_contacts_primary_phone()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contact_id UUID;
  v_primary TEXT;
BEGIN
  v_contact_id := COALESCE(NEW.contact_id, OLD.contact_id);

  SELECT phone INTO v_primary
    FROM public.contact_phones
   WHERE contact_id = v_contact_id
   ORDER BY is_primary DESC, created_at ASC
   LIMIT 1;

  UPDATE public.contacts
     SET phone = v_primary, updated_at = NOW()
   WHERE id = v_contact_id
     AND phone IS DISTINCT FROM v_primary;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS contact_phones_sync_to_contact ON public.contact_phones;
CREATE TRIGGER contact_phones_sync_to_contact
AFTER INSERT OR UPDATE OR DELETE ON public.contact_phones
FOR EACH ROW EXECUTE FUNCTION public.sync_contacts_primary_phone();
