import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Verify platform admin access
    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_platform_admin) throw new Error('Not a platform admin');

    // Gather platform-wide data for AI analysis
    const [
      { data: orgs },
      { data: platformStats },
      { data: errorLogs },
      { data: recentActivity },
    ] = await Promise.all([
      supabase.from('organizations').select('id, name, slug, created_at, settings'),
      supabase.rpc('get_platform_admin_stats'),
      supabase.from('error_logs')
        .select('error_type, error_message, org_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('activity_log')
        .select('action, entity_type, created_at, org_id')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    // Get per-org stats
    const orgStats = await Promise.all(
      (orgs || []).slice(0, 20).map(async (org) => {
        const { data } = await supabase.rpc('get_org_statistics', { p_org_id: org.id });
        return {
          name: org.name,
          created: org.created_at,
          isActive: (org.settings as any)?.is_active !== false,
          users: (data as any)?.user_count || 0,
          contacts: (data as any)?.contact_count || 0,
          activeToday: (data as any)?.active_users_1d || 0,
          active7d: (data as any)?.active_users_7d || 0,
          active30d: (data as any)?.active_users_30d || 0,
          calls: (data as any)?.call_volume || 0,
          emails: (data as any)?.email_volume || 0,
        };
      })
    );

    // Error patterns
    const errorGroups: Record<string, number> = {};
    for (const log of errorLogs || []) {
      const key = log.error_type || 'unknown';
      errorGroups[key] = (errorGroups[key] || 0) + 1;
    }

    const prompt = `You are a platform operations analyst for a multi-tenant CRM system called In-Sync. Analyze the following platform data and provide strategic insights.

PLATFORM SUMMARY:
- Total Organizations: ${(platformStats as any)?.total_organizations || 0}
- Total Users: ${(platformStats as any)?.total_users || 0}
- Total Contacts: ${(platformStats as any)?.total_contacts || 0}
- Active Users (24h): ${(platformStats as any)?.active_users_1d || 0}
- Active Users (7d): ${(platformStats as any)?.active_users_7d || 0}
- Active Users (30d): ${(platformStats as any)?.active_users_30d || 0}

ORGANIZATION BREAKDOWN:
${orgStats.map(o => `- ${o.name}: ${o.users} users, ${o.contacts} contacts, ${o.activeToday} active today, ${o.calls} calls, ${o.emails} emails, Status: ${o.isActive ? 'Active' : 'Inactive'}`).join('\n')}

RECENT ERRORS (last 50):
${Object.entries(errorGroups).map(([type, count]) => `- ${type}: ${count} occurrences`).join('\n') || 'No errors'}

Provide exactly 4-5 concise bullet-point insights covering:
1. Platform health & adoption trends
2. Organizations needing attention (low activity, no users, etc.)
3. Error patterns and recommended actions
4. Growth opportunities
5. Actionable recommendations for the platform admin

Keep each insight to 1-2 sentences. Be specific with numbers. Start each insight with a bold category label.`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: 'You are a concise platform operations analyst. Provide actionable insights in bullet-point format. Use **bold** for emphasis.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Anthropic API error:', errorText);
      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    const insight = aiData.content?.[0]?.text || 'No insights available.';

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Platform AI insights error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
