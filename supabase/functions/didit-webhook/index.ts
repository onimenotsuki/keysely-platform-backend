/**
 * Didit Webhook handler – receives verification session events from Didit.
 * Verifies HMAC signature (X-Signature-V2 or X-Signature-Simple) then processes the event.
 * Configure your webhook URL in Didit Console → API & Webhooks.
 *
 * Also handles GET requests as fallback when Didit redirects the browser
 * with verificationSessionId and status query params (for immediate compatibility).
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { logger } from '../_shared/logger.ts';

const WEBHOOK_SECRET = Deno.env.get('DIDIT_WEBHOOK_SECRET');
const MAX_TIMESTAMP_DRIFT_SEC = 300; // 5 minutes

/** Webhook payload from Didit (status.updated | data.updated). */
interface DiditWebhookPayload {
  session_id: string;
  status: string;
  webhook_type: 'status.updated' | 'data.updated';
  timestamp?: number;
  vendor_data?: string;
  workflow_id?: string;
  metadata?: Record<string, unknown>;
  decision?: Record<string, unknown>;
}

/**
 * HMAC-SHA256 hex digest using Web Crypto API (Deno-compatible).
 */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  let out = 0;
  for (let i = 0; i < bufA.length; i++) {
    out |= bufA[i]! ^ bufB[i]!;
  }
  return out === 0;
}

/**
 * Process floats to match Didit server-side behavior (whole-number floats → int).
 */
function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(shortenFloats);
  }
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, shortenFloats(v)]));
  }
  if (typeof data === 'number' && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

/**
 * Sort object keys recursively for canonical JSON (X-Signature-V2).
 */
function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
          return acc;
        },
        {} as Record<string, unknown>,
      );
  }
  return obj;
}

/**
 * Verify X-Signature-V2 (recommended). Uses sorted keys + unescaped Unicode.
 */
async function verifySignatureV2(
  jsonBody: DiditWebhookPayload,
  signatureHeader: string,
  timestampHeader: string,
  secretKey: string,
): Promise<boolean> {
  const currentTime = Math.floor(Date.now() / 1000);
  const incomingTime = parseInt(timestampHeader, 10);
  if (
    Number.isNaN(incomingTime) ||
    Math.abs(currentTime - incomingTime) > MAX_TIMESTAMP_DRIFT_SEC
  ) {
    return false;
  }
  const processed = shortenFloats(jsonBody) as DiditWebhookPayload;
  const canonical = JSON.stringify(sortKeys(processed));
  const expected = await hmacSha256Hex(secretKey, canonical);
  return timingSafeEqual(expected, signatureHeader);
}

/**
 * Verify X-Signature-Simple (fallback). Core fields only.
 */
async function verifySignatureSimple(
  jsonBody: DiditWebhookPayload,
  signatureHeader: string,
  timestampHeader: string,
  secretKey: string,
): Promise<boolean> {
  const currentTime = Math.floor(Date.now() / 1000);
  const incomingTime = parseInt(timestampHeader, 10);
  if (
    Number.isNaN(incomingTime) ||
    Math.abs(currentTime - incomingTime) > MAX_TIMESTAMP_DRIFT_SEC
  ) {
    return false;
  }
  const canonical = [
    jsonBody.timestamp ?? '',
    jsonBody.session_id ?? '',
    jsonBody.status ?? '',
    jsonBody.webhook_type ?? '',
  ].join(':');
  const expected = await hmacSha256Hex(secretKey, canonical);
  return timingSafeEqual(expected, signatureHeader);
}

/**
 * Handle a verified Didit webhook event. Persists to database and processes business logic.
 */
async function handleDiditEvent(payload: DiditWebhookPayload): Promise<void> {
  const { session_id, status, webhook_type, vendor_data, workflow_id, metadata, decision } =
    payload;
  logger.info(`Didit webhook: type=${webhook_type} session_id=${session_id} status=${status}`, {
    vendor_data,
    workflow_id,
  });

  // Create Supabase client with service role for webhook persistence
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  // Upsert session status to database
  const { error: dbError } = await supabase.from('didit_sessions').upsert(
    {
      session_id,
      status,
      webhook_type,
      vendor_data: vendor_data ?? null,
      workflow_id: workflow_id ?? null,
      metadata: metadata ?? {},
      decision: decision ?? null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'session_id',
    },
  );

  if (dbError) {
    logger.error('Failed to persist session to database', dbError);
    // Continue processing even if DB write fails
  } else {
    logger.info(`Session ${session_id} persisted to database with status ${status}`);
  }

  switch (webhook_type) {
    case 'status.updated':
      logger.info(`Session ${session_id} status updated to ${status}`);
      if (decision && ['Approved', 'Declined', 'In Review', 'Abandoned'].includes(status)) {
        logger.debug('Decision payload present', decision);
      }
      break;
    case 'data.updated':
      logger.info(`Session ${session_id} data updated (manual review)`);
      break;
    default:
      logger.info(`Unhandled webhook_type: ${webhook_type}`);
  }
}

serve(async (req) => {
  logger.logRequest(req);

  // Handle GET requests from browser redirects (fallback for immediate compatibility)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const verificationSessionId = url.searchParams.get('verificationSessionId');
    const status = url.searchParams.get('status');

    if (verificationSessionId && status) {
      logger.info(
        `Received GET request with callback params: session_id=${verificationSessionId} status=${status}`,
      );

      try {
        // Update session in database (triggers Realtime notification)
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          { auth: { persistSession: false } },
        );

        // Get existing session to preserve vendor_data and workflow_id
        const { data: existingSession } = await supabase
          .from('didit_sessions')
          .select('vendor_data, workflow_id, metadata')
          .eq('session_id', verificationSessionId)
          .maybeSingle();

        // Upsert session status to database
        // If session doesn't exist yet, create it with default values
        const { error: dbError } = await supabase.from('didit_sessions').upsert(
          {
            session_id: verificationSessionId,
            status,
            webhook_type: 'status.updated' as const,
            vendor_data: existingSession?.vendor_data ?? null,
            workflow_id: existingSession?.workflow_id ?? null,
            metadata: existingSession?.metadata ?? {},
            decision: null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'session_id',
          },
        );

        if (dbError) {
          logger.error('Failed to persist session from GET request', dbError);
        } else {
          logger.info(
            `Session ${verificationSessionId} updated from GET request with status ${status}`,
          );
        }

        // Redirect to frontend
        const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:8080';
        const redirectUrl = new URL(siteUrl);
        redirectUrl.searchParams.set('verificationSessionId', verificationSessionId);
        redirectUrl.searchParams.set('status', status);

        return Response.redirect(redirectUrl.toString(), 302);
      } catch (err) {
        logger.error('Error processing GET request', err);
        const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:8080';
        return Response.redirect(`${siteUrl}?error=webhook_get_failed`, 302);
      }
    }
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();
  const signatureV2 = req.headers.get('X-Signature-V2');
  const signatureSimple = req.headers.get('X-Signature-Simple');
  const timestamp = req.headers.get('X-Timestamp');

  if (!timestamp || !WEBHOOK_SECRET) {
    logger.error('Missing X-Timestamp or DIDIT_WEBHOOK_SECRET');
    return new Response(JSON.stringify({ error: 'Missing required headers or config' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: DiditWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DiditWebhookPayload;
  } catch {
    logger.error('Invalid webhook body: not JSON');
    return new Response(JSON.stringify({ error: 'Invalid body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let verified = false;
  if (signatureV2) {
    verified = await verifySignatureV2(payload, signatureV2, timestamp, WEBHOOK_SECRET);
    if (verified) logger.info('Verified with X-Signature-V2');
  }
  if (!verified && signatureSimple) {
    verified = await verifySignatureSimple(payload, signatureSimple, timestamp, WEBHOOK_SECRET);
    if (verified) logger.info('Verified with X-Signature-Simple');
  }

  if (!verified) {
    logger.error('Webhook signature verification failed');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await handleDiditEvent(payload);
  } catch (err) {
    logger.error('Error processing Didit webhook', err);
    // Return 200 so Didit does not retry; log for manual follow-up
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
