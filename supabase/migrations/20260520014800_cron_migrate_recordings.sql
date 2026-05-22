-- Schedule daily R2 recording migration at 18:30 IST (13:00 UTC)
SELECT cron.unschedule('migrate-recordings-to-r2')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'migrate-recordings-to-r2');

SELECT cron.schedule(
  'migrate-recordings-to-r2',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ejzjrvazegaxrhqizgaa.supabase.co/functions/v1/migrate-recording-to-r2',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
