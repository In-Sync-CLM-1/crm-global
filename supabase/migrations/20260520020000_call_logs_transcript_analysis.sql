-- Transcript + analysis columns on call_logs
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS transcript_status TEXT,
  ADD COLUMN IF NOT EXISTS transcript_error TEXT,
  ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS analysis_summary TEXT,
  ADD COLUMN IF NOT EXISTS analysis_tone TEXT,
  ADD COLUMN IF NOT EXISTS analysis_script_adherence TEXT,
  ADD COLUMN IF NOT EXISTS analysis_objections JSONB,
  ADD COLUMN IF NOT EXISTS analysis_next_step TEXT,
  ADD COLUMN IF NOT EXISTS analysis_quality_score INT,
  ADD COLUMN IF NOT EXISTS analysis_status TEXT,
  ADD COLUMN IF NOT EXISTS analysis_error TEXT,
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_call_logs_needs_transcript
  ON public.call_logs (org_id, created_at)
  WHERE r2_key IS NOT NULL AND transcript IS NULL;
