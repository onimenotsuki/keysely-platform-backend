import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { space_id } = await req.json();

    if (!space_id) {
      throw new Error('space_id is required');
    }

    // Create Supabase client using service role for full access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    console.log(`Updating rating for space: ${space_id}`);

    // Calculate average rating and total reviews for the space
    const { data: reviews, error: reviewsError } = await supabaseClient
      .from('reviews')
      .select('rating')
      .eq('space_id', space_id);

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      throw reviewsError;
    }

    let averageRating = 0;
    let totalReviews = 0;

    if (reviews && reviews.length > 0) {
      totalReviews = reviews.length;
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      averageRating = totalRating / totalReviews;
      // Round to 1 decimal place
      averageRating = Math.round(averageRating * 10) / 10;
    }

    console.log(`Calculated rating: ${averageRating} from ${totalReviews} reviews`);

    // Update space with new rating and review count
    const { error: updateError } = await supabaseClient
      .from('spaces')
      .update({
        rating: averageRating,
        total_reviews: totalReviews,
      })
      .eq('id', space_id);

    if (updateError) {
      console.error('Error updating space:', updateError);
      throw updateError;
    }

    console.log(
      `Successfully updated space ${space_id} with rating ${averageRating} and ${totalReviews} reviews`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        space_id: space_id,
        average_rating: averageRating,
        total_reviews: totalReviews,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in update-space-rating:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
