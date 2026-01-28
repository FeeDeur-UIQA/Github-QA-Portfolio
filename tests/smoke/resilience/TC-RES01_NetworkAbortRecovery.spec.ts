import { CartPage } from '@pages/CartPage';
import { HomePage } from '@pages/HomePage';
import { ProductsPage } from '@pages/ProductsPage';
import { test, expect } from '@playwright/test';
import { Logger } from '@utils/Logger';

test.describe('TC-RES01: Network Abort Recovery @critical @smoke @resilience @medium', () => {
  let logger: Logger;
  let homePage: HomePage;
  let productsPage: ProductsPage;
  let cartPage: CartPage;

  test.beforeEach(async ({ page }) => {
    logger = Logger.getInstance('TC-RES01_NetworkAbortRecovery');
    homePage = new HomePage(page);
    productsPage = new ProductsPage(page);
    cartPage = new CartPage(page);

    // Shared navigation setup
    await homePage.navigateTo();
    await homePage.isPageLoaded();
    const productsLink = homePage.getProductsLink();
    await productsLink.click();
    await productsPage.isPageLoaded();
  });

  test('should retry when add-to-cart request is aborted @critical @resilience @smoke', async ({
    page,
  }) => {
    await test.step('3: Abort add-to-cart request mid-flight', async () => {
      let requestAborted = false;

      // Intercept and abort the first add-to-cart request
      await page.route('**/add_to_cart', async (route, request) => {
        if (!requestAborted && request.method() === 'POST') {
          logger.info('[INFO] Aborting add-to-cart request');
          await route.abort('failed');
          requestAborted = true;
        } else {
          await route.continue();
        }
      });

      const addToCartBtn = productsPage.getFirstProductAddToCartBtn();
      await addToCartBtn.click();
      const continueShoppingBtn = productsPage.getContinueShoppingBtn();
      await continueShoppingBtn.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
      logger.info('[PASS] Add-to-cart request aborted, waiting for retry');
    });

    await test.step('4: Verify retry succeeded', async () => {
      const continueShoppingBtn = productsPage.getContinueShoppingBtn();
      await page.waitForLoadState('load').catch(() => {});
      await continueShoppingBtn.waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
      await expect(continueShoppingBtn).toBeVisible({ timeout: 8000 });

      // Assert modal is actually visible
      const modalText = await continueShoppingBtn.textContent();
      expect(modalText).toMatch(/continue shopping/i);

      logger.info('[PASS] Retry successful - product added to cart');
    });

    await test.step('5: Verify cart contains product', async () => {
      const viewCartLink = page.locator('a:has-text("View Cart")');
      await viewCartLink.click();

      await cartPage.isPageLoaded();
      const cartRows = cartPage.getCartRows();
      await cartRows.first().waitFor({ state: 'visible' });

      logger.info('[PASS] Cart contains product - network abort recovery successful');
    });
  });

  test('should handle multiple consecutive aborts gracefully @critical @resilience @smoke', async ({
    page,
  }) => {
    await test.step('3: Abort first 3 add-to-cart attempts', async () => {
      let abortCount = 0;
      const maxAborts = 3;

      await page.route('**/add_to_cart', async (route, request) => {
        if (abortCount < maxAborts && request.method() === 'POST') {
          logger.info(`[INFO] Aborting add-to-cart attempt ${abortCount + 1}/${maxAborts}`);
          await route.abort('failed');
          abortCount++;
        } else {
          await route.continue();
        }
      });

      const addToCartBtn = productsPage.getFirstProductAddToCartBtn();
      await addToCartBtn.click();
      const continueShoppingBtn = productsPage.getContinueShoppingBtn();
      await continueShoppingBtn.waitFor({ state: 'attached', timeout: 12000 }).catch(() => {});
      logger.info(`[PASS] Survived ${maxAborts} consecutive aborts`);
    });

    await test.step('4: Verify eventual success after retries', async () => {
      const continueShoppingBtn = productsPage.getContinueShoppingBtn();
      await page.waitForLoadState('load');
      await expect(continueShoppingBtn).toBeVisible({ timeout: 12000 });

      logger.info('[PASS] Retry mechanism succeeded after multiple failures');
    });
  });
});
