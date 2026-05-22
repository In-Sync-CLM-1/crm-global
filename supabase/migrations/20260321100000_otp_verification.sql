-- System-level WhatsApp config for OTP (not org-scoped)
CREATE TABLE IF NOT EXISTS public.otp_whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exotel_sid TEXT NOT NULL,
  exotel_api_key TEXT NOT NULL,
  exotel_api_token TEXT NOT NULL,
  exotel_subdomain TEXT DEFAULT 'api.exotel.com',
  whatsapp_source_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- OTP verification records
CREATE TABLE IF NOT EXISTS public.public_otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('phone', 'email')),
  otp_code TEXT NOT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes'),
  verified_at TIMESTAMPTZ,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_otp_verifications_session ON public.public_otp_verifications(session_id);
CREATE INDEX idx_otp_verifications_identifier ON public.public_otp_verifications(identifier, created_at DESC);

-- RLS: otp_whatsapp_config is admin-only via service role
ALTER TABLE public.otp_whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_otp_verifications ENABLE ROW LEVEL SECURITY;

-- Service role has full access (edge functions use service role key)
CREATE POLICY "Service role full access on otp_whatsapp_config"
ON public.otp_whatsapp_config FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on public_otp_verifications"
ON public.public_otp_verifications FOR ALL
USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_otp_whatsapp_config_updated_at
BEFORE UPDATE ON public.otp_whatsapp_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
