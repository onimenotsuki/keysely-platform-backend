/**
 * Didit Session Status – checks verification session status.
 * Returns { status: string } reading from DB (updated by webhook) or proxy to
 * Didit GET /v3/session/{id}/decision/.
 * Status values mapped: "In Progress" | "In Review" | "Approved" | "Declined"
 * (skill didit: Not Started, In Progress, In Review, Resubmitted = non-terminal;
 * Approved, Declined, Abandoned, Expired = terminal).
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { corsHeaders } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';

const DIDIT_BASE = Deno.env.get('DIDIT_API_URL');
if (!DIDIT_BASE) {
  throw new Error('DIDIT_API_URL is not set');
}

/** Didit decision response (GET /v3/session/{id}/decision/). */
interface DiditDecisionResponse {
  session_id: string;
  status: string;
  features?: string[];
  vendor_data?: string;
  workflow_id?: string;
  id_verifications?: unknown[];
  liveness_checks?: unknown[];
  face_matches?: unknown[];
  phone_verifications?: unknown[];
  email_verifications?: unknown[];
  aml_screenings?: unknown[];
  poa_verifications?: unknown[];
  nfc_verifications?: unknown[];
  ip_analyses?: unknown[];
  database_validations?: unknown[];
  reviews?: unknown[];
}

/**
 * Get session status from database (if stored by webhook).
 * Returns null if not found or table doesn't exist.
 */
async function getStatusFromDB(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('didit_sessions')
      .select('status')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      // Table might not exist yet, or session not found
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // PGRST116 = not found, 42P01 = table doesn't exist
        return null;
      }
      logger.debug('DB query error (non-fatal)', error);
      return null;
    }

    return data?.status ?? null;
  } catch {
    // Table might not exist
    return null;
  }
}

/**
 * Get session status from Didit API (proxy).
 */
async function getStatusFromDidit(sessionId: string): Promise<string | null> {
  const apiKey = Deno.env.get('DIDIT_API_KEY');
  if (!apiKey) {
    logger.error('DIDIT_API_KEY is not set');
    return null;
  }

  try {
    const res = await fetch(`${DIDIT_BASE}/session/${sessionId}/decision/`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        logger.info(`Session ${sessionId} not found in Didit`);
        return null;
      }
      logger.error('Didit API error', { status: res.status });
      return null;
    }

    const data = (await res.json()) as DiditDecisionResponse;
    return data.status ?? null;
  } catch (err) {
    logger.error('Didit API request failed', err);
    return null;
  }
}

serve(async (req) => {
  logger.logRequest(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'session_id query parameter is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create Supabase client for DB lookup
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  // Try DB first (updated by webhook)
  let status = await getStatusFromDB(supabase, sessionId);

  // If not in DB, proxy to Didit API
  if (!status) {
    logger.info(`Session ${sessionId} not in DB, fetching from Didit`);
    status = await getStatusFromDidit(sessionId);
  }

  if (!status) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ status }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
