import {
  assert,
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import 'https://deno.land/x/dotenv/load.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

Deno.test('update-space-rating: missing space_id should return 500 error', async () => {
  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${supabaseKey}` } },
  });

  const { data, error } = await client.functions.invoke('update-space-rating', {
    body: {},
  });

  assert(error, 'Expected an error response for missing space_id');
});
