-- Seed Work-Sync post-call email templates for In-Sync Demo org

DO $$
DECLARE
  v_org_id uuid := '61f7f96d-e80c-4d9b-a765-8eb32bd3c70d';
  v_disp_followup_interested uuid := '89a99e2f-e218-4ceb-89d4-cc82880366a9';
  v_disp_demo_booked uuid := '09834f4a-a923-47e9-a45c-75604652684a';
  v_template1_id uuid;
  v_template2_id uuid;
  v_html1 text;
  v_html2 text;
BEGIN

v_html1 := $html1$<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6;font-size:15px">
  <p>Hi {{prospect_name}},</p>
  <p>Thank you for your time on the call just now.</p>
  <p>As discussed, here's a quick introduction to <strong>Work-Sync</strong> — a task accountability tool built for Indian teams.</p>
  <p>The core idea: you assign a task, it lands on your team member's WhatsApp and email instantly, status updates flow in real time, and you sign off when the work is actually done. No more chasing on calls or losing tasks in WhatsApp groups.</p>
  <p><strong>A few highlights:</strong></p>
  <ul>
    <li>WhatsApp + email alerts at every step</li>
    <li>Built for Indian org hierarchies (MD → VP → Manager → Executive)</li>
    <li>14-day free trial, no credit card needed</li>
    <li>Trusted by 100+ businesses including Quess Corp, Motherson, and InCred</li>
  </ul>
  <p style="text-align:center;margin:32px 0">
    <a href="https://work.in-sync.co.in" style="display:inline-block;background:#0D9488;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px">Visit Work-Sync</a>
  </p>
  <p>When you have 20 minutes, our product specialist would love to walk you through a live demo tailored to your team's workflow. Just reply to this email with a convenient slot and I'll block it for you.</p>
  <p style="margin-top:32px">Warm regards,<br>
  <strong>{{caller_name}}</strong><br>
  In-Sync<br>
  {{caller_email}} | {{caller_phone}}<br>
  <a href="https://work.in-sync.co.in" style="color:#0D9488">https://work.in-sync.co.in</a></p>
</div>$html1$;

v_html2 := $html2$<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6;font-size:15px">
  <p>Hi {{prospect_name}},</p>
  <p>Thank you for your time on the call just now. This email is to confirm the details of your scheduled Work-Sync demo.</p>

  <div style="background:#F0FDFA;border-left:4px solid #0D9488;padding:16px 20px;margin:20px 0;border-radius:4px">
    <p style="margin:0 0 8px 0;font-weight:600;color:#0D9488">Demo Details</p>
    <p style="margin:4px 0"><strong>Date:</strong> {{demo_date}}</p>
    <p style="margin:4px 0"><strong>Time:</strong> {{demo_time}} IST</p>
    <p style="margin:4px 0"><strong>Duration:</strong> 20 minutes</p>
    <p style="margin:4px 0"><strong>With:</strong> {{sales_rep_name}}, Product Specialist</p>
  </div>

  <p>A calendar invite with the meeting link will reach you separately within the next 10 minutes. Please accept the invite so it gets blocked on your calendar.</p>

  <p><strong>What we'll cover</strong><br>
  Work-Sync is built for Indian teams — task accountability with WhatsApp alerts at every step, and the assigner signs off on completion so "done" actually means done. The 20-minute demo will be tailored to your team's workflow and use cases, with sample data from your industry.</p>

  <p>If you'd like a quick look beforehand:</p>
  <p style="text-align:center;margin:24px 0">
    <a href="https://work.in-sync.co.in" style="display:inline-block;background:#0D9488;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px">Visit Work-Sync</a>
  </p>

  <p>If anything changes at your end, please reply to this email or message me directly, and I'll be happy to reschedule.</p>

  <p>Looking forward to it!</p>

  <p style="margin-top:32px">Warm regards,<br>
  <strong>{{caller_name}}</strong><br>
  In-Sync<br>
  {{caller_email}} | {{caller_phone}}<br>
  <a href="https://work.in-sync.co.in" style="color:#0D9488">https://work.in-sync.co.in</a></p>
</div>$html2$;

-- Upsert Template 1
INSERT INTO email_templates (org_id, name, subject, html_content, body_content, is_active)
VALUES (
  v_org_id,
  'Work-Sync: Post-Call Introduction',
  'Quick intro to Work-Sync, following our call',
  v_html1,
  v_html1,
  true
)
ON CONFLICT DO NOTHING
RETURNING id INTO v_template1_id;

IF v_template1_id IS NULL THEN
  SELECT id INTO v_template1_id FROM email_templates
   WHERE org_id = v_org_id AND name = 'Work-Sync: Post-Call Introduction';
  UPDATE email_templates
     SET subject = 'Quick intro to Work-Sync, following our call',
         html_content = v_html1,
         body_content = v_html1,
         is_active = true,
         updated_at = now()
   WHERE id = v_template1_id;
END IF;

-- Upsert Template 2
INSERT INTO email_templates (org_id, name, subject, html_content, body_content, is_active)
VALUES (
  v_org_id,
  'Work-Sync: Demo Confirmation',
  'Your Work-Sync demo is confirmed for {{demo_day}}, {{demo_time}}',
  v_html2,
  v_html2,
  true
)
ON CONFLICT DO NOTHING
RETURNING id INTO v_template2_id;

IF v_template2_id IS NULL THEN
  SELECT id INTO v_template2_id FROM email_templates
   WHERE org_id = v_org_id AND name = 'Work-Sync: Demo Confirmation';
  UPDATE email_templates
     SET subject = 'Your Work-Sync demo is confirmed for {{demo_day}}, {{demo_time}}',
         html_content = v_html2,
         body_content = v_html2,
         is_active = true,
         updated_at = now()
   WHERE id = v_template2_id;
END IF;

-- Upsert automation rule: Follow Up — Interested → Email 1
INSERT INTO email_automation_rules (
  org_id, name, description, is_active, trigger_type, trigger_config,
  email_template_id, send_delay_minutes, priority, enforce_business_hours, ab_test_enabled
) VALUES (
  v_org_id,
  'Post-call intro after "Follow Up — Interested"',
  'Auto-send the Work-Sync introduction email when SDR marks the call as Follow Up — Interested.',
  true,
  'disposition_set',
  jsonb_build_object('disposition_ids', jsonb_build_array(v_disp_followup_interested::text)),
  v_template1_id,
  0,
  100,
  false,
  false
)
ON CONFLICT DO NOTHING;

UPDATE email_automation_rules
   SET trigger_config = jsonb_build_object('disposition_ids', jsonb_build_array(v_disp_followup_interested::text)),
       email_template_id = v_template1_id,
       is_active = true,
       send_delay_minutes = 0,
       updated_at = now()
 WHERE org_id = v_org_id AND name = 'Post-call intro after "Follow Up — Interested"';

-- Upsert automation rule: Demo Booked → Email 2
INSERT INTO email_automation_rules (
  org_id, name, description, is_active, trigger_type, trigger_config,
  email_template_id, send_delay_minutes, priority, enforce_business_hours, ab_test_enabled
) VALUES (
  v_org_id,
  'Demo confirmation after "Demo Booked"',
  'Auto-send the Work-Sync demo confirmation email when SDR marks the call as Demo Booked.',
  true,
  'disposition_set',
  jsonb_build_object('disposition_ids', jsonb_build_array(v_disp_demo_booked::text)),
  v_template2_id,
  0,
  100,
  false,
  false
)
ON CONFLICT DO NOTHING;

UPDATE email_automation_rules
   SET trigger_config = jsonb_build_object('disposition_ids', jsonb_build_array(v_disp_demo_booked::text)),
       email_template_id = v_template2_id,
       is_active = true,
       send_delay_minutes = 0,
       updated_at = now()
 WHERE org_id = v_org_id AND name = 'Demo confirmation after "Demo Booked"';

END $$;

SELECT id, name, subject FROM email_templates WHERE org_id = '61f7f96d-e80c-4d9b-a765-8eb32bd3c70d' AND name LIKE 'Work-Sync:%' ORDER BY name;
SELECT id, name, is_active, trigger_type, trigger_config, email_template_id FROM email_automation_rules WHERE org_id = '61f7f96d-e80c-4d9b-a765-8eb32bd3c70d' ORDER BY name;
