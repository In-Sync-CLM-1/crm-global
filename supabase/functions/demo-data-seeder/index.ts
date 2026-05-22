import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Realistic demo data pools ──────────────────────────────────────────────

const FIRST_NAMES = [
  'Aarav','Aditya','Akash','Amit','Ananya','Anjali','Arjun','Aryan','Deepak',
  'Divya','Gaurav','Harshita','Ishaan','Karan','Kavya','Kunal','Manish','Meera',
  'Mohit','Nisha','Nitin','Pooja','Priya','Rahul','Raj','Rajesh','Riya','Rohit',
  'Sanjay','Sara','Shivani','Sneha','Sumit','Suresh','Tanvi','Varun','Vikram',
  'Vishal','Yash','Zara',
];

const LAST_NAMES = [
  'Agarwal','Bhatia','Chopra','Desai','Gupta','Iyer','Jain','Kapoor','Kumar',
  'Malhotra','Mehta','Mishra','Nair','Patel','Pillai','Rao','Reddy','Sharma',
  'Singh','Srivastava','Tiwari','Verma','Shah','Joshi','Saxena',
];

const COMPANIES = [
  'Infosys Ltd','TCS Technologies','Wipro Digital','HCL Systems','Tech Mahindra',
  'Reliance Industries','Tata Consultancy','Bajaj Finserv','Adani Enterprises',
  'Muthoot Finance','HDFC Securities','Kotak Ventures','ICICI Solutions',
  'Bharat Forge','Godrej Properties','Pidilite Industries','Asian Paints',
  'Havells India','Voltas Systems','Blue Star Ltd','Crompton Greaves',
  'Titan Company','Tanishq Retail','Marico Consumer','Dabur India',
  'Nestle India','Hindustan Unilever','ITC Limited','Britannia Industries',
  'Sun Pharma','Dr Reddy\'s Labs','Cipla Healthcare','Lupin Pharma',
  'Divi\'s Laboratories','Biocon Research','Zydus Cadila','Torrent Pharma',
];

const JOB_TITLES = [
  'CEO','CTO','CFO','COO','VP Sales','VP Marketing','Director Operations',
  'General Manager','Senior Manager','Business Development Manager',
  'Sales Manager','Marketing Head','Operations Manager','Product Manager',
  'Account Manager','Procurement Manager','IT Manager','Finance Manager',
];

const SOURCES = ['website','referral','cold_call','linkedin','email_campaign','trade_show','partner','inbound'];

const INDUSTRIES = ['Technology','Manufacturing','Finance','Healthcare','Retail','FMCG','Real Estate','Pharma'];

const CITIES = ['Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Pune','Kolkata','Ahmedabad','Jaipur','Surat'];

const ACTIVITY_SUBJECTS = {
  call: [
    'Initial discovery call','Follow-up call','Product demo call','Pricing discussion',
    'Technical requirements call','Decision maker call','Proposal walkthrough call',
    'Negotiation call','Contract discussion','Post-sale check-in',
  ],
  email: [
    'Sent product brochure','Shared case study','Sent pricing proposal','Follow-up on demo',
    'Sent contract draft','Shared ROI analysis','Sent onboarding guide','Quarterly review',
  ],
  meeting: [
    'On-site product demo','Executive meeting','Technical evaluation','Proof of concept review',
    'Contract signing meeting','Kickoff meeting','Quarterly business review',
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(): string {
  const prefixes = ['98','99','97','96','95','94','93','92','91','90','88','87','86','85','84','83','82','81','80','79','78','77','76','75','74','73','72','71','70'];
  return `+91 ${pick(prefixes)}${randInt(10000000, 99999999)}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(8, 18), randInt(0, 59), 0, 0);
  return d.toISOString();
}

// Weighted stage distribution (index → weight) — earlier stages get more contacts
function weightedStageIndex(stageCount: number): number {
  const weights = Array.from({ length: stageCount }, (_, i) =>
    Math.max(1, stageCount - i) * (stageCount - i)
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return stageCount - 1;
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const count: number = body.count ?? 10;

    // ── 1. Find the demo org ───────────────────────────────────────────────
    const { data: orgs, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name')
      .ilike('name', '%in-sync%')
      .limit(5);

    if (orgErr) throw orgErr;

    // Prefer org with "demo" in name, otherwise first In-Sync org
    const org =
      orgs?.find((o) => o.name?.toLowerCase().includes('demo')) ?? orgs?.[0];

    if (!org) {
      return new Response(
        JSON.stringify({ error: 'Demo org not found. Looking for org with "in-sync" in name.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = org.id;
    console.log(`Seeding ${count} data points for org: ${org.name} (${orgId})`);

    // ── 2. Get pipeline stages ─────────────────────────────────────────────
    const { data: stages, error: stagesErr } = await supabase
      .from('pipeline_stages')
      .select('id, name, stage_order')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('stage_order');

    if (stagesErr) throw stagesErr;
    if (!stages || stages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No pipeline stages found for demo org. Please configure stages first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Get org users ───────────────────────────────────────────────────
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .limit(10);

    if (profilesErr) throw profilesErr;

    const userIds = profiles?.map((p) => p.id) ?? [];
    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No users found for demo org.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Create contacts ─────────────────────────────────────────────────
    const contactsToInsert = Array.from({ length: count }, () => {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const stageIdx = weightedStageIndex(stages.length);
      const stage = stages[stageIdx];
      const createdDaysAgo = randInt(1, 90);

      return {
        org_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(10, 99)}@${pick(COMPANIES).toLowerCase().replace(/[^a-z]/g, '').slice(0, 10)}.com`,
        phone: randomPhone(),
        company: pick(COMPANIES),
        job_title: pick(JOB_TITLES),
        source: pick(SOURCES),
        status: 'active',
        pipeline_stage_id: stage.id,
        industry_type: pick(INDUSTRIES),
        city: pick(CITIES),
        created_by: pick(userIds),
        assigned_to: pick(userIds),
        created_at: daysAgo(createdDaysAgo),
        updated_at: daysAgo(randInt(0, createdDaysAgo)),
      };
    });

    const { data: createdContacts, error: contactsErr } = await supabase
      .from('contacts')
      .insert(contactsToInsert)
      .select('id');

    if (contactsErr) throw contactsErr;

    // ── 5. Create activities for each contact ──────────────────────────────
    const activityTypes = ['call', 'email', 'meeting'] as const;
    const activitiesToInsert = (createdContacts ?? []).flatMap((contact) => {
      const numActivities = randInt(1, 3);
      return Array.from({ length: numActivities }, () => {
        const type = pick(activityTypes);
        const daysBack = randInt(0, 60);
        return {
          org_id: orgId,
          contact_id: contact.id,
          activity_type: type,
          subject: pick(ACTIVITY_SUBJECTS[type]),
          call_duration: type === 'call' ? randInt(120, 1800) : null,
          duration_minutes: type === 'meeting' ? randInt(30, 90) : null,
          completed_at: daysAgo(daysBack),
          created_by: pick(userIds),
          created_at: daysAgo(daysBack),
        };
      });
    });

    const { error: activitiesErr } = await supabase
      .from('contact_activities')
      .insert(activitiesToInsert);

    if (activitiesErr) throw activitiesErr;

    // Refresh the materialized view
    await supabase.rpc('refresh_contacts_with_stages');

    const summary = {
      org: org.name,
      contacts_created: createdContacts?.length ?? 0,
      activities_created: activitiesToInsert.length,
      stage_distribution: stages.map((s) => ({
        stage: s.name,
        count: contactsToInsert.filter((c) => c.pipeline_stage_id === s.id).length,
      })),
    };

    console.log('Seed complete:', JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Seeder error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
