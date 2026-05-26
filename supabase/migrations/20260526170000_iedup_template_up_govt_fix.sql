-- IEDUP WhatsApp template swap: point the stage automations at the re-filed
-- templates whose signature reads "उद्यमिता विकास संस्थान, उत्तर प्रदेश, लखनऊ"
-- (the word "सरकार" was removed). New templates were filed + Meta-approved
-- out of band; the old v1 templates are deleted after this switch.
--   help-desk:      iedup_cmyuva_training_helpdesk_v1 -> _v2  (Meta re-classed as MARKETING)
--   payment failed: iedup_cmyuva_payment_failed_v1    -> _v2  (still UTILITY)
-- (The post-call sender's training_link template is switched in ai-bolna-webhook.)

update public.pipeline_stage_actions
  set template_name = 'iedup_cmyuva_training_helpdesk_v2'
  where org_id = '6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d'
    and template_name = 'iedup_cmyuva_training_helpdesk_v1';

update public.pipeline_stage_actions
  set template_name = 'iedup_cmyuva_payment_failed_v2'
  where org_id = '6dcf4229-6902-4cd4-9c7f-2d6ed4a6045d'
    and template_name = 'iedup_cmyuva_payment_failed_v1';
