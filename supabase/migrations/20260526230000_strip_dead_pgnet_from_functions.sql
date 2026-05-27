-- Strip the last orphaned net.http_post calls (to migrated-away project
-- aizgpxaqvtvvqarzjmze) out of 4 non-trigger functions. These were the remaining
-- pg_net references after the trigger cleanup (20260526220000).

-- Wholly dead: its only job was to call the old project's retry-failed-whatsapp. No-op.
create or replace function public.trigger_retry_failed_whatsapp() returns void
  language plpgsql security definer set search_path to 'public','extensions' as $fn$
begin
  -- Retired: posted to migrated-away project's retry-failed-whatsapp edge function.
  null;
end;
$fn$;

-- Only effect was notifying the (dead) automation handler about inactive contacts. Keep
-- the structure, drop the dead call. Re-engagement automation can be rebuilt against the
-- current project if wanted.
create or replace function public.check_inactive_contacts() returns void
  language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare
  rule_record record;
  contact_record record;
  days_inactive integer;
begin
  for rule_record in
    select * from email_automation_rules where trigger_type = 'inactivity' and is_active = true
  loop
    days_inactive := coalesce((rule_record.trigger_config->>'inactivity_days')::integer, 30);
    for contact_record in
      select c.id, c.org_id, max(ca.created_at) as last_activity
      from contacts c left join contact_activities ca on ca.contact_id = c.id
      where c.org_id = rule_record.org_id
      group by c.id, c.org_id
      having max(ca.created_at) < now() - (days_inactive || ' days')::interval
         or max(ca.created_at) is null
    loop
      null; -- automation-trigger-handler retired (dead project); inactivity re-engagement inactive
    end loop;
  end loop;
end;
$fn$;

-- Same: only fed the dead automation handler. Structure kept, dead call removed.
create or replace function public.process_time_based_triggers() returns void
  language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare
  rule_record record;
  contact_record record;
  relative_days integer;
begin
  for rule_record in
    select * from email_automation_rules where trigger_type = 'time_based' and is_active = true
  loop
    relative_days := coalesce((rule_record.trigger_config->>'relative_days')::integer, 0);
    if rule_record.trigger_config->>'trigger_date_type' = 'contact_created' then
      for contact_record in
        select id, org_id, created_at from contacts
        where org_id = rule_record.org_id
          and date(created_at + (relative_days || ' days')::interval) = current_date
      loop
        null; -- automation-trigger-handler retired (dead project); time-based email inactive
      end loop;
    end if;
  end loop;
end;
$fn$;

-- Real logic kept (lead-score upsert); only the trailing dead automation notify removed.
create or replace function public.update_lead_score(_contact_id uuid, _org_id uuid, _score_delta integer, _reason text) returns void
  language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare
  old_score integer;
  new_score integer;
  old_category text;
  new_category text;
begin
  select score, score_category into old_score, old_category
  from contact_lead_scores where contact_id = _contact_id;

  if not found then
    old_score := 0;
    old_category := 'cold';
  end if;

  new_score := old_score + _score_delta;
  new_score := greatest(0, least(100, new_score));

  new_category := case
    when new_score >= 70 then 'hot'
    when new_score >= 40 then 'warm'
    else 'cold'
  end;

  insert into contact_lead_scores (org_id, contact_id, score, score_category, last_calculated, score_breakdown)
  values (_org_id, _contact_id, new_score, new_category, now(), jsonb_build_object(_reason, _score_delta))
  on conflict (contact_id) do update set
    score = new_score,
    score_category = new_category,
    last_calculated = now(),
    score_breakdown = contact_lead_scores.score_breakdown || jsonb_build_object(_reason, _score_delta);
  -- (removed: the dead automation-handler notify that fired on a lead-score change)
end;
$fn$;
