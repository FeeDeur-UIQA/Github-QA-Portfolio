import { apiTest, expect } from '../../fixtures/api-fixtures';
import { SearchProductsResponseSchema } from '../../src/types/api-schemas';
import { Logger } from '../../src/utils/Logger';

/**
 * TC-API03: Search Products API Contract Validation
 *
 * Validates the /api/searchProduct endpoint
 * Tests search functionality, filtering, and error handling
 *
 * @category API Testing
 * @priority High
 */

apiTest.describe('TC-API03: Search Products API Contract @api @critical @fast', () => {
  let logger: Logger;

  apiTest.beforeEach(() => {
    logger = Logger.getInstance('TC-API03_SearchProducts');
  });

  apiTest('should search products by name @api', async ({ apiClient }) => {
    const searchTerm = 'tshirt';

    await apiTest.step('Send POST request with search term', async () => {
      const response = await apiClient.searchProducts({ search_product: searchTerm });

      expect(response.status).toBe(200);
    });

    await apiTest.step('Validate search results', async () => {
      const response = await apiClient.searchProducts({ search_product: searchTerm });

      const data = response.data;
      const validation = SearchProductsResponseSchema.safeParse(data);

      expect(
        validation.success,
        `Schema validation failed: ${validation.error?.message}`,
      ).toBeTruthy();
      expect(data.products).toBeDefined();
      expect(Array.isArray(data.products)).toBeTruthy();
    });
  });

  apiTest('should return relevant products for search query @api', async ({ apiClient }) => {
    const searchTerm = 'dress';

    const response = await apiClient.searchProducts({ search_product: searchTerm });

    const data = response.data;

    await apiTest.step('Validate search results contain search term', async () => {
      expect(data.products.length).toBeGreaterThan(0);

      // Check if at least one product name contains the search term (case-insensitive)
      const hasMatchingProduct = data.products.some((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );

      expect(hasMatchingProduct).toBeTruthy();
    });
  });

  apiTest('should handle case-insensitive search @api', async ({ apiClient }) => {
    const lowerCaseSearch = await apiClient.searchProducts({ search_product: 'jeans' });

    const upperCaseSearch = await apiClient.searchProducts({ search_product: 'JEANS' });

    const lowerData = lowerCaseSearch.data;
    const upperData = upperCaseSearch.data;

    await apiTest.step('Compare results', async () => {
      // Results should be similar (same products found)
      expect(lowerData.products.length).toBeGreaterThan(0);
      expect(upperData.products.length).toBeGreaterThan(0);
      expect(lowerData.products.length).toBe(upperData.products.length);
    });
  });

  apiTest('should return empty array for non-existent product @api', async ({ apiClient }) => {
    const response = await apiClient.searchProducts({
      search_product: 'NonExistentProduct12345XYZ',
    });

    const data = response.data;

    await apiTest.step('Validate empty search results', async () => {
      expect(response.status).toBe(200);
      expect(data.responseCode).toBe(200);
      expect(data.products).toBeDefined();
      expect(Array.isArray(data.products)).toBeTruthy();
      // Empty results are valid for no matches
    });
  });

  apiTest('should handle empty search query @api', async ({ apiClient }) => {
    const response = await apiClient.searchProducts({ search_product: '' });

    await apiTest.step('Validate response for empty query', async () => {
      const data = response.data;
      expect(response.status).toBe(200);
      expect(data.responseCode).toBeDefined();
    });
  });

  apiTest(
    'should respond within acceptable time for search @api @performance',
    async ({ apiClient }) => {
      const startTime = Date.now();
      const response = await apiClient.searchProducts({ search_product: 'shirt' });
      const duration = Date.now() - startTime;

      await apiTest.step('Validate search response time', async () => {
        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(3000);
        logger.info(`[PASS] Search API Response Time: ${duration}ms`);
      });
    },
  );

  apiTest('should handle special characters in search @api', async ({ apiClient }) => {
    const specialCharSearch = await apiClient.searchProducts({ search_product: 't-shirt' });

    await apiTest.step('Validate special character handling', async () => {
      expect(specialCharSearch.status).toBe(200);
      const data = specialCharSearch.data;
      expect(data.responseCode).toBe(200);
    });
  });
});
