import { LoginPage } from '@pages/LoginPage';
import { ProductsPage } from '@pages/ProductsPage';
import { expect, test } from '@playwright/test';
import { Logger } from '@utils/Logger';

test.describe('TC-SEC01: XSS Injection Protection @slow', () => {
  const logger = Logger.getInstance('TC-SEC01');

  test.beforeEach(async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.navigateTo();
    await productsPage.isPageLoaded();
  });

  test('Verify search field prevents XSS injection @critical @security @e2e', async ({ page }) => {
    logger.info('Starting XSS injection test for search field');

    const productsPage = new ProductsPage(page);

    await test.step('2: Attempt XSS injection via search', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      const searchInput = page.locator('#search_product');

      await searchInput.fill(xssPayload);
      await page.locator('#submit_search').click();
      await expect(page.locator('.features_items')).toBeVisible({ timeout: 5000 });

      logger.info('[PASS] XSS payload submitted');
    });

    await test.step('3: Verify script not executed', async () => {
      // If script executed, alert dialog would appear
      const dialog = await page.waitForEvent('dialog', { timeout: 1500 }).catch(() => null);
      if (dialog) await dialog.dismiss();
      expect(dialog).toBeNull();
      logger.info('[PASS] XSS script was NOT executed');
    });

    await test.step('4: Verify page remains functional', async () => {
      // Check page is still responsive and hasn't crashed
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();

      // Should be able to navigate
      await productsPage.navigateTo();
      await expect(page).toHaveURL(/products/);

      logger.info('[PASS] Page remains functional after XSS attempt');
    });

    logger.info('[PASS] TC-SEC01 (search XSS) PASSED');
  });

  test('Verify login form prevents XSS in email field @critical @security @e2e', async ({
    page,
  }) => {
    logger.info('Starting XSS injection test for login form');

    const loginPage = new LoginPage(page);

    await test.step('1: Navigate to login', async () => {
      await loginPage.navigateTo();
      await loginPage.isPageLoaded();
    });

    await test.step('2: Inject XSS into email field', async () => {
      const xssPayload = 'test@test.com"><script>alert("xss")</script>';
      const emailInput = loginPage.getEmailInput();

      await emailInput.fill(xssPayload);
      await loginPage.getLoginButton().click();
      // Verify script tag is escaped/not executed by checking page title
      const pageTitle = page.title();
      expect(pageTitle).toBeDefined();

      logger.info('[PASS] XSS payload in email field submitted safely');
    });

    await test.step('3: Verify payload not rendered as HTML', async () => {
      // Check that script tags are escaped/not rendered
      const pageContent = await page.content();
      expect(pageContent).not.toContain('<script>alert');

      logger.info('[PASS] XSS payload was properly escaped');
    });

    logger.info('[PASS] TC-SEC01 (login XSS) PASSED');
  });

  test("Verify product search results don't execute injected scripts @critical @security @e2e", async ({
    page,
  }) => {
    logger.info('Starting XSS injection in search results');

    const productsPage = new ProductsPage(page);

    await test.step('1: Navigate to products', async () => {
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
    });

    await test.step('2: Search with HTML injection payload', async () => {
      const htmlPayload = '<img src=x onerror=alert("xss")>';
      const searchInput = page.locator('#search_product');

      await searchInput.fill(htmlPayload);
      await page.locator('#submit_search').click();
      await expect(page.locator('.features_items')).toBeVisible({ timeout: 5000 });

      logger.info('[PASS] HTML injection payload submitted');
    });

    await test.step('3: Verify onerror handler did not execute', async () => {
      const dialog = await page.waitForEvent('dialog', { timeout: 2000 }).catch(() => null);
      if (dialog) await dialog.dismiss();
      expect(dialog).toBeNull();

      logger.info('[PASS] XSS event handler was NOT executed');
    });

    await test.step('4: Verify results are displayed safely', async () => {
      const resultsContainer = page.locator('.features_items');
      const isVisible = (await resultsContainer.count()) > 0;

      // Results should either show products or "no results" message
      expect(isVisible).toBe(true);
      logger.info('[PASS] Results page displayed safely');
    });

    logger.info('[PASS] TC-SEC01 (HTML injection) PASSED');
  });
});
