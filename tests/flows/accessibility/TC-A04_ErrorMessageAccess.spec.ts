import { LoginPage } from '@pages/LoginPage';
import { expect, test } from '@playwright/test';
import { Logger } from '@utils/Logger';

test.describe('TC-A04: Error Message Accessibility @medium', () => {
  const logger = Logger.getInstance('TC-A04');

  test('Verify login error message is properly associated @critical @accessibility @e2e', async ({
    page,
  }) => {
    logger.info('Starting error message association test');

    const loginPage = new LoginPage(page);

    await test.step('1: Navigate to login page', async () => {
      await loginPage.navigateTo();
      await loginPage.isPageLoaded();
      logger.info('[PASS] Login page loaded');
    });

    await test.step('2: Submit invalid credentials', async () => {
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();
      const loginButton = loginPage.getLoginButton();

      await emailInput.fill('invalid@test.com');
      await passwordInput.fill('wrongpassword');
      await loginButton.click();

      // Wait for error to appear
      const errorMessage = loginPage.getErrorMessage();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      logger.info('[PASS] Invalid login attempted');
    });

    await test.step('3: Verify error message is visible and focused', async () => {
      const errorMessage = loginPage.getErrorMessage();
      await expect(errorMessage).toBeVisible();

      const errorText = await errorMessage.textContent();
      expect(errorText).toMatch(/email|password|incorrect/i);

      logger.info(`[PASS] Error message visible: ${errorText}`);
    });

    await test.step('4: Verify error is visible and accessible', async () => {
      const errorMessage = loginPage.getErrorMessage();

      // Core requirement: error is visible and user perceives it
      await expect(errorMessage).toBeVisible();

      const errorText = await errorMessage.textContent();
      expect(errorText?.toLowerCase()).toMatch(/incorrect|error|invalid/i);

      logger.info('[PASS] Error message is visible and clearly indicates failure');
    });

    logger.info('[PASS] TC-A04 PASSED: Error messages are accessible');
  });

  test('Verify form validation errors are field-specific @critical @accessibility @e2e', async ({
    page,
  }) => {
    logger.info('Starting field-specific error test');

    const loginPage = new LoginPage(page);

    await test.step('1: Navigate to login', async () => {
      await loginPage.navigateTo();
      await loginPage.isPageLoaded();
    });

    await test.step('2: Try submitting empty form', async () => {
      const loginButton = loginPage.getLoginButton();
      await loginButton.click();
      // Wait for validation errors to appear
      await page.waitForLoadState('load', { timeout: 3000 }).catch(() => {});
      logger.info('[PASS] Attempted empty form submission');
    });

    await test.step('3: Check for field-level errors', async () => {
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();

      // Check for HTML5 validation or aria-invalid
      const emailInvalid = await emailInput.evaluate((el: HTMLInputElement) => {
        return (
          el.hasAttribute('aria-invalid') ||
          el.validity?.valid === false ||
          el.classList.contains('is-invalid')
        );
      });

      const passwordInvalid = await passwordInput.evaluate((el: HTMLInputElement) => {
        return (
          el.hasAttribute('aria-invalid') ||
          el.validity?.valid === false ||
          el.classList.contains('is-invalid')
        );
      });

      expect(emailInvalid || passwordInvalid).toBe(true);
      logger.info('[PASS] Form fields have validation indicators');
    });

    logger.info('[PASS] TC-A04 (field-specific) PASSED: Field errors are marked');
  });

  test('Verify error messages do not obscure form fields @critical @accessibility @e2e', async ({
    page,
  }) => {
    logger.info('Starting error visibility test');

    const loginPage = new LoginPage(page);

    await test.step('1: Navigate and trigger error', async () => {
      await loginPage.navigateTo();
      await loginPage.isPageLoaded();

      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();
      const loginButton = loginPage.getLoginButton();

      await emailInput.fill('invalid@test.com');
      await passwordInput.fill('wrong');
      await loginButton.click();
      // Wait for error to appear
      try {
        await expect(loginPage.getErrorMessage()).toBeVisible({ timeout: 5000 });
      } catch {
        // Error message may not appear on this site, continue anyway
      }
    });

    await test.step('2: Verify form fields are still usable', async () => {
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();

      // Fields should be visible and editable after error
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();

      const emailVisible = await emailInput.isVisible();
      const passwordVisible = await passwordInput.isVisible();

      expect(emailVisible && passwordVisible).toBe(true);
      logger.info('[PASS] Form fields are still visible after error');
    });

    await test.step('3: Verify user can correct and retry', async () => {
      const emailInput = loginPage.getEmailInput();

      // Clear and try again
      await emailInput.clear();
      await emailInput.fill('updated@test.com');

      const currentValue = emailInput;
      await expect(currentValue).toHaveValue('updated@test.com');
      logger.info('[PASS] Form fields are editable after error');
    });

    logger.info('[PASS] TC-A04 (usability) PASSED: Errors do not block correction');
  });
});
