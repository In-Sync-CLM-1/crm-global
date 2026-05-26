-- IEDUP cost-control (org-scoped, opt-in switches; no other org is affected).
--
--   1. act_today_only       — calls & WhatsApp act ONLY on contacts uploaded the
--                             same calendar day (IST). Past-day data is left alone.
--                             Overridable ("unless otherwise notified") by flipping
--                             the flag off.
--   2. enforce_wallet_in_trial — the wallet is a HARD ceiling even during the free
--                             trial. Once spent, dialing + WhatsApp stop. (Default
--                             trial behaviour ignores the wallet, which let IEDUP
--                             burn ~₹5,000; this caps it.)
--
-- Both default FALSE, so every other org keeps its exact current behaviour. Only
-- IEDUP is switched on. The dialer side is enforced here in get_ai_call_candidates
-- (no edge-function change); the WhatsApp/stage-call side is enforced in
-- pipeline-action-dispatcher.

-- 1. Switches -----------------------------------------------------------------
alter table public.organization_settings
  add column if not exists act_today_only boolean not null default false,
  add column if not exists enforce_wallet_in_trial boolean not null default false;

update public.organization_settings
  set act_today_only = true,
      enforce_wallet_in_trial = true,
      updated_at = now()
  where org_id = '6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d';

-- 2. Candidate selection: fold in (a) WhatsApp-stage exclusion [prior fix],
--    (b) today-only gate, (c) wallet hard-cap gate. ----------------------------

-- Owner-routed variant (used by ai-bulk-call cron).
CREATE OR REPLACE FUNCTION public.get_ai_call_candidates(p_org uuid, p_limit integer, p_owner uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, first_name text, last_name text, phone text, company text, job_title text)
 LANGUAGE sql
 STABLE
AS $function$
  with attempts as (
    select contact_id, count(*) as n,
           count(*) filter (where coalesce(conversation_duration,0)>=5) as connected,
           max(started_at) as last_at
    from call_logs where caller_type='ai' and started_at is not null group by contact_id
  ),
  team_phones as (
    select distinct regexp_replace(coalesce(phone,''),'\D','','g') as d
    from profiles where org_id=p_org and phone is not null and phone<>''
  ),
  team_names as (
    select distinct lower(trim(coalesce(first_name,'')))||'|'||lower(trim(coalesce(last_name,''))) as full_name
    from profiles where org_id=p_org and coalesce(first_name,'')<>''
  )
  select c.id, c.first_name, c.last_name, c.phone, c.company, c.job_title
  from contacts c
  left join attempts a on a.contact_id=c.id
  left join pipeline_stages ps on ps.id=c.pipeline_stage_id
  where c.org_id=p_org
    and c.phone is not null and c.phone<>''
    and coalesce(c.do_not_call,false)=false
    and coalesce(lower(ps.name),'') not in ('won','lost')
    -- never dial a contact whose stage is a non-call action (e.g. a WhatsApp stage)
    and not exists (
      select 1 from public.pipeline_stage_actions psa
      where psa.stage_id = c.pipeline_stage_id
        and psa.is_active = true
        and psa.action_type <> 'call'
    )
    -- today-only: when the org opts in, only contacts uploaded today (IST)
    and (
      not exists (select 1 from public.organization_settings os where os.org_id=p_org and os.act_today_only)
      or c.created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
    )
    -- hard wallet cap: when the org opts in, no candidates once the wallet is exhausted
    and (
      not exists (select 1 from public.organization_settings os where os.org_id=p_org and os.enforce_wallet_in_trial)
      or exists (
        select 1 from public.organization_subscriptions sub
        where sub.org_id=p_org
          and coalesce(sub.wallet_balance,0) > coalesce(sub.wallet_minimum_balance,0)
      )
    )
    and coalesce(a.connected,0)=0
    and coalesce(a.n,0)<3
    and (a.last_at is null or (a.last_at at time zone 'Asia/Kolkata')::date < (now() at time zone 'Asia/Kolkata')::date)
    and right(regexp_replace(c.phone,'\D','','g'),10) not in (select right(d,10) from team_phones where length(d)>=10)
    and (lower(trim(coalesce(c.first_name,'')))||'|'||lower(trim(coalesce(c.last_name,'')))) not in (select full_name from team_names)
    and (p_owner is null or c.assigned_to = p_owner)
  order by a.n nulls first, a.last_at nulls first, c.created_at desc, c.id
  limit p_limit;
$function$;

GRANT EXECUTE ON FUNCTION public.get_ai_call_candidates(uuid, integer, uuid) TO service_role;

-- 2-arg variant (kept in sync).
CREATE OR REPLACE FUNCTION public.get_ai_call_candidates(p_org uuid, p_limit integer)
 RETURNS TABLE(id uuid, first_name text, last_name text, phone text, company text, job_title text)
 LANGUAGE sql
 STABLE
AS $function$
  WITH attempts AS (
    SELECT contact_id, count(*) AS n, max(started_at) AS last_at
    FROM call_logs WHERE caller_type = 'ai' AND started_at IS NOT NULL GROUP BY contact_id
  ),
  team_phones AS (
    SELECT DISTINCT regexp_replace(coalesce(phone, ''), '\D', '', 'g') AS d
    FROM profiles WHERE org_id = p_org AND phone IS NOT NULL AND phone <> ''
  ),
  team_names AS (
    SELECT DISTINCT lower(trim(coalesce(first_name, ''))) || '|' || lower(trim(coalesce(last_name, ''))) AS full_name
    FROM profiles WHERE org_id = p_org AND coalesce(first_name, '') <> ''
  )
  SELECT c.id, c.first_name, c.last_name, c.phone, c.company, c.job_title
  FROM contacts c
  LEFT JOIN attempts a ON a.contact_id = c.id
  LEFT JOIN pipeline_stages ps ON ps.id = c.pipeline_stage_id
  WHERE c.org_id = p_org
    AND c.phone IS NOT NULL AND c.phone <> ''
    AND coalesce(c.do_not_call, false) = false
    AND coalesce(lower(ps.name), '') NOT IN ('won', 'lost')
    AND NOT EXISTS (
      SELECT 1 FROM public.pipeline_stage_actions psa
      WHERE psa.stage_id = c.pipeline_stage_id AND psa.is_active = true AND psa.action_type <> 'call'
    )
    AND (
      NOT EXISTS (SELECT 1 FROM public.organization_settings os WHERE os.org_id = p_org AND os.act_today_only)
      OR c.created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
    )
    AND (
      NOT EXISTS (SELECT 1 FROM public.organization_settings os WHERE os.org_id = p_org AND os.enforce_wallet_in_trial)
      OR EXISTS (
        SELECT 1 FROM public.organization_subscriptions sub
        WHERE sub.org_id = p_org AND coalesce(sub.wallet_balance,0) > coalesce(sub.wallet_minimum_balance,0)
      )
    )
    AND coalesce(a.n, 0) < 3
    AND (a.last_at IS NULL OR (a.last_at AT TIME ZONE 'Asia/Kolkata')::date < (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
    AND right(regexp_replace(c.phone, '\D', '', 'g'), 10) NOT IN (SELECT right(d, 10) FROM team_phones WHERE length(d) >= 10)
    AND (lower(trim(coalesce(c.first_name, ''))) || '|' || lower(trim(coalesce(c.last_name, '')))) NOT IN (SELECT full_name FROM team_names)
  ORDER BY a.n NULLS FIRST, a.last_at NULLS FIRST, c.created_at DESC, c.id
  LIMIT p_limit;
$function$;

GRANT EXECUTE ON FUNCTION public.get_ai_call_candidates(uuid, integer) TO service_role;
