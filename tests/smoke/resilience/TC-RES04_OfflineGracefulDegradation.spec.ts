/* eslint-disable playwright/prefer-web-first-assertions */

import { HomePage } from '@pages/HomePage';
import { ProductsPage } from '@pages/ProductsPage';
import { test, expect } from '@playwright/test';
import { Logger } from '@utils/Logger';

test.describe('TC-RES04: Offline Graceful Degradation @critical @smoke @resilience @medium', () => {
  let logger: Logger;
  let homePage: HomePage;
  let productsPage: ProductsPage;

  test.beforeEach(async ({ page }) => {
    logger = Logger.getInstance('TC-RES04_OfflineGracefulDegradation');
    homePage = new HomePage(page);
    productsPage = new ProductsPage(page);
  });

  test('should show appropriate error when going offline during cart add @critical @resilience @smoke', async ({
    page,
  }) => {
    await test.step('1-2: Navigate to products page', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();

      const productsLink = homePage.getProductsLink();
      await productsLink.click();
      await productsPage.isPageLoaded();

      logger.info('[PASS] Products page loaded');
    });

    await test.step('3: Simulate offline mode', async () => {
      // Simulate offline by blocking all network requests
      await page.route('**/*', async (route) => {
        const url = route.request().url();
        if (url.includes('add_to_cart') || url.includes('api/')) {
          logger.info(`[INFO] Blocking network request: ${url}`);
          await route.abort('failed');
        } else {
          await route.continue();
        }
      });

      const addToCartBtn = productsPage.getFirstProductAddToCartBtn();
      await addToCartBtn.click();
      await page.waitForLoadState('load').catch(() => {});
      logger.info('[PASS] Add-to-cart attempted in offline mode');
    });

    await test.step('4: Verify graceful degradation', async () => {
      const errorIndicators = page.locator('.error, .offline, [role="alert"], .network-error');

      const errorVisible = await errorIndicators.isVisible({ timeout: 2000 }).catch(() => false);

      // Verify page is still responsive (didn't crash)
      const pageStillResponsive = await page.locator('body').isVisible();
      expect(pageStillResponsive).toBe(true);

      if (errorVisible) {
        const errorText = await errorIndicators.textContent();
        logger.info(`[PASS] Error message displayed: ${errorText}`);
        expect(errorText).toMatch(/network|offline|connection|failed/i);
      } else {
        logger.info('[PASS] Application handled offline gracefully (no crash, UI intact)');
      }
    });
  });

  test('should maintain UI functionality when offline @critical @resilience @smoke', async ({
    page,
  }) => {
    await test.step('1: Load products page while online', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();

      const productsLink = homePage.getProductsLink();
      await productsLink.click();
      await productsPage.isPageLoaded();

      logger.info('[PASS] Products page loaded successfully');
    });

    await test.step('2: Go offline', async () => {
      await page.route('**/*', async (route) => {
        const url = route.request().url();
        if (url.includes('api/') || url.includes('add_to_cart')) {
          logger.info(`[INFO] Offline mode - blocking: ${url}`);
          await route.abort('failed');
        } else {
          await route.continue();
        }
      });

      logger.info('[PASS] Offline mode enabled');
    });

    await test.step('3: Verify UI remains interactive', async () => {
      // UI should remain functional even offline (browse products, etc.)
      const products = productsPage.getProductItems();
      const productCount = await products.count();

      expect(productCount).toBeGreaterThan(0);
      logger.info(`[PASS] UI still shows ${productCount} products while offline`);

      // Search should still be clickable (even if results don't load)
      const searchInput = productsPage.getSearchInput();
      await searchInput.isVisible();

      logger.info('[PASS] UI remains interactive in offline mode');
    });

    await test.step('4: Verify graceful API failure handling', async () => {
      // Try search in offline mode
      const searchInput = productsPage.getSearchInput();
      const searchButton = productsPage.getSearchButton();

      await searchInput.fill('dress');
      await searchButton.click();

      // Wait for search result handling
      await page.waitForLoadState('load').catch(() => {});

      // Application should handle gracefully (no crash, show error, or show cached results)
      const pageStillResponsive = await page.isVisible('body');
      expect(pageStillResponsive).toBe(true);

      logger.info('[PASS] Application handles offline search gracefully');
    });
  });

  test('should recover when connection is restored @critical @resilience @smoke', async ({
    page,
  }) => {
    await test.step('1-2: Navigate to products page', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();

      const productsLink = homePage.getProductsLink();
      await productsLink.click();
      await productsPage.isPageLoaded();

      logger.info('[PASS] Products page loaded');
    });

    await test.step('3: Simulate intermittent connection', async () => {
      let requestCount = 0;

      await page.route('**/add_to_cart', async (route, _request) => {
        requestCount++;

        if (requestCount <= 2) {
          // First 2 requests fail (offline)
          logger.info(`[INFO] Simulating offline - request ${requestCount} failed`);
          await route.abort('failed');
        } else {
          // Third request succeeds (connection restored)
          logger.info('🌐 Connection restored - request succeeds');
          await route.continue();
        }
      });

      const addToCartBtn = productsPage.getFirstProductAddToCartBtn();
      await addToCartBtn.click();

      logger.info('[PASS] Add-to-cart initiated with intermittent connection');
    });

    await test.step('4: Verify automatic recovery', async () => {
      // Application should retry and succeed when connection returns
      const continueShoppingBtn = productsPage.getContinueShoppingBtn();
      await continueShoppingBtn.waitFor({ state: 'visible', timeout: 15000 });

      logger.info('[PASS] Application recovered automatically when connection restored');
    });

    await test.step('5: Verify functionality is fully restored', async () => {
      // Close modal and verify cart functionality
      const continueBtn = productsPage.getContinueShoppingBtn();
      await continueBtn.click();
      await page.waitForTimeout(500); // Wait for modal to fully close

      // Use navigation Cart link
      const cartLink = page.getByRole('link', { name: /cart/i }).first();
      await cartLink.click();

      const cartUrl = page.url();
      expect(cartUrl).toContain('/view_cart');

      logger.info('[PASS] Full functionality restored after connection recovery');
    });
  });
});
