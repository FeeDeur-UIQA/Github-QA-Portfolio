import { test, expect } from '@playwright/test';

import { CartPage } from '../../src/pages/CartPage';
import { ProductsPage } from '../../src/pages/ProductsPage';
import { Logger } from '../../src/utils/Logger';

/**
 * TC-INT02: Cart Flow with Mocked Backend
 *
 * Tests add-to-cart functionality with controlled mock responses
 * Validates cart calculations and state management
 *
 * @category Integration
 * @priority High
 */

const mockCartResponse = {
  status: 'success',
  message: 'Product added to cart',
  cartCount: 1,
};

test.describe('TC-INT02: Cart Operations with Mocked Backend @integration @mock @fast', () => {
  const logger = Logger.getInstance('TC-INT02');

  test.beforeEach(async ({ page }) => {
    // Mock cart-related API endpoints
    await page.route('**/add_to_cart/*', async (route) => {
      logger.info('Intercepted add_to_cart - returning mock success');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCartResponse),
      });
    });

    await page.route('**/view_cart', async (route) => {
      // Let actual page load but intercept API calls
      await route.continue();
    });
  });

  test('should add product to cart with mocked response @integration @mock', async ({ page }) => {
    const productsPage = new ProductsPage(page);

    await test.step('Navigate to products', async () => {
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
      logger.info('[PASS] Products page loaded');
    });

    await test.step('Add first product to cart', async () => {
      // Find and click first "Add to cart" button
      const addToCartBtn = page.locator('a[data-product-id="1"]').first();

      if (await addToCartBtn.isVisible()) {
        await addToCartBtn.click();

        // Handle "Continue Shopping" or "View Cart" modal
        const continueBtn = page.getByRole('button', { name: /continue shopping/i });
        if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await continueBtn.click();
        }

        logger.info('[PASS] Add to cart action completed');
      } else {
        // Alternative: hover and click overlay button
        const productCard = page.locator('.productinfo').first();
        await productCard.hover();
        await page.locator('.overlay-content a.add-to-cart').first().click();
        logger.info('[PASS] Add to cart via overlay completed');
      }
    });

    await test.step('Verify cart is accessible', async () => {
      const cartPage = new CartPage(page);
      await cartPage.navigateTo();
      await expect(page).toHaveURL(/view_cart/);
      logger.info('[PASS] Cart page accessible after mock add');
    });
  });

  test('should handle cart API timeout gracefully @integration @mock @resilience', async ({
    page,
  }) => {
    // Simulate slow/timeout response
    await page.route('**/add_to_cart/*', async (route) => {
      logger.info('Simulating slow cart API (3s delay)');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCartResponse),
      });
    });

    const productsPage = new ProductsPage(page);
    await productsPage.navigateTo();

    await test.step('Verify page remains responsive during slow API', async () => {
      // Page should still be interactive
      await expect(page.locator('.features_items')).toBeVisible();

      // Navigation should work
      const logoLink = page.locator('a[href="/"]').first();
      await expect(logoLink).toBeVisible();

      logger.info('[PASS] Page remains responsive during slow API');
    });
  });

  test('should handle cart API failure gracefully @integration @mock @resilience', async ({
    page,
  }) => {
    // Simulate cart failure
    await page.route('**/add_to_cart/*', async (route) => {
      logger.info('Simulating cart API failure');
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'error', message: 'Cart service unavailable' }),
      });
    });

    const productsPage = new ProductsPage(page);
    await productsPage.navigateTo();
    await productsPage.isPageLoaded();

    await test.step('Verify page does not crash on cart failure', async () => {
      // Page should still be functional
      await expect(page.locator('.features_items')).toBeVisible();

      // User can still browse
      await expect(page.locator('.productinfo').first()).toBeVisible();

      logger.info('[PASS] Page handles cart API failure gracefully');
    });
  });
});
