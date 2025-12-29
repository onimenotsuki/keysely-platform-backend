import { logger } from '@shared/logger.ts';
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import Stripe from 'https://esm.sh/stripe@18.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  logger.logRequest(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client using service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

    logger.info(`Creating Connect account for user: ${user.id}`);

    // Check if user already has a Connect account
    const { data: existingAccount } = await supabaseClient
      .from('stripe_connect_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingAccount?.stripe_account_id) {
      logger.info(`User already has Connect account: ${existingAccount.stripe_account_id}`);
      return new Response(
        JSON.stringify({
          account_id: existingAccount.stripe_account_id,
          onboarding_url: existingAccount.onboarding_url,
          account_enabled: existingAccount.account_enabled,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Get user profile for additional info
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // You might want to make this configurable
      email: user.email,
      business_profile: {
        name: profile?.full_name || 'Space Owner',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    logger.info(`Created Stripe Connect account: ${account.id}`);

    // Create onboarding link
    const accountLinks = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.headers.get('origin')}/owner-dashboard?refresh=true`,
      return_url: `${req.headers.get('origin')}/owner-dashboard?success=true`,
      type: 'account_onboarding',
    });

    // Save to database
    const { error: insertError } = await supabaseClient.from('stripe_connect_accounts').insert({
      user_id: user.id,
      stripe_account_id: account.id,
      onboarding_url: accountLinks.url,
      account_enabled: false,
      details_submitted: false,
      charges_enabled: false,
      payouts_enabled: false,
    });

    if (insertError) {
      logger.error('Error saving Connect account to database:', insertError);
      throw new Error('Failed to save account information');
    }

    logger.info(`Connect account saved to database for user: ${user.id}`);

    return new Response(
      JSON.stringify({
        account_id: account.id,
        onboarding_url: accountLinks.url,
        account_enabled: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    logger.error('Error in create-connect-account:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
