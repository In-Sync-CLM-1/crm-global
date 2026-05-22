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
    const { sessionId, otp } = await req.json();

    if (!sessionId || !otp) {
      return new Response(
        JSON.stringify({ error: 'Session ID and OTP are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // Find the OTP record
    const { data: record, error: fetchError } = await supabase
      .from('public_otp_verifications')
      .select('*')
      .eq('session_id', sessionId)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (fetchError || !record) {
      return new Response(
        JSON.stringify({ error: 'OTP expired or invalid. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (record.attempts >= record.max_attempts) {
      return new Response(
        JSON.stringify({ error: 'Too many incorrect attempts. Please request a new OTP.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (record.otp_code !== otp.trim()) {
      // Increment attempts
      await supabase
        .from('public_otp_verifications')
        .update({ attempts: record.attempts + 1 })
        .eq('id', record.id);

      const remaining = record.max_attempts - record.attempts - 1;
      return new Response(
        JSON.stringify({
          error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as verified
    await supabase
      .from('public_otp_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', record.id);

    return new Response(
      JSON.stringify({
        verified: true,
        identifier: record.identifier,
        identifierType: record.identifier_type,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const err = error as Error;
    console.error('verify-otp error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
