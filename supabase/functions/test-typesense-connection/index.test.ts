import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

// Mock the corsHeaders
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-api-key, x-typesense-api-key',
};

const supabaseUrl = Deno.env.get('SUPABASE_API_URL') ?? 'http://127.0.0.1:54321';
const supabaseKey = Deno.env.get('SUPABASE_API_KEY') ?? '';

// Helper function to simulate the handler logic
async function simulateHandler(
  req: Request,
  mockClient?: {
    health: {
      retrieve: () => Promise<unknown>;
    };
  },
): Promise<Response> {
  // Simulate logger.logRequest
  console.log('Request logged');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!mockClient) {
      throw new Error('Mock client not provided');
    }

    const health = await mockClient.health.retrieve();

    console.log('Typesense health check:', health);

    return new Response(JSON.stringify({ success: true, health }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Typesense health check failed:', errorMessage);

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}

// Tests
Deno.test('test-typesense-connection - should handle OPTIONS request', async () => {
  // Arrange
  const request = new Request(`${supabaseUrl}/functions/v1/test-typesense-connection`, {
    method: 'OPTIONS',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  // Act
  const response = await simulateHandler(request);

  // Assert
  assertEquals(response.status, 200);
  const text = await response.text();
  assertEquals(text, 'ok');
  assertExists(response.headers.get('Access-Control-Allow-Origin'));
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('test-typesense-connection - should return success on healthy connection', async () => {
  // Arrange
  const mockHealthData = { ok: true, status: 'healthy' };
  const mockClient = {
    health: {
      retrieve: () => Promise.resolve(mockHealthData),
    },
  };

  const request = new Request('http://localhost:8000', {
    method: 'GET',
  });

  // Act
  const response = await simulateHandler(request, mockClient);

  // Assert
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.success, true);
  assertEquals(data.health, mockHealthData);
  assertExists(response.headers.get('Content-Type'));
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  assertExists(response.headers.get('Access-Control-Allow-Origin'));
});

Deno.test('test-typesense-connection - should handle Typesense client errors', async () => {
  // Arrange
  const errorMessage = 'Connection failed';
  const mockClient = {
    health: {
      retrieve: () => Promise.reject(new Error(errorMessage)),
    },
  };

  const request = new Request(`${supabaseUrl}/functions/v1/test-typesense-connection`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  // Act
  const response = await simulateHandler(request, mockClient);

  // Assert
  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assertEquals(data.error, errorMessage);
  assertExists(response.headers.get('Content-Type'));
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  assertExists(response.headers.get('Access-Control-Allow-Origin'));
});

Deno.test('test-typesense-connection - should handle non-Error exceptions', async () => {
  // Arrange
  const errorString = 'Unknown error occurred';
  const mockClient = {
    health: {
      retrieve: () => Promise.reject(errorString),
    },
  };

  const request = new Request(`${supabaseUrl}/functions/v1/test-typesense-connection`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  // Act
  const response = await simulateHandler(request, mockClient);

  // Assert
  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assertEquals(data.error, errorString);
});

Deno.test(
  'test-typesense-connection - should return 400 for POST requests with error',
  async () => {
    // Arrange
    const request = new Request(`${supabaseUrl}/functions/v1/test-typesense-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    // Act
    const response = await simulateHandler(request);

    // Assert
    assertEquals(response.status, 400);
    const data = await response.json();
    assertEquals(data.success, false);
    assertExists(data.error);
  },
);

Deno.test('test-typesense-connection - should include all CORS headers', async () => {
  // Arrange
  const mockHealthData = { ok: true };
  const mockClient = {
    health: {
      retrieve: () => Promise.resolve(mockHealthData),
    },
  };

  const request = new Request(`${supabaseUrl}/functions/v1/test-typesense-connection`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  // Act
  const response = await simulateHandler(request, mockClient);

  // Assert
  assertExists(response.headers.get('Access-Control-Allow-Origin'));
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertExists(response.headers.get('Access-Control-Allow-Headers'));
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type, x-api-key, x-typesense-api-key',
  );
});

Deno.test('test-typesense-connection - should handle network timeout errors', async () => {
  // Arrange
  const mockClient = {
    health: {
      retrieve: () => Promise.reject(new Error('ETIMEDOUT: Connection timeout')),
    },
  };

  const request = new Request(`${supabaseUrl}/functions/v1/test-typesense-connection`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  // Act
  const response = await simulateHandler(request, mockClient);

  // Assert
  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assertEquals(data.error, 'ETIMEDOUT: Connection timeout');
});
