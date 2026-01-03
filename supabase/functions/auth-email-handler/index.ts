import { corsHeaders } from '@shared/cors.ts';
import { logger } from '@shared/logger.ts';
import { captureAndFlush, initSentry } from '@shared/sentry.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

interface HookPayload {
  user: {
    email: string;
  };
  email_data?: {
    redirect_to?: string;
  };
}

initSentry();

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

serve(async (req) => {
  logger.logRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: HookPayload = await req.json();
    const { user, email_data } = payload;
    const email = user.email;

    logger.info('Received email request', { email });

    const { data, error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: email_data?.redirect_to ?? 'https://keysely.com',
      },
    }); // Construct HTML content based on type

    if (error) {
      logger.error('Error sending email', { error });
      return new Response(JSON.stringify({ error: 'Failed to send email', details: error }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    logger.error('Unexpected error in auth-email-handler', { error });

    await captureAndFlush(error);

    return new Response(JSON.stringify({ error: 'Failed to send email', details: error }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
