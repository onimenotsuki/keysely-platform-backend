/**
 * Didit Create Session – creates a verification session via Didit API.
 * Returns session URL and token for redirecting the user to complete verification.
 * Requires DIDIT_API_KEY; optional DIDIT_WORKFLOW_ID and DIDIT_APPLICATION_ID as defaults.
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';

const DIDIT_BASE = 'https://verification.didit.me/v3';

/** Request body for creating a session (matches Didit API). */
interface CreateSessionBody {
  workflow_id?: string;
  application_id?: string;
  vendor_data?: string;
  callback?: string;
  callback_method?: 'initiator' | 'completer' | 'both';
  metadata?: string;
  language?: string;
  contact_details?: {
    email?: string;
    phone?: string;
    send_notification_emails?: boolean;
    email_lang?: string;
  };
  expected_details?: {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    gender?: 'M' | 'F' | null;
    nationality?: string;
    country?: string;
    address?: string;
    identification_number?: string;
    ip_address?: string;
  };
  portrait_image?: string;
}

/** Didit create-session response (201). */
interface DiditSessionResponse {
  session_id: string;
  session_number: number;
  session_token: string;
  url: string;
  vendor_data?: string;
  status: string;
  workflow_id: string;
  callback?: string;
}

serve(async (req) => {
  logger.logRequest(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('DIDIT_API_KEY');
  const defaultWorkflowId = Deno.env.get('DIDIT_WORKFLOW_ID');
  const defaultApplicationId = Deno.env.get('DIDIT_APPLICATION_ID');

  if (!apiKey) {
    logger.error('DIDIT_API_KEY is not set');
    return new Response(
      JSON.stringify({
        error:
          'DIDIT_API_KEY is not set. Set it in Supabase Dashboard → Project Settings → Edge Functions → Secrets.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let body: CreateSessionBody;
  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === '') {
      logger.error('Empty request body');
      return new Response(
        JSON.stringify({
          error: 'Request body is required',
          details:
            'Send a JSON object with at least workflow_id or configure DIDIT_WORKFLOW_ID secret',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    body = JSON.parse(rawBody) as CreateSessionBody;
    logger.info('Request body received', {
      hasWorkflowId: !!body.workflow_id,
      bodyKeys: Object.keys(body),
      bodyPreview: JSON.stringify(body).slice(0, 200),
    });
  } catch (parseErr) {
    logger.error('Failed to parse JSON body', parseErr);
    return new Response(
      JSON.stringify({
        error: 'Invalid JSON body',
        details: parseErr instanceof Error ? parseErr.message : 'Unknown parsing error',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const workflow_id = body.workflow_id ?? defaultWorkflowId;
  if (!workflow_id) {
    logger.error('workflow_id missing', {
      hasBodyWorkflowId: !!body.workflow_id,
      hasDefaultWorkflowId: !!defaultWorkflowId,
      bodyReceived: JSON.stringify(body),
    });
    return new Response(
      JSON.stringify({
        error:
          'workflow_id is required in request body or set DIDIT_WORKFLOW_ID as Edge Function secret',
        details: {
          received: {
            workflow_id: body.workflow_id ?? null,
            hasDefaultWorkflowId: !!defaultWorkflowId,
            bodyKeys: Object.keys(body),
          },
          solution:
            'Either include "workflow_id" in your request body or configure DIDIT_WORKFLOW_ID secret in Supabase Dashboard',
        },
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Use application_id from body or default from environment
  const application_id = body.application_id ?? defaultApplicationId;

  // Validate and normalize expected_details if present
  let expectedDetails = body.expected_details;
  if (expectedDetails) {
    const validatedCountry = validateCountryCode(expectedDetails.country);
    const validatedNationality = validateCountryCode(expectedDetails.nationality);

    if (expectedDetails.country && !validatedCountry) {
      return new Response(
        JSON.stringify({
          error: 'Invalid country code format',
          details: {
            received: expectedDetails.country,
            expected: 'ISO 3166-1 alpha-3 code (3 letters, e.g., "USA", "MEX", "GBR")',
            examples: ['USA', 'MEX', 'GBR', 'ESP', 'ARG'],
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (expectedDetails.nationality && !validatedNationality) {
      return new Response(
        JSON.stringify({
          error: 'Invalid nationality code format',
          details: {
            received: expectedDetails.nationality,
            expected: 'ISO 3166-1 alpha-3 code (3 letters, e.g., "USA", "MEX", "GBR")',
            examples: ['USA', 'MEX', 'GBR', 'ESP', 'ARG'],
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create validated expected_details object with only valid fields
    expectedDetails = {
      ...(expectedDetails.first_name !== undefined && { first_name: expectedDetails.first_name }),
      ...(expectedDetails.last_name !== undefined && { last_name: expectedDetails.last_name }),
      ...(expectedDetails.date_of_birth !== undefined && {
        date_of_birth: expectedDetails.date_of_birth,
      }),
      ...(expectedDetails.gender !== undefined && { gender: expectedDetails.gender }),
      ...(validatedNationality && { nationality: validatedNationality }),
      ...(validatedCountry && { country: validatedCountry }),
      ...(expectedDetails.address !== undefined && { address: expectedDetails.address }),
      ...(expectedDetails.identification_number !== undefined && {
        identification_number: expectedDetails.identification_number,
      }),
      ...(expectedDetails.ip_address !== undefined && { ip_address: expectedDetails.ip_address }),
    };
  }

  const payload: Record<string, unknown> = {
    workflow_id,
    ...(application_id && { application_id }),
    ...(body.vendor_data !== undefined && { vendor_data: body.vendor_data }),
    ...(body.callback !== undefined && { callback: body.callback }),
    ...(body.callback_method !== undefined && { callback_method: body.callback_method }),
    ...(body.metadata !== undefined && { metadata: body.metadata }),
    ...(body.language !== undefined && { language: body.language }),
    ...(body.contact_details !== undefined && { contact_details: body.contact_details }),
    ...(expectedDetails !== undefined && { expected_details: expectedDetails }),
    ...(body.portrait_image !== undefined && { portrait_image: body.portrait_image }),
  };

  logger.info('Calling Didit API', {
    workflow_id,
    application_id: application_id ?? null,
    payloadKeys: Object.keys(payload),
    hasApiKey: !!apiKey,
  });

  try {
    const res = await fetch(`${DIDIT_BASE}/session/`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text();
    let data: DiditSessionResponse | { detail?: string; message?: string };
    try {
      data = rawText
        ? (JSON.parse(rawText) as DiditSessionResponse | { detail?: string; message?: string })
        : {};
    } catch (parseErr) {
      logger.error('Didit API returned non-JSON', {
        status: res.status,
        rawPreview: rawText.slice(0, 200),
      });
      return new Response(
        JSON.stringify({
          error: res.ok
            ? 'Invalid JSON in Didit response'
            : `Didit API error (${res.status}): ${rawText.slice(0, 200)}`,
        }),
        {
          status: res.ok ? 502 : res.status >= 400 && res.status < 500 ? res.status : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!res.ok) {
      logger.error('Didit API error', { status: res.status, data });
      const message =
        typeof (data as { detail?: string }).detail === 'string'
          ? (data as { detail: string }).detail
          : ((data as { message?: string }).message ?? 'Didit API request failed');
      return new Response(JSON.stringify({ error: message }), {
        status: res.status >= 400 && res.status < 500 ? res.status : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const session = data as DiditSessionResponse;
    if (!session?.session_id) {
      logger.error('Didit response missing session_id', data);
      return new Response(
        JSON.stringify({ error: 'Invalid Didit session response (missing session_id)' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    logger.info(`Didit session created: ${session.session_id}`);

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create verification session';
    logger.error('Didit create session failed', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
