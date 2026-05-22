SELECT proname, (regexp_matches(pg_get_functiondef(oid), 'https://([a-z0-9]+)\.supabase\.co', 'g'))[1] AS host
FROM pg_proc
WHERE prosrc LIKE '%supabase.co%'
ORDER BY 1, 2;
