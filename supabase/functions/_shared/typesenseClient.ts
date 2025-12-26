import Typesense from 'npm:typesense@latest';

export function getTypesenseClient() {
  const TYPESENSE_HOST = Deno.env.get('TYPESENSE_HOST');
  const TYPESENSE_API_KEY = Deno.env.get('TYPESENSE_API_KEY');
  const TYPESENSE_PORT = Deno.env.get('TYPESENSE_PORT');
  const TYPESENSE_PROTOCOL = Deno.env.get('TYPESENSE_PROTOCOL');

  if (!TYPESENSE_HOST || !TYPESENSE_API_KEY) {
    throw new Error('Typesense not configured');
  }

  console.log('Initializing Typesense client with:', {
    host: TYPESENSE_HOST,
    apiKeyPrefix: TYPESENSE_API_KEY.substring(0, 5) + '...',
    apiKeyLength: TYPESENSE_API_KEY.length,
  });

  return new Typesense.Client({
    nodes: [
      {
        host: TYPESENSE_HOST,
        port: TYPESENSE_PORT,
        protocol: TYPESENSE_PROTOCOL,
      },
    ],
    apiKey: TYPESENSE_API_KEY,
    connectionTimeoutSeconds: 5,
  });
}
