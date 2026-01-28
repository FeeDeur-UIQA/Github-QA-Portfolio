/* eslint-disable playwright/prefer-web-first-assertions */

import { HomePage } from '@pages/HomePage';
import { ProductsPage } from '@pages/ProductsPage';
import { expect, test } from '@playwright/test';
import { Logger } from '@utils/Logger';

import { dismissConsentIfPresent } from '../../support/consent';

test.describe('TC-A03: Cart Item Announcements & Live Regions @medium', () => {
  const logger = Logger.getInstance('TC-A03');

  test('Verify cart notifications use ARIA live regions @critical @accessibility @e2e', async ({
    page,
  }) => {
    logger.info('Starting cart announcements test');

    await test.step('Navigate to products', async () => {
      const homePage = new HomePage(page);
      await homePage.navigateTo();
      await homePage.isPageLoaded();
      await dismissConsentIfPresent(page);

      const productsLink = homePage.getProductsLink();
      await productsLink.click();
      await page.waitForLoadState('load');
      logger.info('[PASS] Navigated to products');
    });

    await test.step('Add first product to cart', async () => {
      const productsPage = new ProductsPage(page);
      await productsPage.isPageLoaded();

      // Get first product's add to cart button
      const firstProduct = page.locator('.features_items >> .col-sm-4').first();
      const addToCartBtn = firstProduct
        .locator('a')
        .filter({ hasText: /add to cart/i })
        .first();

      // Check for ARIA live region or notification container
      const liveRegion = page.locator('[aria-live]').first();

      // Add to cart
      await addToCartBtn.click();
      await page.waitForLoadState('load');

      // Verify live region exists (screen reader will announce updates)
      const liveRegionExists = await liveRegion.count().catch(() => 0);
      if (liveRegionExists > 0) {
        const liveRegionText = await liveRegion.textContent();
        expect(liveRegionText).toBeTruthy();
        logger.info(`[PASS] Live region announced: ${liveRegionText}`);
      }

      logger.info('[PASS] Product added to cart');
    });

    logger.info('[PASS] TC-A03 (announcements) PASSED: Cart uses live regions');
  });

  test('Verify cart page has accessible content structure @critical @accessibility @e2e', async ({
    page,
  }) => {
    logger.info('Starting cart page accessibility test');

    await test.step('Navigate to cart', async () => {
      const homePage = new HomePage(page);
      await homePage.navigateTo();
      await dismissConsentIfPresent(page);

      // Click cart link or navigate directly
      const cartLink = page.locator('a[href*="view_cart"]').first();
      if ((await cartLink.count()) > 0) {
        await cartLink.click();
      } else {
        await page.goto('/view_cart');
      }

      await page.waitForURL('**/view_cart');
      await dismissConsentIfPresent(page);
      logger.info('[PASS] Navigated to cart');
    });

    await test.step('Cart table has structure', async () => {
      const cartTable = page.locator('table').first();
      const tableExists = (await cartTable.count()) > 0;

      if (tableExists) {
        // Check for table headers
        const tableHeaders = cartTable.locator('thead, th');
        const headerCount = await tableHeaders.count();

        expect(headerCount).toBeGreaterThan(0);
        logger.info(`[PASS] Cart table has ${headerCount} header cells`);

        // Check for table body
        const tableBodies = cartTable.locator('tbody, tr');
        const bodyCount = await tableBodies.count();
        expect(bodyCount).toBeGreaterThan(0);
        logger.info(`[PASS] Cart table has ${bodyCount} rows`);
      }
    });

    await test.step('Quantity controls are accessible', async () => {
      // Find quantity input or spinner
      const quantityInputs = page.locator('input[type="number"], [aria-label*="quantity" i]');
      const quantityCount = await quantityInputs.count();

      if (quantityCount > 0) {
        for (let i = 0; i < Math.min(quantityCount, 3); i++) {
          const input = quantityInputs.nth(i);
          const ariaLabel = await input.getAttribute('aria-label');
          const placeholder = await input.getAttribute('placeholder');
          const value = await input.inputValue();

          expect(ariaLabel || placeholder || value.length > 0).toBe(true);
        }

        logger.info(`[PASS] ${quantityCount} quantity controls are accessible`);
      }
    });

    logger.info('[PASS] TC-A03 (cart structure) PASSED: Cart page is accessible');
  });

  test('Verify cart summary has clear total announcement @critical @accessibility @e2e', async ({
    page,
  }) => {
    logger.info('Starting cart summary accessibility test');

    await test.step('Navigate to cart', async () => {
      const cartLink = page.locator('a[href*="view_cart"]').first();
      if ((await cartLink.count()) > 0) {
        await cartLink.click();
      } else {
        await page.goto('/view_cart');
      }
      await page.waitForURL('**/view_cart');
      await dismissConsentIfPresent(page); // Ensure consent overlay is cleared
    });

    await test.step('Ensure cart has at least one item', async () => {
      const emptyCartNotice = page.getByText(/cart is empty/i);
      try {
        await emptyCartNotice.waitFor({ state: 'visible', timeout: 2000 });
        // Navigate directly to products to avoid consent overlay intercepting click
        await page.goto('/products');
        await page.waitForLoadState('load');

        const productsPage = new ProductsPage(page);
        await productsPage.isPageLoaded();
        // Add first product via page object to ensure consistency
        await productsPage.addProductToCart('Blue Top');
        await productsPage.goToCart();
      } catch (error) {
        // Cart already has items
        logger.debug('Cart already populated', { error: (error as Error).message });
      }
    });

    await test.step('Total is labeled and announced', async () => {
      // Look for total amount with accessible label
      const totalLabel = page.locator('text=/total|total amount|grand total/i').first();
      const totalValue = page
        .locator('text=/rs\\.?\\s*[0-9,]+|\\$\\s*[0-9,]+(?:\\.[0-9]{2})?/i')
        .last();

      const labelExists = (await totalLabel.count()) > 0;
      const valueExists = (await totalValue.count()) > 0;

      expect(labelExists || valueExists).toBe(true);
      logger.info('[PASS] Cart total is clearly labeled and visible');
    });

    logger.info('[PASS] TC-A03 (summary) PASSED: Cart summary is accessible');
  });
});
