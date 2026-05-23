-- IEDUP UI scaffolding: org settings, Devanagari name column, WhatsApp logs,
-- corrected pricing, and seed rows for the IEDUP org.

-- 1. Per-org operational settings (dialer on/off + calling windows)
CREATE TABLE IF NOT EXISTS public.organization_settings (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  dialing_active BOOLEAN NOT NULL DEFAULT false,
  calling_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view settings" ON public.organization_settings;
CREATE POLICY "Org members view settings"
  ON public.organization_settings FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Org members update settings" ON public.organization_settings;
CREATE POLICY "Org members update settings"
  ON public.organization_settings FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Org members insert settings" ON public.organization_settings;
CREATE POLICY "Org members insert settings"
  ON public.organization_settings FOR INSERT
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Service role manages settings" ON public.organization_settings;
CREATE POLICY "Service role manages settings"
  ON public.organization_settings FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins manage settings" ON public.organization_settings;
CREATE POLICY "Platform admins manage settings"
  ON public.organization_settings FOR ALL
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- 2. Devanagari name column for IEDUP-style outbound calling
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS name_hi TEXT;

-- 3. WhatsApp send log (drives dashboard Message summary + delivery audit)
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  call_log_id UUID REFERENCES public.call_logs(id) ON DELETE SET NULL,
  to_number TEXT NOT NULL,
  template_name TEXT,
  language_code TEXT,
  body_params JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  exotel_msg_sid TEXT,
  error_text TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cost_charged NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_logs_org ON public.whatsapp_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_logs_call ON public.whatsapp_logs(call_log_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_status ON public.whatsapp_logs(org_id, status);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view wa logs" ON public.whatsapp_logs;
CREATE POLICY "Org members view wa logs"
  ON public.whatsapp_logs FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Service role manages wa logs" ON public.whatsapp_logs;
CREATE POLICY "Service role manages wa logs"
  ON public.whatsapp_logs FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins manage wa logs" ON public.whatsapp_logs;
CREATE POLICY "Platform admins manage wa logs"
  ON public.whatsapp_logs FOR ALL
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- 4. Correct pricing on the active subscription_pricing row
-- AI calls Rs 3/min (was 2), WhatsApp utility Rs 0.20/msg (was 0.50)
UPDATE public.subscription_pricing
SET call_cost_per_minute = 3,
    whatsapp_cost_per_unit = 0.20,
    updated_at = NOW()
WHERE is_active = true;

-- If no active pricing row exists, create one with our values
INSERT INTO public.subscription_pricing (
  one_time_setup_cost, per_user_monthly_cost, min_wallet_balance,
  email_cost_per_unit, whatsapp_cost_per_unit, call_cost_per_minute,
  auto_topup_amount, auto_topup_enabled, gst_percentage, is_active
)
SELECT 2000, 799, 500, 1, 0.20, 3, 5000, true, 18, true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_pricing WHERE is_active = true);

-- 5. Seed organization_settings for IEDUP + In-Sync Demo
INSERT INTO public.organization_settings (org_id, dialing_active, calling_windows)
VALUES
  -- IEDUP — default windows mirror Riya for now; dialing OFF until Vibhu starts it
  ('6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d',
   false,
   '[{"start_min": 660, "end_min": 810}, {"start_min": 900, "end_min": 1020}]'::jsonb),
  -- In-Sync Demo — keep Riya windows ON so existing behaviour is preserved
  ('61f7f96d-e80c-4d9b-a765-8eb32bd3c70d',
   true,
   '[{"start_min": 660, "end_min": 810}, {"start_min": 900, "end_min": 1020}]'::jsonb)
ON CONFLICT (org_id) DO NOTHING;

-- 6. Seed IEDUP ai_call_scripts row pointing at the existing Bolna agent
--    (agent already configured in Bolna with full Hindi prompt; we only need a
--    row so the dispatcher can find it and queue calls.)
INSERT INTO public.ai_call_scripts (
  org_id, name, objective, opening, key_points, objection_handling, closing,
  product_name, voice_id, voice_name, language, max_duration_seconds,
  is_active, bolna_agent_id
)
SELECT
  '6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d',
  'IEDUP CM YUVA — EDP Notifier',
  'Notify CM YUVA loan-approved beneficiaries about the EDP training programme.',
  'नमस्ते, मैं विद्या बोल रही हूं।',
  '[]'::jsonb,
  '{}'::jsonb,
  NULL,
  'CM YUVA',
  'gHu9GtaHOXcSqFTK06ux',
  'Anjali - Soothing Hindi Voice',
  'hi',
  300,
  true,
  '0c516cc8-64f6-402b-ae13-a402d2de8ece'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_call_scripts
  WHERE org_id = '6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d'
    AND name = 'IEDUP CM YUVA — EDP Notifier'
);

-- 7. Seed sample IEDUP beneficiary: Vibhu Dixit
INSERT INTO public.contacts (
  org_id, first_name, last_name, name_hi, phone, product, created_at, updated_at
)
SELECT
  '6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d',
  'Vibhu',
  'Dixit',
  'विभु दीक्षित',
  '+917607359820',
  'CM YUVA',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.contacts
  WHERE org_id = '6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d'
    AND phone = '+917607359820'
);

-- 8. Ensure organization_subscriptions row exists for IEDUP (14-day trial)
INSERT INTO public.organization_subscriptions (
  org_id, subscription_status, billing_cycle_start, next_billing_date,
  user_count, monthly_subscription_amount, wallet_balance, wallet_minimum_balance
)
SELECT
  '6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d',
  'active',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '14 days',
  1,
  0,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_subscriptions
  WHERE org_id = '6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d'
);
