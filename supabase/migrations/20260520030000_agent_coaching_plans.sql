CREATE TABLE IF NOT EXISTS public.agent_coaching_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  calls_analyzed INT NOT NULL,
  avg_quality_score NUMERIC(3, 1),
  dominant_tone TEXT,
  top_objections JSONB,
  strengths JSONB,
  weaknesses JSONB,
  drills JSONB,
  role_play_scenarios JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generation_error TEXT,
  UNIQUE (org_id, agent_id)
);

ALTER TABLE public.agent_coaching_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read coaching plans"
  ON public.agent_coaching_plans FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role manages coaching plans"
  ON public.agent_coaching_plans FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_coaching_plans_org_agent
  ON public.agent_coaching_plans (org_id, agent_id);
