import { logger } from '@shared/logger.ts';
import { captureAndFlush, initSentry } from '@shared/sentry.ts';
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

initSentry();

interface ValidateReviewRequest {
  user_id: string;
  space_id: string;
  booking_id: string;
}

serve(async (req) => {
  logger.logRequest(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, space_id, booking_id }: ValidateReviewRequest = await req.json();

    if (!user_id || !space_id || !booking_id) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'user_id, space_id, and booking_id are required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Create Supabase client using service role for full access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    logger.info(`Validating review for user ${user_id}, space ${space_id}, booking ${booking_id}`);

    // Get the specific booking to validate
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, user_id, space_id, status, payment_status, end_date, end_time')
      .eq('id', booking_id)
      .single();

    if (bookingError) {
      if (bookingError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Reserva no encontrada',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          },
        );
      }
      throw bookingError;
    }

    // Validate user owns the booking
    if (booking.user_id !== user_id) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'No tienes permiso para reseñar esta reserva',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        },
      );
    }

    // Validate booking belongs to the correct space
    if (booking.space_id !== space_id) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'La reserva no corresponde a este espacio',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Validate booking is confirmed and paid
    if (booking.status !== 'confirmed') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'La reserva debe estar confirmada',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    if (booking.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'La reserva debe estar pagada',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Calculate booking end datetime
    const endDateTime = new Date(`${booking.end_date}T${booking.end_time}`);
    const now = new Date();

    // Validate at least 1 hour has passed since booking end
    const oneHourAfterEnd = new Date(endDateTime.getTime() + 60 * 60 * 1000);
    if (now < oneHourAfterEnd) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Debe esperar al menos 1 hora después del fin de la reserva',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Validate booking is not older than 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (endDateTime < sixMonthsAgo) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Han pasado más de 6 meses desde la reserva',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Check if user has already reviewed this booking
    const { data: existingReview, error: reviewError } = await supabaseClient
      .from('reviews')
      .select('id')
      .eq('booking_id', booking_id)
      .eq('user_id', user_id)
      .single();

    if (reviewError && reviewError.code !== 'PGRST116') {
      throw reviewError;
    }

    if (existingReview) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Ya has reseñado esta reserva',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // All validations passed
    return new Response(
      JSON.stringify({
        valid: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    logger.error('Error in validate-review:', error);
    await captureAndFlush(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        valid: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
