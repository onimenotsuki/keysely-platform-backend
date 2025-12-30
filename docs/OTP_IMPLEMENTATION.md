# OTP & Custom Auth Implementation Guide

This document guides you through the OTP authentication flow, using Supabase's SMTP integration and our custom edge functions.

## Overview

We utilize Supabase's built-in SMTP capabilities (configured with Brevo) to send transactional emails. The `auth-email-handler` Edge Function acts as a secure server-side entry point to trigger these OTPs with enhanced logging and control.

## 1. Sending the OTP (Login/Signup)

You can trigger the OTP email by invoking the `auth-email-handler` Edge Function. This function internally calls Supabase's `signInWithOtp` and logs the request.

### Frontend Code Example

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY')

async function handleLogin(email: string) {
  // Invoke the custom Edge Function to trigger OTP
  const { data, error } = await supabase.functions.invoke('auth-email-handler', {
    body: {
      user: { email },
      email_data: {
        redirect_to: `${window.location.origin}/auth/callback`
      }
    }
  })

  if (error) {
    console.error('Error sending OTP:', error)
    alert('Failed to send login code.')
  } else {
    console.log('OTP sent! Check your email.')
    // Navigate to OTP input screen
  }
}
```

> **Note**: Standard `supabase.auth.signInWithOtp()` on the client will also work if you prefer direct access, but the Edge Function allows for centralized logging and control.

## 2. Verifying the OTP (Custom Validation)

**Important**: Continue using the `validate-session-custom` Edge Function to verify the OTP. This ensures validation logic remains centralized.

### Frontend Code Example

```typescript
async function verifyUserOtp(email: string, otpCode: string) {
  
  // Invoke the custom Edge Function
  const { data, error } = await supabase.functions.invoke('validate-session-custom', {
    body: {
      email,
      otp_code: otpCode
    }
  })

  if (error) {
    console.error('Verification failed:', error)
    alert('Invalid code. Please try again.')
    return
  }

  if (data?.session) {
    console.log('Successfully verified!')

    // Manually set the session in the local Supabase client
    const { error: sessionError } = await supabase.auth.setSession(data.session)

    if (sessionError) {
      console.error('Failed to set session:', sessionError)
    } else {
      // Redirect to dashboard or home
      window.location.href = '/dashboard'
    }
  }
}
```

## 3. Configuration Requirements

For this system to work, the Supabase project must be configured correctly:

1.  **SMTP Configuration**: Ensure SMTP is enabled in `supabase/config.toml` (or your project settings) and pointing to Brevo (or your provider).
    *   **Host**: `smtp-relay.brevo.com`
    *   **Port**: `587`
    *   **User/Pass**: Configured via Secrets (`BREVO_SMTP_PASS`).
2.  **Edge Function Secrets**: 
    *   `SUPABASE_URL`: Required for `auth-email-handler` to initialize the client.
    *   `SUPABASE_ANON_KEY`: Required for `auth-email-handler`.

> [!WARNING]
> **Do NOT configure `auth-email-handler` as a "Send Email Hook"** in the Supabase Dashboard. Doing so will cause an infinite loop, as the function itself triggers an email, which would re-trigger the hook.

## Troubleshooting

-   **502 Error**: Check `auth-email-handler` logs. Could be an issue with the internal `signInWithOtp` call or missing `SUPABASE_URL`/`KEY`.
-   **Emails not arriving**: Check Brevo/SMTP logs and Supabase Auth logs. Ensure credentials are correct.
-   **Infinite Loop**: Verify that no Auth Hook is configured to point to `auth-email-handler`.
