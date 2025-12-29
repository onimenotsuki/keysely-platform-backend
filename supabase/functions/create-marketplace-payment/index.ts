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
    const { booking_id, space_id } = await req.json();

    if (!booking_id || !space_id) {
      throw new Error('booking_id and space_id are required');
    }

    // Create Supabase client
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

    console.log(`Creating marketplace payment for booking: ${booking_id}`);

    // Get booking details with space and owner info
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(
        `
        *,
        spaces!inner(
          *,
          profiles!inner(full_name, user_id)
        )
      `,
      )
      .eq('id', booking_id)
      .eq('user_id', user.id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found or unauthorized');
    }

    // Get space owner's Connect account
    const { data: connectAccount, error: connectError } = await supabaseClient
      .from('stripe_connect_accounts')
      .select('*')
      .eq('user_id', booking.spaces.profiles.user_id)
      .single();

    if (connectError || !connectAccount || !connectAccount.account_enabled) {
      throw new Error('Space owner has not completed Stripe Connect onboarding');
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Calculate amounts (platform takes 15% commission)
    const totalAmount = Math.round(parseFloat(booking.total_amount.toString()) * 100); // Convert to cents
    const platformFee = Math.round(totalAmount * 0.15); // 15% platform fee
    const ownerAmount = totalAmount - platformFee;

    logger.info(
      `Payment amounts - Total: ${totalAmount}, Platform fee: ${platformFee}, Owner: ${ownerAmount}`,
    );

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: userData.user?.user_metadata?.full_name || 'Customer',
      });
      customerId = customer.id;
    }

    // Create Checkout Session with Connect transfer
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Booking: ${booking.spaces.title}`,
              description: `${booking.total_hours} hours from ${booking.start_date} ${booking.start_time}`,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/bookings?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${req.headers.get('origin')}/space/${space_id}?payment=cancelled`,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: connectAccount.stripe_account_id,
        },
        metadata: {
          booking_id: booking_id,
          space_id: space_id,
          owner_id: booking.spaces.profiles.user_id,
        },
      },
      metadata: {
        booking_id: booking_id,
        space_id: space_id,
        owner_id: booking.spaces.profiles.user_id,
      },
    });

    // Update booking with Stripe session info
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({
        stripe_session_id: session.id,
        payment_status: 'pending_payment',
      })
      .eq('id', booking_id);

    if (updateError) {
      logger.error('Error updating booking with session ID:', updateError);
    }

    logger.info(`Checkout session created: ${session.id}`);

    return new Response(
      JSON.stringify({
        session_id: session.id,
        checkout_url: session.url,
        total_amount: totalAmount,
        platform_fee: platformFee,
        owner_amount: ownerAmount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    logger.error('Error in create-marketplace-payment:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
