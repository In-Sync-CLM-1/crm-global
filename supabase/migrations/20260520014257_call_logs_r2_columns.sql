-- R2 migration tracking on call_logs
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS r2_key TEXT,
  ADD COLUMN IF NOT EXISTS r2_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS r2_upload_error TEXT;

CREATE INDEX IF NOT EXISTS idx_call_logs_needs_r2
  ON public.call_logs (org_id, created_at)
  WHERE recording_url IS NOT NULL AND r2_key IS NULL;
