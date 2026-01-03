import { logger } from '@shared/logger.ts';
import { captureAndFlush, initSentry } from '@shared/sentry.ts';
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import Stripe from 'https://esm.sh/stripe@18.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

initSentry();

serve(async (req) => {
  logger.logRequest(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;

    if (!user?.email) {
      throw new Error('User not authenticated or email not available');
    }

    logger.info(`Checking Connect status for user: ${user.id}`);

    // Get user's Connect account from database
    const { data: connectAccount, error: connectError } = await supabaseClient
      .from('stripe_connect_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connectError || !connectAccount?.stripe_account_id) {
      return new Response(
        JSON.stringify({
          has_account: false,
          account_enabled: false,
          needs_onboarding: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    // Initialize Stripe and get account details
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    const account = await stripe.accounts.retrieve(connectAccount.stripe_account_id);

    logger.info(
      `Stripe account status - ID: ${account.id}, Enabled: ${account.charges_enabled}, Details: ${account.details_submitted}`,
    );

    // Update local database with latest status
    const { error: updateError } = await supabaseClient
      .from('stripe_connect_accounts')
      .update({
        account_enabled: account.charges_enabled && account.payouts_enabled,
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      })
      .eq('user_id', user.id);

    if (updateError) {
      logger.error('Error updating Connect account status:', updateError);
    }

    const needsOnboarding = !account.details_submitted || !account.charges_enabled;
    let onboardingUrl = null;

    // Create new onboarding link if needed
    if (needsOnboarding) {
      const accountLinks = await stripe.accountLinks.create({
        account: connectAccount.stripe_account_id,
        refresh_url: `${req.headers.get('origin')}/owner-dashboard?refresh=true`,
        return_url: `${req.headers.get('origin')}/owner-dashboard?success=true`,
        type: 'account_onboarding',
      });

      onboardingUrl = accountLinks.url;

      // Update onboarding URL in database
      await supabaseClient
        .from('stripe_connect_accounts')
        .update({ onboarding_url: onboardingUrl })
        .eq('user_id', user.id);
    }

    return new Response(
      JSON.stringify({
        has_account: true,
        account_id: connectAccount.stripe_account_id,
        account_enabled: account.charges_enabled && account.payouts_enabled,
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        needs_onboarding: needsOnboarding,
        onboarding_url: onboardingUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    logger.error('Error in check-connect-status:', error);
    await captureAndFlush(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
