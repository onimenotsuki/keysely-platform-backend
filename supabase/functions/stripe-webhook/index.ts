import { logger } from '@shared/logger.ts';
import { captureAndFlush, initSentry } from '@shared/sentry.ts';
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import Stripe from 'https://esm.sh/stripe@18.5.0';

initSentry();

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-08-27.basil',
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

serve(async (req) => {
  logger.logRequest(req);

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      logger.error('Missing signature or webhook secret');
      return new Response('Missing signature or webhook secret', {
        status: 400,
      });
    }

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      return new Response('Webhook signature verification failed', {
        status: 400,
      });
    }

    logger.info(`Received webhook event: ${event.type}`);

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.metadata?.booking_id) {
          logger.info(`Payment completed for booking: ${session.metadata.booking_id}`);

          // Update booking status to paid
          const { error } = await supabaseClient
            .from('bookings')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              stripe_payment_intent_id: session.payment_intent as string,
            })
            .eq('id', session.metadata.booking_id);

          if (error) {
            logger.error('Error updating booking status:', error);
          } else {
            logger.info(`Booking ${session.metadata.booking_id} marked as paid and confirmed`);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        if (paymentIntent.metadata?.booking_id) {
          logger.info(`Payment failed for booking: ${paymentIntent.metadata.booking_id}`);

          // Update booking status to failed
          const { error } = await supabaseClient
            .from('bookings')
            .update({
              payment_status: 'failed',
              status: 'cancelled',
            })
            .eq('id', paymentIntent.metadata.booking_id);

          if (error) {
            logger.error('Error updating booking status:', error);
          } else {
            logger.info(`Booking ${paymentIntent.metadata.booking_id} marked as failed`);
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;

        logger.info(`Connect account updated: ${account.id}`);

        // Update Connect account status in database
        const { error } = await supabaseClient
          .from('stripe_connect_accounts')
          .update({
            account_enabled: account.charges_enabled && account.payouts_enabled,
            details_submitted: account.details_submitted,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
          })
          .eq('stripe_account_id', account.id);

        if (error) {
          logger.error('Error updating Connect account status:', error);
        } else {
          logger.info(`Connect account ${account.id} status updated`);
        }
        break;
      }

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Webhook error:', error);
    await captureAndFlush(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
