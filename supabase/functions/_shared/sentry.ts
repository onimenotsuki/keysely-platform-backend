import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

/**
 * Initialize Sentry for edge function error tracking
 * Call this at the module level (before serve())
 */
export function initSentry() {
  Sentry.init({
    dsn: Deno.env.get('SENTRY_DSN') ?? '',
    sendDefaultPii: true,
  });
}

/**
 * Capture an exception to Sentry and flush it
 * Use this in catch blocks to track errors
 * @param error - The error to capture
 * @param flushTimeout - Time in ms to wait for Sentry to flush (default: 2000)
 */
export async function captureAndFlush(error: unknown, flushTimeout = 2000): Promise<void> {
  Sentry.captureException(error);
  await Sentry.flush(flushTimeout);
}

// Re-export Sentry for additional functionality if needed
export { Sentry };
