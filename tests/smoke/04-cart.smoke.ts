import { test, expect, registerSmokeHooks } from './smoke-hooks';
import { SmokeMetricsAggregator } from './smoke.utils';

registerSmokeHooks();

/**
 * TC-13: Cart Functionality Smoke Test
 * Purpose: Validate critical revenue path - adding products to cart
 * Duration: ~15 seconds
 *
 * @critical @smoke @e2e @cart
 */
test.describe('TC-13: Cart Smoke Test', () => {
  test('Verify add to cart functionality works @critical @smoke @e2e @cart', async ({
    page,
    homePage,
  }, testInfo) => {
    const startTime = Date.now();

    // Selectors for cart workflow
    const SELECTORS = {
      productCard: '.features_items .col-sm-4',
      addToCartBtn: '.overlay-content a',
      cartModal: '#cartModal, .modal.fade.in, div[role="dialog"]',
      modalContent: '.modal-content, .modal-body',
      cartInfo: '#cart_info, .cart_info',
      cartTotal: '.cart_total_price, #total_amount',
    };

    try {
      await test.step('1. Navigate to Products Page', async () => {
        await homePage.navigateTo();
        await homePage.navigateToProducts();
        await expect(page).toHaveURL(/.*\/products/);
        console.log('[PASS] Navigated to products page');
      });

      await test.step('2. Add First Product to Cart', async () => {
        // Wait for products to load
        await expect(page.locator(SELECTORS.productCard).first()).toBeVisible({ timeout: 5000 });

        const firstProduct = page.locator(SELECTORS.productCard).first();
        await firstProduct.scrollIntoViewIfNeeded();

        // Hover to reveal overlay
        await firstProduct.hover();

        // Wait for overlay to appear and click add to cart
        const addToCartBtn = firstProduct
          .locator(SELECTORS.addToCartBtn)
          .filter({ hasText: /add to cart/i });

        await expect(addToCartBtn, 'Add to cart button should be visible after hover').toBeVisible({
          timeout: 3000,
        });

        await addToCartBtn.click();
        console.log('[PASS] Clicked Add to Cart button');
      });

      await test.step('3. Verify Cart Modal Appears', async () => {
        // Wait for modal to appear
        const modal = page.locator(SELECTORS.cartModal);
        await expect(modal.first()).toBeVisible({ timeout: 5000 });

        // Verify success message
        const modalContent = page.locator(SELECTORS.modalContent);
        await expect(modalContent.first()).toContainText(/added/i, { timeout: 3000 });

        console.log('[PASS] Cart modal displayed with success message');
      });

      await test.step('4. Navigate to Cart Page', async () => {
        // Click "View Cart" link in modal or navigate directly
        const viewCartLink = page.getByRole('link', { name: /view cart/i }).first();
        await viewCartLink.click();

        await expect(page).toHaveURL(/.*view_cart/, { timeout: 5000 });
        console.log('[PASS] Navigated to cart page');
      });

      await test.step('5. Verify Product in Cart', async () => {
        // Wait for cart table to load
        await expect(page.locator(SELECTORS.cartInfo).first()).toBeVisible({ timeout: 5000 });

        // Verify cart is not empty
        const cartRows = page.locator(`${SELECTORS.cartInfo} tbody tr`);
        const rowCount = await cartRows.count();

        expect(rowCount, 'Cart should contain at least 1 product').toBeGreaterThanOrEqual(1);

        // Verify product details are displayed
        const firstRow = cartRows.first();
        await expect(firstRow.locator('.cart_description')).toBeVisible();
        await expect(firstRow.locator('.cart_price')).toBeVisible();
        await expect(firstRow.locator('.cart_quantity')).toBeVisible();

        console.log(`[PASS] Cart verified: ${rowCount} product(s) in cart`);
      });

      await test.step('6. Verify Cart Total Calculation', async () => {
        // Verify total price is displayed
        const cartTotal = page.locator(SELECTORS.cartTotal);
        await expect(cartTotal.first()).toBeVisible();

        const totalText = await cartTotal.first().textContent();
        expect(totalText, 'Cart total should contain currency symbol').toMatch(/Rs\.|₹|\$/);

        console.log(`[PASS] Cart total calculated: ${totalText}`);
      });

      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'passed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'cart',
      });
    } catch (error) {
      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'cart',
        errors: [String(error)],
      });
      throw error;
    }
  });
});
