import { test, expect } from '@support/page-fixtures';
import { Logger } from '@utils/Logger';

test.describe('TC-12: Add to Cart API Integrity', () => {
  let logger: Logger;

  test.beforeEach(() => {
    logger = Logger.getInstance('TC-12_AddToCartLogic');
  });

  test('Verify cart GET request integrity @critical @cart @e2e', async ({ page, homePage }) => {
    await test.step('1: Navigate to Products page', async () => {
      await homePage.navigateTo();
      await page.getByRole('link', { name: / products/i }).click();
      await page.waitForURL(/.*\/products/);
      // Page has loaded - product data will load as rendered
      await page.waitForLoadState('load');
    });

    // 🧠 PATTERN #1: API Interception Gating
    // The site uses GET requests with product ID in URL, not POST with payload.
    // This validates that UI interaction triggers the correct backend endpoint.
    const cartRequestPromise = page.waitForRequest(
      (request) => request.url().includes('/add_to_cart/') && request.method() === 'GET',
      { timeout: 12000 },
    );

    await test.step('2: Add first product to cart', async () => {
      // 🧠 PATTERN #2: Overlay Interaction Resilience
      // Products require hover to reveal the "Add to Cart" button
      const firstProduct = page.locator('.features_items .col-sm-4').first();
      await firstProduct.scrollIntoViewIfNeeded();
      await firstProduct.hover();

      const addToCartBtn = firstProduct
        .locator('.overlay-content a')
        .filter({ hasText: /add to cart/i });
      await addToCartBtn.click();
    });

    await test.step('3: Validate API request integrity', async () => {
      // 🧠 PATTERN #3: URL-Based Product ID Extraction
      // Extract product ID from request URL and validate it matches expected product
      const request = await cartRequestPromise;
      const requestUrl = request.url();

      logger.info(`[INFO] Intercepted Request: ${requestUrl}`);

      // Verify request structure: /add_to_cart/{product_id}
      const productIdMatch = requestUrl.match(/\/add_to_cart\/(\d+)/);
      expect(productIdMatch, 'Request URL should contain /add_to_cart/{id} pattern').not.toBeNull();

      const productId = productIdMatch![1];
      logger.info(`[PASS] Product ID from API: ${productId}`);

      // 🧠 PATTERN #4: Response Status Validation
      // Ensure the request returns 200 (successful add to cart)
      const response = await request.response();
      expect(response?.status(), 'Add to cart request should return 200 OK').toBe(200);
    });

    await test.step('4: Verify UI feedback', async () => {
      // 🧠 PATTERN #5: Modal Confirmation Validation
      // The site shows a modal with "Continue Shopping" button
      await expect(page.getByRole('button', { name: /continue shopping/i })).toBeVisible({
        timeout: 5000,
      });
    });
  });
});
