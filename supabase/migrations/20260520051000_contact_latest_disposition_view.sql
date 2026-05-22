-- Per-contact view of the most recent call disposition.
-- Used by the pipeline table (filter + column) so filtering works across all
-- pages, not just the rows currently loaded.
CREATE OR REPLACE VIEW public.contact_latest_disposition AS
SELECT DISTINCT ON (cl.contact_id)
  cl.org_id,
  cl.contact_id,
  cl.id          AS call_log_id,
  cl.disposition_id,
  d.name         AS disposition_name,
  d.category     AS disposition_category,
  cl.created_at  AS dispositioned_at
FROM public.call_logs cl
LEFT JOIN public.call_dispositions d ON d.id = cl.disposition_id
WHERE cl.contact_id IS NOT NULL
  AND cl.disposition_id IS NOT NULL
ORDER BY cl.contact_id, cl.created_at DESC;

GRANT SELECT ON public.contact_latest_disposition TO authenticated;
