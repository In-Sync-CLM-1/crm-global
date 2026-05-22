-- ── Demo Data Seeder: SQL function + daily 8am IST cron ───────────────────
-- This creates a self-contained SQL seeder for the In-Sync Demo org.
-- pg_cron fires it every day at 08:00 IST (02:30 UTC).

CREATE OR REPLACE FUNCTION public.seed_demo_data(p_count integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id        uuid;
  v_user_ids      uuid[];
  v_stage_ids     uuid[];
  v_stage_weights integer[];
  v_total_weight  integer := 0;
  v_r             integer;
  v_stage_idx     integer;
  v_i             integer;
  v_contact_id    uuid;
  v_contact_ids   uuid[] := '{}';
  v_contacts_done integer := 0;
  v_activities_done integer := 0;

  -- Data pools (parallel arrays)
  v_first_names text[] := ARRAY[
    'Aarav','Aditya','Akash','Amit','Ananya','Anjali','Arjun','Aryan','Deepak',
    'Divya','Gaurav','Harshita','Ishaan','Karan','Kavya','Kunal','Manish','Meera',
    'Mohit','Nisha','Nitin','Pooja','Priya','Rahul','Raj','Rajesh','Riya','Rohit',
    'Sanjay','Sara','Shivani','Sneha','Sumit','Suresh','Tanvi','Varun','Vikram',
    'Vishal','Yash','Zara'
  ];
  v_last_names text[] := ARRAY[
    'Agarwal','Bhatia','Chopra','Desai','Gupta','Iyer','Jain','Kapoor','Kumar',
    'Malhotra','Mehta','Mishra','Nair','Patel','Pillai','Rao','Reddy','Sharma',
    'Singh','Srivastava','Tiwari','Verma','Shah','Joshi','Saxena'
  ];
  v_companies text[] := ARRAY[
    'Infosys Ltd','TCS Technologies','Wipro Digital','HCL Systems','Tech Mahindra',
    'Reliance Industries','Tata Consultancy','Bajaj Finserv','Adani Enterprises',
    'Muthoot Finance','HDFC Securities','Kotak Ventures','ICICI Solutions',
    'Bharat Forge','Godrej Properties','Pidilite Industries','Asian Paints',
    'Havells India','Voltas Systems','Blue Star Ltd','Crompton Greaves',
    'Titan Company','Marico Consumer','Dabur India','Nestle India',
    'Hindustan Unilever','ITC Limited','Britannia Industries','Sun Pharma',
    'Dr Reddys Labs','Cipla Healthcare','Lupin Pharma','Torrent Pharma'
  ];
  v_job_titles text[] := ARRAY[
    'CEO','CTO','CFO','COO','VP Sales','VP Marketing','Director Operations',
    'General Manager','Senior Manager','Business Development Manager',
    'Sales Manager','Marketing Head','Operations Manager','Product Manager',
    'Account Manager','Procurement Manager','IT Manager','Finance Manager'
  ];
  v_sources text[] := ARRAY[
    'website','referral','cold_call','linkedin','email_campaign','trade_show','partner','inbound'
  ];
  v_industries text[] := ARRAY[
    'Technology','Manufacturing','Finance','Healthcare','Retail','FMCG','Real Estate','Pharma'
  ];
  v_cities text[] := ARRAY[
    'Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Pune','Kolkata','Ahmedabad','Jaipur','Surat'
  ];
  v_call_subjects text[] := ARRAY[
    'Initial discovery call','Follow-up call','Product demo call','Pricing discussion',
    'Technical requirements call','Decision maker call','Negotiation call','Contract discussion'
  ];
  v_email_subjects text[] := ARRAY[
    'Sent product brochure','Shared case study','Sent pricing proposal','Follow-up on demo',
    'Sent contract draft','Shared ROI analysis','Sent onboarding guide'
  ];
  v_meeting_subjects text[] := ARRAY[
    'On-site product demo','Executive meeting','Technical evaluation',
    'Proof of concept review','Contract signing meeting','Kickoff meeting'
  ];
  v_activity_types text[] := ARRAY['call','email','meeting'];

  v_fname   text;
  v_lname   text;
  v_company text;
  v_created_ago interval;
  v_user_id uuid;
  v_atype   text;
  v_days_back integer;
  v_num_activities integer;
BEGIN
  -- 1. Locate the demo org
  SELECT id INTO v_org_id
  FROM organizations
  WHERE lower(name) LIKE '%in-sync%'
  ORDER BY (lower(name) LIKE '%demo%') DESC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Demo org not found');
  END IF;

  -- 2. Get users
  SELECT array_agg(id) INTO v_user_ids
  FROM profiles
  WHERE org_id = v_org_id;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RETURN jsonb_build_object('error', 'No users found for demo org');
  END IF;

  -- 3. Get pipeline stages ordered by stage_order
  SELECT array_agg(id ORDER BY stage_order) INTO v_stage_ids
  FROM pipeline_stages
  WHERE org_id = v_org_id AND is_active = true;

  IF v_stage_ids IS NULL OR array_length(v_stage_ids, 1) = 0 THEN
    RETURN jsonb_build_object('error', 'No pipeline stages found');
  END IF;

  -- Build descending weights so earlier stages get more contacts
  FOR v_i IN 1..array_length(v_stage_ids, 1) LOOP
    v_stage_weights := array_append(
      v_stage_weights,
      (array_length(v_stage_ids, 1) - v_i + 1) ^ 2
    );
    v_total_weight := v_total_weight + (array_length(v_stage_ids, 1) - v_i + 1) ^ 2;
  END LOOP;

  -- 4. Insert contacts + activities
  FOR v_i IN 1..p_count LOOP
    v_fname   := v_first_names[1 + floor(random() * array_length(v_first_names, 1))::int];
    v_lname   := v_last_names[1 + floor(random() * array_length(v_last_names, 1))::int];
    v_company := v_companies[1 + floor(random() * array_length(v_companies, 1))::int];
    v_user_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
    v_created_ago := (floor(random() * 120) || ' days')::interval;

    -- Weighted stage pick
    v_r := floor(random() * v_total_weight)::int;
    v_stage_idx := 1;
    FOR j IN 1..array_length(v_stage_weights, 1) LOOP
      v_r := v_r - v_stage_weights[j];
      IF v_r <= 0 THEN
        v_stage_idx := j;
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO contacts (
      org_id, first_name, last_name,
      email, phone, company, job_title,
      source, status, pipeline_stage_id,
      industry_type, city,
      created_by, assigned_to,
      created_at, updated_at
    ) VALUES (
      v_org_id, v_fname, v_lname,
      lower(v_fname) || '.' || lower(v_lname) || floor(random()*90+10)::int || '@' ||
        regexp_replace(lower(v_company), '[^a-z]', '', 'g') || '.com',
      '+91 ' || (80 + floor(random()*20))::text || floor(random()*90000000+10000000)::text,
      v_company,
      v_job_titles[1 + floor(random() * array_length(v_job_titles, 1))::int],
      v_sources[1 + floor(random() * array_length(v_sources, 1))::int],
      'active',
      v_stage_ids[v_stage_idx],
      v_industries[1 + floor(random() * array_length(v_industries, 1))::int],
      v_cities[1 + floor(random() * array_length(v_cities, 1))::int],
      v_user_id, v_user_id,
      now() - v_created_ago,
      now() - (floor(random() * extract(epoch from v_created_ago)/86400) || ' days')::interval
    )
    RETURNING id INTO v_contact_id;

    v_contacts_done := v_contacts_done + 1;
    v_num_activities := 1 + floor(random() * 3)::int;

    FOR k IN 1..v_num_activities LOOP
      v_atype    := v_activity_types[1 + floor(random() * 3)::int];
      v_days_back := floor(random() * 90)::int;

      INSERT INTO contact_activities (
        org_id, contact_id, activity_type, subject,
        call_duration, duration_minutes,
        completed_at, created_by, created_at
      ) VALUES (
        v_org_id, v_contact_id, v_atype,
        CASE v_atype
          WHEN 'call'    THEN v_call_subjects[1 + floor(random() * array_length(v_call_subjects, 1))::int]
          WHEN 'email'   THEN v_email_subjects[1 + floor(random() * array_length(v_email_subjects, 1))::int]
          ELSE v_meeting_subjects[1 + floor(random() * array_length(v_meeting_subjects, 1))::int]
        END,
        CASE v_atype WHEN 'call' THEN (120 + floor(random()*1680))::int ELSE NULL END,
        CASE v_atype WHEN 'meeting' THEN (30 + floor(random()*60))::int ELSE NULL END,
        now() - (v_days_back || ' days')::interval,
        v_user_id,
        now() - (v_days_back || ' days')::interval
      );

      v_activities_done := v_activities_done + 1;
    END LOOP;
  END LOOP;

  -- Refresh materialized view
  PERFORM refresh_contacts_with_stages();

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'contacts_inserted', v_contacts_done,
    'activities_inserted', v_activities_done
  );
END;
$$;

-- ── Schedule: every day at 08:00 IST = 02:30 UTC ─────────────────────────
-- Remove existing job if present, then re-add
SELECT cron.unschedule('demo-data-daily-seed') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'demo-data-daily-seed'
);

SELECT cron.schedule(
  'demo-data-daily-seed',
  '30 2 * * *',
  $cron$ SELECT public.seed_demo_data(10); $cron$
);
