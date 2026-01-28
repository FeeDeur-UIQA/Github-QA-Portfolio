import { apiTest, expect } from '../../fixtures/api-fixtures';
import { BrandsListResponseSchema } from '../../src/types/api-schemas';
import { Logger } from '../../src/utils/Logger';

/**
 * TC-API02: Brands List API Contract Validation
 *
 * Validates the /api/brandsList endpoint contract
 * Ensures brand data structure and integrity
 *
 * @category API Testing
 * @priority High
 */

apiTest.describe('TC-API02: Brands List API Contract @api @critical @fast', () => {
  let logger: Logger;

  apiTest.beforeEach(() => {
    logger = Logger.getInstance('TC-API02_BrandsList');
  });

  apiTest('should return 200 and valid brands list @api', async ({ apiClient }) => {
    const response = await apiClient.getBrandsList();

    await apiTest.step('Validate HTTP status', async () => {
      expect(response.status).toBe(200);
    });

    await apiTest.step('Validate response schema', async () => {
      const data = response.data;
      const validation = BrandsListResponseSchema.safeParse(data);

      expect(
        validation.success,
        `Schema validation failed: ${validation.error?.message}`,
      ).toBeTruthy();
    });
  });

  apiTest('should return brands with required fields @api', async ({ apiClient }) => {
    const response = await apiClient.getBrandsList();
    const data = response.data;

    await apiTest.step('Validate response structure', async () => {
      expect(data.responseCode).toBe(200);
      expect(data.brands).toBeDefined();
      expect(Array.isArray(data.brands)).toBeTruthy();
      expect(data.brands.length).toBeGreaterThan(0);
    });

    await apiTest.step('Validate brand objects', async () => {
      const firstBrand = data.brands[0];
      expect(firstBrand.id).toBeDefined();
      expect(typeof firstBrand.id).toBe('number');
      expect(firstBrand.brand).toBeDefined();
      expect(typeof firstBrand.brand).toBe('string');
      expect(firstBrand.brand.length).toBeGreaterThan(0);
    });
  });

  apiTest('should return brands with unique IDs @api', async ({ apiClient }) => {
    const response = await apiClient.getBrandsList();
    const data = response.data;

    await apiTest.step('Validate brand ID uniqueness', async () => {
      const brandIds = data.brands.map((b) => b.id);
      const uniqueIds = new Set(brandIds);

      expect(uniqueIds.size).toBe(brandIds.length);
    });
  });

  apiTest('should return consistent brand count across requests @api', async ({ apiClient }) => {
    const response1 = await apiClient.getBrandsList();
    const data1 = response1.data;

    await apiTest.step('Wait and fetch again', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response2 = await apiClient.getBrandsList();
      const data2 = response2.data;

      expect(data1.brands.length).toBe(data2.brands.length);
    });
  });

  apiTest('should respond within acceptable time @api @performance', async ({ apiClient }) => {
    const startTime = Date.now();
    const response = await apiClient.getBrandsList();
    const duration = Date.now() - startTime;

    await apiTest.step('Validate response time', async () => {
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(3000);
      logger.info(`[PASS] Brands API Response Time: ${duration}ms`);
    });
  });
});
