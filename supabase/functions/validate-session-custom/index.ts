import { corsHeaders } from '@shared/cors.ts';
import { logger } from '@shared/logger.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

serve(async (req) => {
  logger.logRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const { email, otp_code } = await req.json();

    if (!email || !otp_code) {
      throw new Error('Missing email or otp_code');
    }

    logger.info('Validating session', { email });

    const { data, error } = await supabaseClient.auth.verifyOtp({
      email,
      token: otp_code,
      type: 'email',
    });

    if (error) {
      logger.error('OTP Verification failed', { error });
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    logger.info('Session validated successfully', { userId: data.user?.id });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    logger.error('Unexpected error in validate-session-custom', { error });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
