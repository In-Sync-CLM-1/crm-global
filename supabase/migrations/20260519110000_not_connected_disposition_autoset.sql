-- Adds a "Not Connected" disposition per org and backfills existing call records.
-- Used by exotel-webhook to auto-set disposition when a call is dialled but not connected
-- (status no-answer/busy/failed/canceled, or completed with 0 conversation duration).

-- 1) Insert "Not Connected" disposition for every org that doesn't already have one.
INSERT INTO public.call_dispositions (org_id, name, description, category, is_active)
SELECT o.id, 'Not Connected', 'Call dialled but not connected (no answer, busy, failed, or cancelled)', 'neutral', true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.call_dispositions d
  WHERE d.org_id = o.id AND d.name = 'Not Connected'
);

-- 2) Add "Not Connected" to the default-dispositions seed function so future orgs get it.
CREATE OR REPLACE FUNCTION public.create_default_call_dispositions(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _interested_id UUID;
  _not_interested_id UUID;
  _callback_id UUID;
  _no_answer_id UUID;
BEGIN
  INSERT INTO public.call_dispositions (org_id, name, description, category) VALUES
    (_org_id, 'Interested', 'Customer showed interest', 'positive')
    RETURNING id INTO _interested_id;

  INSERT INTO public.call_dispositions (org_id, name, description, category) VALUES
    (_org_id, 'Not Interested', 'Customer not interested', 'negative')
    RETURNING id INTO _not_interested_id;

  INSERT INTO public.call_dispositions (org_id, name, description, category) VALUES
    (_org_id, 'Callback Requested', 'Customer requested callback', 'follow_up')
    RETURNING id INTO _callback_id;

  INSERT INTO public.call_dispositions (org_id, name, description, category) VALUES
    (_org_id, 'No Answer', 'No one answered the call', 'neutral')
    RETURNING id INTO _no_answer_id;

  INSERT INTO public.call_dispositions (org_id, name, description, category) VALUES
    (_org_id, 'Wrong Number', 'Incorrect contact number', 'neutral'),
    (_org_id, 'Voicemail', 'Left voicemail message', 'neutral'),
    (_org_id, 'Do Not Call', 'Customer requested no more calls', 'negative'),
    (_org_id, 'Not Connected', 'Call dialled but not connected (no answer, busy, failed, or cancelled)', 'neutral');

  INSERT INTO public.call_sub_dispositions (disposition_id, org_id, name, description) VALUES
    (_interested_id, _org_id, 'Ready to Buy', 'Customer ready to purchase'),
    (_interested_id, _org_id, 'Needs More Info', 'Interested but needs details'),
    (_interested_id, _org_id, 'Budget Approval', 'Needs budget approval'),
    (_not_interested_id, _org_id, 'Too Expensive', 'Price is too high'),
    (_not_interested_id, _org_id, 'No Need', 'Doesn''t need the product'),
    (_not_interested_id, _org_id, 'Using Competitor', 'Already using competitor'),
    (_callback_id, _org_id, 'Specific Time', 'Call at specific time'),
    (_callback_id, _org_id, 'After Decision', 'Call after internal decision'),
    (_no_answer_id, _org_id, 'Busy', 'Line was busy'),
    (_no_answer_id, _org_id, 'No Pickup', 'Phone rang but no pickup');
END;
$$;

-- 3) Backfill call_logs that have no disposition and whose status indicates "not connected".
WITH nc AS (
  SELECT org_id, id AS disposition_id
  FROM public.call_dispositions
  WHERE name = 'Not Connected'
)
UPDATE public.call_logs cl
SET disposition_id = nc.disposition_id
FROM nc
WHERE cl.org_id = nc.org_id
  AND cl.disposition_id IS NULL
  AND (
    LOWER(cl.status) IN ('no-answer', 'busy', 'failed', 'canceled', 'cancelled')
    OR (LOWER(cl.status) = 'completed' AND COALESCE(cl.conversation_duration, 0) = 0)
  );

-- 4) Backfill the linked contact_activities rows so the activity feed matches.
WITH nc AS (
  SELECT org_id, id AS disposition_id
  FROM public.call_dispositions
  WHERE name = 'Not Connected'
)
UPDATE public.contact_activities ca
SET call_disposition_id = nc.disposition_id
FROM public.call_logs cl
JOIN nc ON nc.org_id = cl.org_id
WHERE ca.id = cl.activity_id
  AND cl.disposition_id = nc.disposition_id
  AND ca.call_disposition_id IS NULL;
