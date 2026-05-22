import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, email, type } = await req.json();
    // type: 'phone' or 'email'

    const supabase = getSupabaseClient();

    if (type === 'phone') {
      // Validate Indian mobile number
      const clean = (phone || '').replace(/\D/g, '');
      if (clean.length !== 10 || !/^[6-9]/.test(clean)) {
        return new Response(
          JSON.stringify({ error: 'Invalid mobile number. Enter a 10-digit Indian mobile number.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalized = `+91${clean}`;

      // Rate limit: max 5 OTPs per phone per hour
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count } = await supabase
        .from('public_otp_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('identifier', normalized)
        .eq('identifier_type', 'phone')
        .gte('created_at', oneHourAgo);

      if ((count || 0) >= 5) {
        return new Response(
          JSON.stringify({ error: 'Too many OTP requests. Try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate & store OTP
      const otpCode = generateOtp();
      const { data: otpRecord, error: insertError } = await supabase
        .from('public_otp_verifications')
        .insert({ identifier: normalized, identifier_type: 'phone', otp_code: otpCode })
        .select('session_id')
        .single();

      if (insertError) {
        console.error('OTP insert error:', insertError);
        throw new Error('Failed to create OTP');
      }

      // Load system WhatsApp config
      const { data: config } = await supabase
        .from('otp_whatsapp_config')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!config?.exotel_sid) {
        // Test mode: return OTP directly (dev environment)
        console.warn('No WhatsApp config found — returning OTP in test mode');
        return new Response(
          JSON.stringify({
            success: true,
            sessionId: otpRecord.session_id,
            isTestMode: true,
            testOtp: otpCode,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send WhatsApp OTP via Exotel
      const toPhone = normalized.replace('+', '');
      const fromNumber = config.whatsapp_source_number.replace('+', '');

      const payload = {
        custom_data: toPhone,
        whatsapp: {
          messages: [
            {
              from: fromNumber,
              to: toPhone,
              content: {
                type: 'template',
                template: {
                  name: 'otp',
                  language: { code: 'en' },
                  components: [
                    {
                      type: 'body',
                      parameters: [{ type: 'text', text: otpCode }],
                    },
                    {
                      type: 'button',
                      sub_type: 'url',
                      index: '0',
                      parameters: [{ type: 'text', text: otpCode }],
                    },
                  ],
                },
              },
            },
          ],
        },
      };

      const subdomain = config.exotel_subdomain || 'api.exotel.com';
      const url = `https://${config.exotel_api_key}:${config.exotel_api_token}@${subdomain}/v2/accounts/${config.exotel_sid}/messages`;

      console.log('Sending WhatsApp OTP to:', toPhone);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Exotel error:', errText);
        return new Response(
          JSON.stringify({ error: 'Failed to send WhatsApp OTP. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          sessionId: otpRecord.session_id,
          message: 'OTP sent to your WhatsApp',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (type === 'email') {
      // Validate email
      const emailAddr = (email || '').trim().toLowerCase();
      if (!emailAddr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email address' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Rate limit: max 5 OTPs per email per hour
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count } = await supabase
        .from('public_otp_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('identifier', emailAddr)
        .eq('identifier_type', 'email')
        .gte('created_at', oneHourAgo);

      if ((count || 0) >= 5) {
        return new Response(
          JSON.stringify({ error: 'Too many OTP requests. Try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate & store OTP
      const otpCode = generateOtp();
      const { data: otpRecord, error: insertError } = await supabase
        .from('public_otp_verifications')
        .insert({ identifier: emailAddr, identifier_type: 'email', otp_code: otpCode })
        .select('session_id')
        .single();

      if (insertError) {
        console.error('OTP insert error:', insertError);
        throw new Error('Failed to create OTP');
      }

      // Send email OTP via Resend
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (!RESEND_API_KEY) {
        console.warn('No RESEND_API_KEY — returning OTP in test mode');
        return new Response(
          JSON.stringify({
            success: true,
            sessionId: otpRecord.session_id,
            isTestMode: true,
            testOtp: otpCode,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'In-Sync <verification@in-sync.co.in>',
          to: [emailAddr],
          subject: `${otpCode} is your In-Sync verification code`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #0f172a; margin-bottom: 8px;">Verify your email</h2>
              <p style="color: #64748b; margin-bottom: 24px;">Use the code below to complete your In-Sync registration:</p>
              <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">${otpCode}</span>
              </div>
              <p style="color: #94a3b8; font-size: 13px;">This code expires in 5 minutes. If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error('Resend error:', errText);
        return new Response(
          JSON.stringify({ error: 'Failed to send email OTP. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          sessionId: otpRecord.session_id,
          message: 'OTP sent to your email',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid type. Use "phone" or "email".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const err = error as Error;
    console.error('send-otp error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
