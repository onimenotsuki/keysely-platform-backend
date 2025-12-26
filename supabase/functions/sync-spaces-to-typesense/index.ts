import { corsHeaders } from '@shared/cors.ts';
import { getTypesenseClient } from '@shared/typesenseClient.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Typesense from 'npm:typesense';

const TYPESENSE_COLLECTION_NAME = 'spaces';

interface TypesenseSpace {
  id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  state?: string;
  price_per_hour: number;
  currency: string;
  capacity: number;
  area_sqm?: number;
  images: string[];
  features: string[];
  amenities: string[];
  is_active: boolean;
  rating: number;
  total_reviews: number;
  category_id?: string;
  owner_id: string;
  location?: Typesense.GeoPoint;
}

interface SupabaseSpace {
  id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  address_object?: {
    state?: string;
    [key: string]: unknown;
  } | null;
  price_per_hour: number;
  currency: string;
  capacity: number;
  area_sqm?: number;
  images?: string[];
  features?: string[];
  amenities?: string[];
  is_active: boolean;
  rating?: number;
  total_reviews?: number;
  category_id?: string;
  owner_id: string;
  latitude?: number;
  longitude?: number;
}

// Helper function to add/update a record in Typesense
async function indexSpace(space: SupabaseSpace) {
  const typesenseClient = getTypesenseClient();

  // If space is not active, ensure it is removed from Typesense
  if (!space.is_active) {
    console.log(`Space ${space.id} is inactive, removing from Typesense if exists...`);

    return await deleteSpace(space.id);
  }

  const state = space.address_object?.state ?? '';

  const document: TypesenseSpace = {
    id: space.id,
    title: space.title ?? '',
    description: space.description ?? '',
    address: space.address ?? '',
    city: space.city ?? '',
    state: state,
    price_per_hour: space.price_per_hour,
    currency: space.currency ?? 'MXN',
    capacity: space.capacity ?? 0,
    area_sqm: space.area_sqm ?? undefined,
    images: space.images ?? [],
    features: space.features ?? [],
    amenities: space.amenities ?? [],
    is_active: space.is_active ?? false,
    rating: space.rating ?? 0,
    total_reviews: space.total_reviews ?? 0,
    category_id: space.category_id ?? '',
    owner_id: space.owner_id ?? '',
    location: space.latitude && space.longitude ? [space.latitude, space.longitude] : undefined,
  };

  return await typesenseClient.collections(TYPESENSE_COLLECTION_NAME).documents().upsert(document);
}

// Helper function to delete a record from Typesense
async function deleteSpace(spaceId: string) {
  const typesenseClient = getTypesenseClient();
  try {
    return await typesenseClient.collections(TYPESENSE_COLLECTION_NAME).documents(spaceId).delete();
  } catch (error) {
    // Ignore 404 errors when deleting
    if ((error as { httpStatus: number }).httpStatus !== 404) {
      throw error;
    }
    return { deleted: false };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check if Typesense is configured
    const TYPESENSE_HOST = Deno.env.get('TYPESENSE_HOST');
    const TYPESENSE_API_KEY = Deno.env.get('TYPESENSE_API_KEY');

    if (!TYPESENSE_HOST || !TYPESENSE_API_KEY) {
      console.log('Typesense not configured, skipping sync');
      return new Response(JSON.stringify({ message: 'Typesense not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let payload;
    try {
      const bodyText = await req.text();
      console.log('Raw request body:', bodyText);

      if (!bodyText) {
        console.warn('Received empty request body');
        return new Response(JSON.stringify({ error: 'Empty request body' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      payload = JSON.parse(bodyText);
      console.log('Parsed payload:', JSON.stringify(payload, null, 2));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error('Error parsing JSON:', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON body', details: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    const { type, table, record, old_record } = payload;

    // Only process spaces table
    if (table !== 'spaces') {
      return new Response(JSON.stringify({ message: 'Not a spaces record' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Processing ${type} event for space ${record?.id || old_record?.id}`);

    // Handle different event types
    if (type === 'INSERT' || type === 'UPDATE') {
      await indexSpace(record as SupabaseSpace);
      console.log(`Successfully processed space ${record.id}`);
    } else if (type === 'DELETE') {
      await deleteSpace(old_record.id);
      console.log(`Successfully deleted space ${old_record.id} from Typesense`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error syncing to Typesense:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
