-- Idempotency gate for post-call customer messages (Demo Confirmation / Intro).
-- Set when send-post-call-message has finished dispatching to the contact.
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS customer_message_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_call_logs_customer_message_sent_at
  ON public.call_logs(customer_message_sent_at);
