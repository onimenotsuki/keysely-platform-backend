import { corsHeaders } from '@shared/cors.ts';
import { logger } from '@shared/logger.ts';
import { getTypesenseClient } from '@shared/typesenseClient.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const client = getTypesenseClient();
    const health = await client.health.retrieve();

    logger.info('Typesense health check:', health);

    return new Response(JSON.stringify({ success: true, health }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Typesense health check failed:', errorMessage);

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
