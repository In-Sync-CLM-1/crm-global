-- AI calling schema: scripts + caller_type tag on call_logs

CREATE TABLE IF NOT EXISTS public.ai_call_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  opening TEXT NOT NULL,
  key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  objection_handling JSONB NOT NULL DEFAULT '{}'::jsonb,
  closing TEXT,
  product_name TEXT,
  product_notes TEXT,
  voice_id TEXT DEFAULT 'vYENaCJHl4vFKNDYPr8y',
  voice_name TEXT DEFAULT 'Riya Rao - Professional Voice',
  language TEXT DEFAULT 'en',
  max_duration_seconds INT DEFAULT 240,
  is_active BOOLEAN DEFAULT true,
  bolna_agent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_call_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read ai_call_scripts" ON public.ai_call_scripts;
CREATE POLICY "Org members read ai_call_scripts"
  ON public.ai_call_scripts FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Service role manages ai_call_scripts" ON public.ai_call_scripts;
CREATE POLICY "Service role manages ai_call_scripts"
  ON public.ai_call_scripts FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_call_scripts_org_active
  ON public.ai_call_scripts (org_id, is_active);

-- Extend call_logs to support AI-dialed calls
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS caller_type TEXT NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS ai_script_id UUID REFERENCES public.ai_call_scripts(id),
  ADD COLUMN IF NOT EXISTS bolna_execution_id TEXT,
  ADD COLUMN IF NOT EXISTS bolna_batch_id UUID,
  ADD COLUMN IF NOT EXISTS bolna_queue_position INT;

CREATE INDEX IF NOT EXISTS idx_call_logs_caller_type
  ON public.call_logs (org_id, caller_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_bolna_batch
  ON public.call_logs (bolna_batch_id, status)
  WHERE caller_type = 'ai';

CREATE INDEX IF NOT EXISTS idx_call_logs_bolna_execution
  ON public.call_logs (bolna_execution_id)
  WHERE bolna_execution_id IS NOT NULL;
