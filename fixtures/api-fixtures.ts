import type { APIRequestContext } from '@playwright/test';
import { test as base } from '@playwright/test';

import { ProductsApiClient } from '../src/support/clients/ProductsApiClient';

/**
 * Extended test fixtures for API testing
 * 
 * Usage:
 *   test('my api test @api', async ({ apiClient }) => {
 *     const response = await apiClient.getProductsList();
 *     expect(response.status).toBe(200);
 *   });
 */

type ApiFixtures = {
  apiClient: ProductsApiClient;
  request: APIRequestContext;
};

export const apiTest = base.extend<ApiFixtures>({
  apiClient: async ({ request }, use) => {
    // Setup: Initialize API client
    const apiClient = new ProductsApiClient(request);

    // Optional: Health check before tests (disabled for now - can be re-enabled)
    // const isHealthy = await apiClient.healthCheck();
    // if (!isHealthy) {
    //   throw new Error('❌ API is not responding. Check endpoint availability.');
    // }

    // Provide to test
    await use(apiClient);

    // Teardown: Could add cleanup here if needed
    // (e.g., delete test records, reset database)
  },
});

export { expect } from '@playwright/test';
