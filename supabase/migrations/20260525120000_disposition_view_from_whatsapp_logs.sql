-- Repoint the WhatsApp branch of contact_latest_disposition from
-- whatsapp_messages to whatsapp_logs. whatsapp_logs is the billing/usage table
-- the IEDUP dashboard reads, what the post-call sender and the stage-action
-- dispatcher write to, and what the DLR webhook now advances (sent->delivered->
-- read). Scoped by INNER JOIN on call_dispositions name, so only orgs that
-- defined Message Sent/Delivered/Opened (IEDUP) are affected.
create or replace view public.contact_latest_disposition as
with events as (
  select cl.org_id, cl.contact_id, cl.id as call_log_id, cl.disposition_id,
         d.name as disposition_name, d.category as disposition_category,
         cl.created_at as dispositioned_at
  from public.call_logs cl
  join public.call_dispositions d on d.id = cl.disposition_id
  where cl.contact_id is not null and cl.disposition_id is not null

  union all

  select wl.org_id, wl.contact_id, null::uuid as call_log_id, d.id as disposition_id,
         d.name as disposition_name, d.category as disposition_category,
         coalesce(wl.read_at, wl.delivered_at, wl.sent_at, wl.created_at) as dispositioned_at
  from public.whatsapp_logs wl
  join public.call_dispositions d
    on d.org_id = wl.org_id
   and d.name = case wl.status
                  when 'read'      then 'Message Opened'
                  when 'delivered' then 'Message Delivered'
                  when 'sent'      then 'Message Sent'
                end
  where wl.contact_id is not null
    and wl.status in ('sent','delivered','read')
)
select distinct on (contact_id)
  org_id, contact_id, call_log_id, disposition_id,
  disposition_name, disposition_category, dispositioned_at
from events
order by contact_id, dispositioned_at desc;

grant select on public.contact_latest_disposition to authenticated;
