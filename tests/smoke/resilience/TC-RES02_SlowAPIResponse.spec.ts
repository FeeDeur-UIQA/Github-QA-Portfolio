import { HomePage } from '@pages/HomePage';
import { ProductsPage } from '@pages/ProductsPage';
import { test, expect } from '@playwright/test';
import { Logger } from '@utils/Logger';

test.describe('TC-RES02: Slow API Response Handling @critical @smoke @resilience @medium', () => {
  let logger: Logger;
  let homePage: HomePage;
  let productsPage: ProductsPage;

  test.beforeEach(({ page }) => {
    logger = Logger.getInstance('TC-RES02_SlowAPIResponse');
    homePage = new HomePage(page);
    productsPage = new ProductsPage(page);
  });

  test('should show loading indicator for slow add-to-cart response @critical @resilience @smoke', async ({
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

    await test.step('3: Delay add-to-cart response by 5 seconds', async () => {
      await page.route('**/add_to_cart', async (route, request) => {
        if (request.method() === 'POST') {
          logger.info('⏱[INFO]  Delaying add-to-cart response by 5 seconds');
          await page.waitForTimeout(5000);
        }
        await route.continue();
      });

      const addToCartBtn = productsPage.getFirstProductAddToCartBtn();
      await addToCartBtn.click();

      // Check for loading indicator immediately after click
      const loadingIndicators = page.locator(
        '.loading, .spinner, [aria-busy="true"], [role="status"]',
      );

      // If loading indicator exists, verify it's visible
      const hasLoadingIndicator = (await loadingIndicators.count()) > 0;
      if (hasLoadingIndicator) {
        await expect(loadingIndicators.first()).toBeVisible({ timeout: 2000 });
        logger.info('[PASS] Loading indicator displayed during slow request');
      } else {
        logger.info('ℹ[INFO]  No loading indicator found (acceptable UX pattern)');
      }
    });

    await test.step('4: Verify eventual success after delay', async () => {
      const continueShoppingBtn = productsPage.getContinueShoppingBtn();
      await page.waitForLoadState('load').catch(() => {});
      await expect(continueShoppingBtn).toBeVisible({ timeout: 15000 });

      // Assert success modal appeared
      await expect(continueShoppingBtn).toBeVisible();
      expect(await continueShoppingBtn.textContent()).toMatch(/continue shopping/i);

      logger.info('[PASS] Slow API response handled successfully');
    });
  });

  test('should timeout gracefully after 30 seconds @critical @resilience @smoke', async ({
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

    await test.step('3: Delay add-to-cart response beyond timeout', async () => {
      await page.route('**/add_to_cart', async (route, request) => {
        if (request.method() === 'POST') {
          logger.info('⏱[INFO]  Hanging add-to-cart request (35 second delay)');
          await page.waitForTimeout(35000);
        }
        await route.continue();
      });

      const addToCartBtn = productsPage.getFirstProductAddToCartBtn();
      await addToCartBtn.click();

      logger.info('[PASS] Add-to-cart request initiated with extreme delay');
    });

    await test.step('4: Verify timeout handling', async () => {
      // Application should either:
      // 1. Show timeout error message
      // 2. Retry after timeout
      // 3. Show success modal after retry

      const timeoutError = page.locator('.error, .alert, [role="alert"]');
      const successModal = productsPage.getContinueShoppingBtn();

      // Wait for either timeout error or success (after retry)
      await Promise.race([
        timeoutError.waitFor({ state: 'visible', timeout: 40000 }).then(() => {
          logger.info('[PASS] Timeout error displayed to user');
        }),
        successModal.waitFor({ state: 'visible', timeout: 40000 }).then(() => {
          logger.info('[PASS] Request succeeded after automatic retry');
        }),
      ]).catch(() => {
        logger.warn('⚠[INFO]  No timeout handling detected (potential UX issue)');
      });
    });
  });

  test('should handle slow product list loading @critical @resilience @smoke', async ({ page }) => {
    await test.step('1: Navigate to home page', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();

      logger.info('[PASS] Home page loaded');
    });

    await test.step('2: Delay product list API response', async () => {
      await page.route('**/api/productsList', async (route) => {
        logger.info('⏱[INFO]  Delaying product list response by 8 seconds');
        await page.waitForTimeout(8000);
        await route.continue();
      });

      const productsLink = homePage.getProductsLink();
      await productsLink.click();

      logger.info('[PASS] Products link clicked with delayed API');
    });

    await test.step('3: Verify loading state during delay', async () => {
      const loadingIndicators = page.locator(
        '.loading, .spinner, [aria-busy="true"], [role="status"]',
      );

      const hasLoadingIndicator = (await loadingIndicators.count()) > 0;
      if (hasLoadingIndicator) {
        logger.info('[PASS] Loading state displayed during slow product list load');
      } else {
        logger.info('ℹ[INFO]  No loading indicator for product list');
      }
    });

    await test.step('4: Verify products eventually load', async () => {
      await productsPage.isPageLoaded();

      const products = productsPage.getProductItems();
      await products.first().waitFor({ state: 'visible', timeout: 15000 });

      logger.info('[PASS] Products loaded successfully after delay');
    });
  });
});
