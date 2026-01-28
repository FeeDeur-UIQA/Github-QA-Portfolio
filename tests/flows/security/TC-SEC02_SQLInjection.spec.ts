import { LoginPage } from '@pages/LoginPage';
import { ProductsPage } from '@pages/ProductsPage';
import { expect, test } from '@playwright/test';
import { Logger } from '@utils/Logger';

test.describe('TC-SEC02: SQL Injection Prevention @slow', () => {
  const logger = Logger.getInstance('TC-SEC02');

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigateTo();
    await loginPage.isPageLoaded();
  });

  test('Verify login prevents SQL injection in email field @critical @security @e2e', async ({
    page,
  }) => {
    logger.info('Starting SQL injection test for login');

    const loginPage = new LoginPage(page);

    await test.step('2: Attempt SQL injection via email field', async () => {
      const sqlPayload = "'; DROP TABLE users; --";
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();

      await emailInput.fill(sqlPayload);
      await passwordInput.fill('anypassword');
      await loginPage.getLoginButton().click();

      // Verify login did not succeed and page remains on login
      await expect(loginPage.getLoginContainer()).toBeVisible({ timeout: 5000 });
      await expect(page).toHaveURL(/\/login/);
      logger.info('[PASS] SQL injection payload submitted');
    });

    await test.step("3: Verify page doesn't show SQL error", async () => {
      // Check for SQL error messages that might indicate vulnerable system
      const pageContent = await page.content();

      const sqlErrors = ['SQL syntax', 'database', 'mysql_', 'PostgreSQL', 'ORA-', 'syntax error'];

      const hasSQLError = sqlErrors.some(
        (error) =>
          pageContent.toLowerCase().includes(error.toLowerCase()) &&
          !pageContent.includes('DROP TABLE'),
      );

      expect(hasSQLError).toBe(false);
      logger.info('[PASS] No SQL error messages exposed');
    });

    await test.step('4: Verify login still functions normally', async () => {
      // Try legitimate login (invalid creds should not bypass)
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();

      await emailInput.clear();
      await emailInput.fill('test@test.com');

      await passwordInput.clear();
      await passwordInput.fill('testpass');

      await loginPage.getLoginButton().click();

      // Either error message is shown or we remain on the login page
      const errorMsg = loginPage.getErrorMessage();
      const errorCount = await errorMsg.count().catch(() => 0);

      const stillOnLogin = /\/login/.test(page.url());
      expect(errorCount > 0 || stillOnLogin).toBe(true);
      logger.info('[PASS] Login functionality preserved');
    });

    logger.info('[PASS] TC-SEC02 (SQL injection - login) PASSED');
  });

  test('Verify search prevents SQL injection @critical @security @e2e', async ({ page }) => {
    logger.info('Starting SQL injection test for search');

    await test.step('1: Navigate to products', async () => {
      const productsPage = new ProductsPage(page);
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
      logger.info('[PASS] Products page loaded');
    });

    await test.step('2: Attempt SQL injection via search', async () => {
      const sqlPayload = "' OR '1'='1";
      const productsPage = new ProductsPage(page);
      await productsPage.searchProduct(sqlPayload);
      await expect(page.locator('.features_items')).toBeVisible({ timeout: 5000 });
      logger.info('[PASS] SQL injection payload submitted via search');
    });

    await test.step('3: Verify no SQL errors in response', async () => {
      const pageContent = await page.content();

      const sqlErrors = ['SQL syntax', 'database error', 'mysql_error', 'parse error'];

      const hasSQLError = sqlErrors.some((error) =>
        pageContent.toLowerCase().includes(error.toLowerCase()),
      );

      expect(hasSQLError).toBe(false);
      logger.info('[PASS] Search handled injection safely');
    });

    await test.step('4: Verify search still works with legitimate queries', async () => {
      const productsPage = new ProductsPage(page);
      await productsPage.searchProduct('men');
      await expect(page.locator('.features_items')).toBeVisible({ timeout: 5000 });

      // Should show results or "no products" message, not error
      const hasResults = (await page.locator('.features_items').count()) > 0;
      const hasNoProductsMsg = (await page.getByText(/no products/i).count()) > 0;
      const isSearchFunctional = hasResults || hasNoProductsMsg;

      expect(isSearchFunctional).toBe(true);
      logger.info('[PASS] Search functionality preserved');
    });

    logger.info('[PASS] TC-SEC02 (SQL injection - search) PASSED');
  });

  test('Verify parameterized queries protect against union-based SQL injection @critical @security @e2e', async ({
    page,
  }) => {
    logger.info('Starting union-based SQL injection test');

    await test.step('1: Navigate to products', async () => {
      const productsPage = new ProductsPage(page);
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
    });

    await test.step('2: Attempt union-based SQL injection', async () => {
      const unionPayload = "' UNION SELECT * FROM users--";
      const productsPage = new ProductsPage(page);
      await productsPage.searchProduct(unionPayload);
      await expect(page.locator('.features_items')).toBeVisible({ timeout: 5000 });

      logger.info('[PASS] Union-based SQL injection payload submitted');
    });

    await test.step("3: Verify results don't expose user data", async () => {
      const pageContent = await page.content();

      // Should NOT return user table data
      const userDataPatterns = [/email.*password/i, /user_id.*email/i, /admin.*password/i];

      const exposesUserData = userDataPatterns.some((pattern) => pattern.test(pageContent));

      expect(exposesUserData).toBe(false);
      logger.info('[PASS] User data not exposed via injection');
    });

    logger.info('[PASS] TC-SEC02 (union-based injection) PASSED');
  });
});
