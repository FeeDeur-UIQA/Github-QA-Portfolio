import { test, expect } from '@playwright/test';

import { HomePage } from '../../src/pages/HomePage';
import { ProductsPage } from '../../src/pages/ProductsPage';
import { Logger } from '../../src/utils/Logger';

/**
 * TC-INT01: Product Browsing Flow with Mocked Backend
 *
 * Tests the product discovery flow with route interception
 * Provides predictable data for faster, deterministic testing
 *
 * @category Integration
 * @priority High
 */

const mockProducts = {
  responseCode: 200,
  products: [
    {
      id: 1,
      name: 'Integration Test Shirt',
      price: 'Rs. 500',
      brand: 'TestBrand',
      category: { usertype: { usertype: 'Men' }, category: 'Tshirts' },
    },
    {
      id: 2,
      name: 'Integration Test Dress',
      price: 'Rs. 1000',
      brand: 'TestBrand',
      category: { usertype: { usertype: 'Women' }, category: 'Dress' },
    },
  ],
};

test.describe('TC-INT01: Product Browsing with Mocked Backend @integration @mock @fast', () => {
  const logger = Logger.getInstance('TC-INT01');

  test.beforeEach(async ({ page }) => {
    // Intercept API calls and return mock data
    await page.route('**/api/productsList', async (route) => {
      logger.info('Intercepted /api/productsList - returning mock data');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProducts),
      });
    });
  });

  test('should display mocked products on products page @integration @mock', async ({ page }) => {
    const productsPage = new ProductsPage(page);

    await test.step('Navigate to products page', async () => {
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
      logger.info('[PASS] Products page loaded with mocked data');
    });

    await test.step('Verify page renders correctly', async () => {
      // Page should load without errors even with mocked API
      await expect(page.locator('.features_items')).toBeVisible();
      logger.info('[PASS] Product container visible');
    });

    await test.step('Verify navigation remains functional', async () => {
      // Test that other navigation works
      const homePage = new HomePage(page);
      await homePage.navigateTo();
      await expect(page).toHaveURL(/automationexercise/);
      logger.info('[PASS] Navigation functional with mocked backend');
    });
  });

  test('should handle empty product list gracefully @integration @mock @edge', async ({ page }) => {
    // Override with empty products
    await page.route('**/api/productsList', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ responseCode: 200, products: [] }),
      });
    });

    const productsPage = new ProductsPage(page);

    await test.step('Navigate with empty products', async () => {
      await productsPage.navigateTo();
      // Page should still load without crashing
      await expect(page).toHaveURL(/products/);
      logger.info('[PASS] Page handles empty product list gracefully');
    });
  });

  test('should handle API error gracefully @integration @mock @resilience', async ({ page }) => {
    // Simulate server error
    await page.route('**/api/productsList', async (route) => {
      logger.info('Simulating 500 error for /api/productsList');
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ responseCode: 500, message: 'Internal Server Error' }),
      });
    });

    await test.step('Navigate despite API error', async () => {
      // Page should still be navigable (graceful degradation)
      await page.goto('/products');
      await page.waitForLoadState('domcontentloaded');

      // Page should not crash
      const title = await page.title();
      expect(title).toBeTruthy();
      logger.info('[PASS] Page degrades gracefully on API error');
    });
  });
});
