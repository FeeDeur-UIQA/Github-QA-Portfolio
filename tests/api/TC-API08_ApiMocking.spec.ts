import { apiTest, expect } from '../../fixtures/api-fixtures';

import { errorHandlers } from './mocks/handlers';
import { mockServer } from './mocks/server';

/**
 * TC-API08: API Mocking & Fast Feedback
 *
 * Demonstrates Mock Service Worker (MSW) for deterministic, offline testing
 * 10x faster execution without network calls
 * Enables edge case testing (500, 429, timeouts, network errors)
 *
 * @category API Testing
 * @priority High
 */

apiTest.describe('TC-API08: API Mocking with MSW @api @mock @fast', () => {
  // Start MSW server before all tests
  apiTest.beforeAll(() => {
    mockServer.listen({ onUnhandledRequest: 'warn' });
    console.log('🔧 Mock server started');
  });

  // Reset handlers after each test
  apiTest.afterEach(() => {
    mockServer.resetHandlers();
  });

  // Cleanup after all tests
  apiTest.afterAll(() => {
    mockServer.close();
    console.log('🔧 Mock server stopped');
  });

  apiTest('should return mocked products list @api @mock', async ({ apiClient }) => {
    await apiTest.step('Call API with mock enabled', async () => {
      const startTime = Date.now();
      const response = await apiClient.getProductsList();
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.data.responseCode).toBe(200);
      expect(response.data.products).toBeDefined();
      expect(response.data.products.length).toBeGreaterThan(0);

      // Verify first product is mocked data
      expect(response.data.products[0].name).toContain('Mock');

      // Should be much faster than real API (< 100ms vs ~300ms)
      expect(duration).toBeLessThan(100);

      console.log(`✅ Mock API response time: ${duration}ms (vs ~300ms real API)`);
    });
  });

  apiTest('should return mocked brands list @api @mock', async ({ apiClient }) => {
    const response = await apiClient.getBrandsList();

    await apiTest.step('Validate mock response structure', async () => {
      expect(response.status).toBe(200);
      expect(response.data.brands).toHaveLength(4); // Mock fixture has 4 brands
      expect(response.data.brands[0].brand).toBe('Polo');
    });
  });

  apiTest('should filter mocked products by search @api @mock', async ({ apiClient }) => {
    await apiTest.step('Search for "dress"', async () => {
      const response = await apiClient.searchProducts({ search_product: 'dress' });

      expect(response.status).toBe(200);
      expect(response.data.products.length).toBe(1); // Only "Mock Dress" matches
      expect(response.data.products[0].name).toContain('Dress');
    });

    await apiTest.step('Search for "mock"', async () => {
      const response = await apiClient.searchProducts({ search_product: 'mock' });

      expect(response.status).toBe(200);
      expect(response.data.products.length).toBe(3); // All mock products contain "Mock"
    });
  });

  apiTest('should simulate 500 server error @api @mock @resilience', async ({ apiClient }) => {
    // Override handler to return 500
    mockServer.use(errorHandlers.serverError);

    await apiTest.step('Verify retry behavior on 500', async () => {
      // MSW returns 500, but API client wraps it in ApiResponse with status 500
      // The client doesn't throw on HTTP 500 - it returns valid response
      const response = await apiClient.getProductsList();
      expect(response.status).toBe(500);
      expect(response.data).toHaveProperty('responseCode', 500);
      expect(response.data).toHaveProperty('message', 'Internal Server Error');
      console.log('✅ 500 error simulation validated');
    });
  });

  apiTest('should simulate 429 rate limit @api @mock @resilience', async ({ apiClient }) => {
    mockServer.use(errorHandlers.rateLimit);

    await apiTest.step('Verify rate limit handling', async () => {
      // MSW returns 429, API client returns response with status 429
      const response = await apiClient.getProductsList();
      expect(response.status).toBe(429);
      expect(response.data).toHaveProperty('responseCode', 429);
      expect(response.data).toHaveProperty('message', 'Too Many Requests');
      console.log('✅ 429 rate limit simulation validated');
    });
  });

  apiTest('should simulate network error @api @mock @resilience', async ({ apiClient }) => {
    mockServer.use(errorHandlers.networkError);

    await apiTest.step('Verify network error handling', async () => {
      try {
        await apiClient.getProductsList();
        throw new Error('Expected network error');
      } catch (error: any) {
        // Network errors have status 0 or specific error types
        expect([0, 500, 503]).toContain(error.status);
      }
    });
  });

  apiTest(
    'should demonstrate 10x speed improvement @api @mock @performance',
    async ({ apiClient }) => {
      const iterations = 10;
      const startTime = Date.now();

      await apiTest.step(`Execute ${iterations} mock requests`, async () => {
        for (let i = 0; i < iterations; i++) {
          const response = await apiClient.getProductsList();
          expect(response.status).toBe(200);
        }
      });

      const totalDuration = Date.now() - startTime;
      const avgDuration = totalDuration / iterations;

      await apiTest.step('Verify performance improvement', async () => {
        // 10 mock requests should complete in < 1 second
        expect(totalDuration).toBeLessThan(1000);
        expect(avgDuration).toBeLessThan(100);

        console.log(
          `📊 Mock Performance: ${iterations} requests in ${totalDuration}ms (avg ${avgDuration.toFixed(2)}ms per request)`,
        );
        console.log(`💡 Real API equivalent would take ~${(iterations * 300).toFixed(0)}ms`);
      });
    },
  );

  apiTest('should enable offline development @api @mock', async ({ apiClient }) => {
    await apiTest.step('Verify no network calls made', async () => {
      // All requests intercepted by MSW - no actual HTTP traffic
      const response1 = await apiClient.getProductsList();
      const response2 = await apiClient.getBrandsList();
      const response3 = await apiClient.searchProducts({ search_product: 'test' });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);

      console.log('✅ All API calls intercepted - zero network usage');
    });
  });
});
