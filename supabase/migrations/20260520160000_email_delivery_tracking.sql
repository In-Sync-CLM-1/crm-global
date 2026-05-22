ALTER TABLE public.email_conversations
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS bounced_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS bounce_reason text,
  ADD COLUMN IF NOT EXISTS complained_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS email_conversations_provider_message_id_idx
  ON public.email_conversations (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
