import Typesense from 'typesense';

export function getTypesenseClient() {
  const TYPESENSE_HOST = Deno.env.get('TYPESENSE_HOST') as string;
  const TYPESENSE_API_KEY = Deno.env.get('TYPESENSE_API_KEY') as string;
  const TYPESENSE_PORT = Number(Deno.env.get('TYPESENSE_PORT'));
  const TYPESENSE_PROTOCOL = Deno.env.get('TYPESENSE_PROTOCOL') as string;

  if (!TYPESENSE_HOST || !TYPESENSE_API_KEY || !TYPESENSE_PORT || !TYPESENSE_PROTOCOL) {
    throw new Error('Typesense not configured');
  }

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
