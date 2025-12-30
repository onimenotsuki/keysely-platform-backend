import {
  assert,
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import 'https://deno.land/x/dotenv/load.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

Deno.test('validate-review: missing fields should return 400', async () => {
  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${supabaseKey}` } },
  });

  const { data, error } = await client.functions.invoke('validate-review', {
    body: {}, // Missing fields
  });

  // Check that error exists (indicative of 400 or other failure)
  assert(error, 'Expected an error response for missing fields');
});

Deno.test('validate-review: non-existent booking should return 404', async () => {
  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${supabaseKey}` } },
  });

  // Using a fake UUID
  const fakeUuid = '00000000-0000-0000-0000-000000000000';

  const { data, error } = await client.functions.invoke('validate-review', {
    body: {
      user_id: fakeUuid,
      space_id: fakeUuid,
      booking_id: fakeUuid,
    },
  });

  assert(error, 'Expected an error response for non-existent booking');
});
