// Scores an SDR test attempt and emails the hiring manager.
// Triggered from the candidate frontend after submission.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, GET, DELETE, OPTIONS',
};

interface Question {
  id: string;
  section: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  marks: number;
  type: 'mcq' | 'short' | 'long' | 'list' | 'roleplay';
  options?: string[];
  correctAnswer?: string;
  correctList?: string[];
  acceptedItems?: string[];
  marksPerCorrectItem?: number;
  keywords?: string[];
  minKeywords?: number;
}

// Mirror of the question bank — kept inline so the function is self-contained.
const QUESTIONS: Question[] = [
  { id: 'A1', section: 'A', marks: 3, type: 'long', keywords: ['task','accountability','whatsapp','hierarchy','indian','assignee','assigner'], minKeywords: 3 },
  { id: 'A2', section: 'A', marks: 2, type: 'short', keywords: ['tasks','lost','whatsapp','tracked','accountability','forgotten'], minKeywords: 2 },
  { id: 'A3', section: 'A', marks: 4, type: 'list', correctList: ['Assign','Notify','Update','Confirm'], marksPerCorrectItem: 1 },
  { id: 'A4', section: 'A', marks: 2, type: 'mcq', correctAnswer: 'Satisfaction Confirmation by the assigner' },
  { id: 'A5', section: 'A', marks: 3, type: 'short', keywords: ['199','user','month','quarterly'], minKeywords: 3 },
  { id: 'A6', section: 'A', marks: 2, type: 'short', keywords: ['email','fallback','automatic'], minKeywords: 2 },
  { id: 'A7', section: 'A', marks: 3, type: 'list', acceptedItems: ['NBFC','DSA','Trading','Logistics','Professional Services','Insurance','Real Estate','EdTech'], marksPerCorrectItem: 1 },
  { id: 'A8', section: 'A', marks: 3, type: 'list', acceptedItems: ['Quess Corp','Motherson','Hiranandani','Audi','College Dekho','Zolve','Capital India','Ecofy','Zopper','Alice Blue','InCred'], marksPerCorrectItem: 1 },
  { id: 'A9', section: 'A', marks: 3, type: 'short', keywords: ['14','days','free','no card','no credit card'], minKeywords: 3 },

  { id: 'B1', section: 'B', marks: 5, type: 'list', correctList: ['Greet & verify','Permission','Pitch (30s)','Qualify','Demo ask'], marksPerCorrectItem: 1 },
  { id: 'B2', section: 'B', marks: 2, type: 'mcq', correctAnswer: 'Confirm you are speaking to the right person and ask permission for 30 seconds' },
  { id: 'B3', section: 'B', marks: 6, type: 'long', keywords: ['team size','current tool','whatsapp','pain','tasks','tracking','decision','industry','budget'], minKeywords: 4 },
  { id: 'B4', section: 'B', marks: 2, type: 'short', keywords: ['10-12','4-6','morning','evening','before lunch','after 4'], minKeywords: 2 },
  { id: 'B5', section: 'B', marks: 2, type: 'mcq', correctAnswer: '3 attempts' },
  { id: 'B6', section: 'B', marks: 3, type: 'short', keywords: ['15','minutes','immediately','immediate'], minKeywords: 1 },

  { id: 'C1', section: 'C', marks: 4, type: 'long', keywords: ['whatsapp','field','notifications','agents','daily','where they are','satisfaction','quality','sign off'], minKeywords: 3 },
  { id: 'C2', section: 'C', marks: 4, type: 'long', keywords: ['manager time','productivity','hour','roi','missed deadlines','compliance','value'], minKeywords: 3 },
  { id: 'C3', section: 'C', marks: 4, type: 'long', keywords: ['15 minute','demo','specific time','calendar','before sending','commitment'], minKeywords: 3 },
  { id: 'C4', section: 'C', marks: 4, type: 'long', keywords: ['who','connect','introduce','relevant','decision','name','forward'], minKeywords: 3 },
  { id: 'C5', section: 'C', marks: 4, type: 'long', keywords: ['lost','buried','accountability','audit','trail','record','structure','memory','tracked'], minKeywords: 3 },

  { id: 'D1', section: 'D', marks: 3, type: 'list', acceptedItems: ['WhatsApp-native notifications','Satisfaction confirmation','Designation hierarchy','Pay-per-message wallet','Email fallback'], marksPerCorrectItem: 1 },
  { id: 'D2', section: 'D', marks: 2, type: 'mcq', correctAnswer: 'Google Sheets + WhatsApp groups (the status quo)' },
  { id: 'D3', section: 'D', marks: 4, type: 'long', keywords: ['manager time','hours','chasing','buried','audit','quality','done','accountability','attrition','compliance'], minKeywords: 4 },
  { id: 'D4', section: 'D', marks: 2, type: 'mcq', correctAnswer: 'SmartTask' },
  { id: 'D5', section: 'D', marks: 4, type: 'list', acceptedItems: ['No free tier','English-only UI','No Indian languages','Less feature depth than Zoho or Kissflow','Limited integrations','No Gantt charts'], marksPerCorrectItem: 2 },

  { id: 'E1', section: 'E', marks: 5, type: 'list', correctList: ['New','Contacted','Qualified','Demo Booked','Closed Won/Lost'], marksPerCorrectItem: 1 },
  { id: 'E2', section: 'E', marks: 3, type: 'list', acceptedItems: ['Outcome','Next action','Date of next action','Pain points','Decision-maker name','Objection raised'], marksPerCorrectItem: 1 },
  { id: 'E3', section: 'E', marks: 2, type: 'mcq', correctAnswer: '20 calls' },

  { id: 'F1', section: 'F', marks: 10, type: 'roleplay' },
];

function normalise(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function countMatches(text: string, items: string[]): number {
  const haystack = normalise(text);
  let hits = 0;
  for (const it of items) {
    const needle = normalise(it);
    if (!needle) continue;
    if (haystack.includes(needle)) hits++;
  }
  return hits;
}

function scoreSingle(q: Question, txt: string | null): { auto: number; flag: boolean } {
  const text = (txt || '').trim();
  if (!text) return { auto: 0, flag: false };
  switch (q.type) {
    case 'mcq':
      return { auto: text === (q.correctAnswer || '').trim() ? q.marks : 0, flag: false };
    case 'short':
    case 'long': {
      if (!q.keywords?.length) return { auto: 0, flag: true };
      const min = q.minKeywords || q.keywords.length;
      const matches = countMatches(text, q.keywords);
      const raw = Math.min(matches / min, 1);
      const score = Math.round(raw * q.marks);
      return { auto: score, flag: q.type === 'long' || score === 0 };
    }
    case 'list': {
      if (q.correctList?.length) {
        const candidates = text.split(/\n|,|;|→|->|>/g).map(normalise).filter(Boolean);
        let hits = 0;
        q.correctList.forEach((item, i) => {
          const expected = normalise(item);
          const seen = candidates[i];
          if (seen && (seen === expected || seen.includes(expected) || expected.includes(seen))) hits++;
        });
        const perItem = q.marksPerCorrectItem ?? q.marks / q.correctList.length;
        return { auto: Math.min(q.marks, Math.round(hits * perItem)), flag: hits === 0 };
      }
      if (q.acceptedItems?.length) {
        const matches = countMatches(text, q.acceptedItems);
        const perItem = q.marksPerCorrectItem ?? 1;
        const maxItems = Math.floor(q.marks / perItem);
        const counted = Math.min(matches, maxItems);
        return { auto: counted * perItem, flag: counted === 0 };
      }
      return { auto: 0, flag: true };
    }
    case 'roleplay':
      return { auto: 0, flag: true };
  }
}

function verdictFor(total: number): string {
  if (total >= 90) return 'Strong hire — fast-track';
  if (total >= 80) return 'Hire — proceed to mock calls';
  if (total >= 70) return 'Conditional — proceed with closer supervision';
  if (total >= 60) return 'Borderline — re-test after 2 days of gap training';
  return 'Reject — do not proceed';
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { attempt_id, reason } = await req.json();
    if (!attempt_id) {
      return new Response(JSON.stringify({ error: 'attempt_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: attempt, error: aErr } = await admin
      .from('sdr_test_attempts')
      .select('*')
      .eq('id', attempt_id)
      .single();
    if (aErr || !attempt) throw new Error(aErr?.message || 'Attempt not found');

    const { data: responses } = await admin
      .from('sdr_test_responses')
      .select('question_id, response_text')
      .eq('attempt_id', attempt_id);

    const respMap = new Map((responses || []).map((r) => [r.question_id, r.response_text as string | null]));

    const bySection: Record<string, { score: number; max: number }> = {
      A: { score: 0, max: 0 }, B: { score: 0, max: 0 }, C: { score: 0, max: 0 },
      D: { score: 0, max: 0 }, E: { score: 0, max: 0 }, F: { score: 0, max: 0 },
    };
    let total = 0;
    const updates: Array<{ attempt_id: string; question_id: string; section: string; response_text: string | null; auto_score: number; flagged_for_review: boolean }> = [];

    for (const q of QUESTIONS) {
      const txt = respMap.get(q.id) ?? null;
      const { auto, flag } = scoreSingle(q, txt);
      bySection[q.section].score += auto;
      bySection[q.section].max += q.marks;
      total += auto;
      updates.push({
        attempt_id,
        question_id: q.id,
        section: q.section,
        response_text: txt,
        auto_score: auto,
        flagged_for_review: flag,
      });
    }

    await admin.from('sdr_test_responses').upsert(updates, { onConflict: 'attempt_id,question_id' });

    const verdict = verdictFor(total);
    await admin
      .from('sdr_test_attempts')
      .update({ auto_score: total, final_score: total, verdict })
      .eq('id', attempt_id);

    // Build and send email
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@in-sync.co.in';
    const toEmail = Deno.env.get('SDR_TEST_RECIPIENT') || 'amit@in-sync.in';
    const dashboardBase = Deno.env.get('SDR_TEST_DASHBOARD_URL') || '';

    if (resendApiKey) {
      const subject = `[SDR Test] ${attempt.candidate_name} — ${total}/100 — ${verdict}`;
      const html = `
<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111;">
  <h2 style="color:#1a9181;">SDR Candidate Assessment Result</h2>
  <p>A new SDR candidate has completed the assessment.</p>
  <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding:6px 0; color:#666; width: 32%;">Candidate</td><td>${attempt.candidate_name}</td></tr>
    <tr><td style="padding:6px 0; color:#666;">Email</td><td>${attempt.candidate_email}</td></tr>
    <tr><td style="padding:6px 0; color:#666;">Phone</td><td>${attempt.candidate_phone || 'N/A'}</td></tr>
    <tr><td style="padding:6px 0; color:#666;">Experience</td><td>${attempt.years_experience ?? 'N/A'} years</td></tr>
    <tr><td style="padding:6px 0; color:#666;">Time taken</td><td>${fmtDuration(attempt.time_taken_seconds)} (limit: 60 min)</td></tr>
    <tr><td style="padding:6px 0; color:#666;">Tab switches</td><td>${attempt.tab_switch_count || 0}</td></tr>
    <tr><td style="padding:6px 0; color:#666;">Submitted</td><td>${reason === 'timeout' ? 'Auto-submitted at time-out' : 'Manually submitted'}</td></tr>
  </table>
  <div style="background:#f3f4f6; border-radius:8px; padding:16px; margin:16px 0;">
    <div style="font-size:32px; font-weight:bold; color:#1a9181;">${total}/100</div>
    <div style="font-size:14px; color:#374151;">${verdict}</div>
  </div>
  <h3 style="font-size:14px; color:#374151; margin-top:24px;">Section breakdown</h3>
  <table style="width:100%; border-collapse: collapse;">
    <tr><td style="padding:4px 0;">A · Product Knowledge</td><td style="text-align:right;">${bySection.A.score} / ${bySection.A.max}</td></tr>
    <tr><td style="padding:4px 0;">B · Call Flow</td><td style="text-align:right;">${bySection.B.score} / ${bySection.B.max}</td></tr>
    <tr><td style="padding:4px 0;">C · Objection Handling</td><td style="text-align:right;">${bySection.C.score} / ${bySection.C.max}</td></tr>
    <tr><td style="padding:4px 0;">D · Competitive Awareness</td><td style="text-align:right;">${bySection.D.score} / ${bySection.D.max}</td></tr>
    <tr><td style="padding:4px 0;">E · CRM &amp; Process</td><td style="text-align:right;">${bySection.E.score} / ${bySection.E.max}</td></tr>
    <tr><td style="padding:4px 0;">F · Role-play</td><td style="text-align:right;">Pending manual review</td></tr>
  </table>
  <p style="margin-top:20px;">
    <a href="${dashboardBase}/recruit/sdr-test/admin" style="background:#1a9181; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none; display:inline-block;">Review full transcript</a>
  </p>
  <p style="font-size:11px; color:#666; margin-top:16px;">
    Auto-scoring is keyword-based. Section F and any flagged answers should be reviewed manually before deciding.
  </p>
</div>`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: `Work-Sync Recruit <${fromEmail}>`,
          to: [toEmail],
          subject,
          html,
        }),
      });
      if (!emailRes.ok) {
        const err = await emailRes.text();
        console.error('Resend send failed:', emailRes.status, err);
      }
    } else {
      console.warn('RESEND_API_KEY not set — skipped email');
    }

    return new Response(JSON.stringify({ ok: true, score: total, verdict }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
