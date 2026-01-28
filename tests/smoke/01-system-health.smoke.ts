import type { APIResponse } from '../../src/types/test-results.types';

import { test, expect, registerSmokeHooks } from './smoke-hooks';
import { SmokeMetricsAggregator } from './smoke.utils';

registerSmokeHooks();

/**
 * TC-00: System Health Check
 * Purpose: Validate backend API availability before running business logic tests
 * Duration: < 5 seconds
 *
 * @critical @smoke @health @api
 */
test.describe('TC-00: System Health Check', () => {
  test('Verify critical API endpoints are operational @critical @smoke @health @api', async ({
    page,
    request,
  }, testInfo) => {
    const startTime = Date.now();

    try {
      await test.step('1-2. Verify API Endpoints (Parallel)', async () => {
        // Parallel API checks for 3x speed improvement
        const [homeResponse, apiResponse] = await Promise.all([
          request.get('/'),
          request.get('/api/productsList'),
        ]);

        // Verify homepage
        expect(homeResponse.status(), 'Homepage should return 200').toBe(200);
        const contentType = homeResponse.headers()['content-type'];
        expect(contentType, 'Should return HTML').toContain('text/html');

        // Verify Products API
        expect(apiResponse.status(), 'Products API should return 200').toBe(200);
        const data = (await apiResponse.json()) as APIResponse;
        expect(data.responseCode, 'API response code should be 200').toBe(200);
        expect(data.products, 'Products array should exist').toBeDefined();
        expect(data.products.length, 'Products should be available').toBeGreaterThan(0);

        console.log(`[PASS] Health Check: ${data.products.length} products available in API`);
      });

      await test.step('3. Verify No Server Errors on Landing Page', async () => {
        const serverErrors: string[] = [];

        page.on('response', (response) => {
          if (response.status() >= 500) {
            serverErrors.push(`${response.url()}: ${response.status()}`);
          }
        });

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        // Wait for async operations to complete using a proper condition
        await page.waitForLoadState('load').catch(() => null);

        expect(serverErrors, 'No 500 errors should occur on homepage').toHaveLength(0);
        console.log('[PASS] Health Check: No server errors detected');
      });

      await test.step('4. Verify Critical DOM Elements Load', async () => {
        // Verify footer (proves page fully rendered)
        await expect(page.locator('footer')).toBeVisible();

        // Verify header navigation (using correct selector for this site)
        await expect(page.locator('header, .header')).toBeVisible();

        // Verify at least one feature section loaded
        const features = page.locator('.features_items, .recommended_items, .category-products');
        await expect(features.first()).toBeVisible({ timeout: 5000 });

        console.log('[PASS] Health Check: Critical DOM elements rendered');
      });

      await test.step('5. Performance Sanity Check', async () => {
        const loadStartTime = Date.now();
        await page.goto('/products');
        await page.waitForLoadState('domcontentloaded');
        const loadTime = Date.now() - loadStartTime;

        // Products page should load in under 10 seconds (smoke test threshold)
        expect(loadTime, 'Products page load time should be reasonable').toBeLessThan(10000);

        console.log(`[PASS] Health Check: Products page loaded in ${loadTime}ms`);
      });

      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'passed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'health',
      });
    } catch (error) {
      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'health',
        errors: [String(error)],
      });
      throw error;
    }
  });
});
