import { UserFactory } from '@factories/UserFactory';
import { test, expect } from '@support/page-fixtures';

import { LoginPage } from '../../../src/pages/LoginPage';

/**
 * TC-05: Register User with existing email
 * Implementation: Create user first to guarantee email exists in database.
 */
test.describe('TC-05: Registration Negative Validation', () => {
  let existingUser: ReturnType<typeof UserFactory.createAccount>;
  let accountCreated = false;

  test.afterEach(async ({ page, homePage }) => {
    // Cleanup: Delete the account to prevent data pollution
    if (accountCreated) {
      const loginPage = new LoginPage(page);
      await homePage.ensureLoggedOut();
      await homePage.navigateToLogin();
      await loginPage.login(existingUser.email, existingUser.password);

      // Delete account
      await page.getByRole('link', { name: /delete account/i }).click({ timeout: 8000 });
      await expect(page.getByRole('heading', { name: /account deleted!/i })).toBeVisible({
        timeout: 8000,
      });
      accountCreated = false;
    }
  });

  test('Should show error when registering with an existing email @critical @auth @negative @e2e', async ({
    page,
    homePage,
    signupPage,
  }) => {
    // Create user dynamically to guarantee it exists
    existingUser = UserFactory.createAccount();
    accountCreated = false;

    // Pre-create the user to ensure email exists in DB
    await test.step('Setup: Create existing user account', async () => {
      await homePage.navigateTo();
      await homePage.ensureLoggedOut();
      await homePage.navigateToLogin();
      await signupPage.createAccount(existingUser);

      // Verify account created successfully with explicit timeout
      await expect(page.getByRole('heading', { name: /account created!/i })).toBeVisible({
        timeout: 8000,
      });
      accountCreated = true;
      await page.getByRole('link', { name: 'Continue' }).click();

      // Logout to return to neutral state
      const logoutLink = page.getByRole('link', { name: /Logout/i });
      await expect(logoutLink).toBeVisible({ timeout: 8000 });
      await logoutLink.click({ timeout: 5000 });
    });

    await test.step('Navigation to Auth Page', async () => {
      await homePage.ensureLoggedOut();
      await homePage.navigateTo();
      await homePage.navigateToLogin();
      await signupPage.isSignupFormVisible();
    });

    await test.step('Submission with Existing Email', async () => {
      // Attempt to register with the SAME email
      await signupPage.enterSignupDetails(existingUser.name, existingUser.email);
      await signupPage.clickSignup();
    });

    await test.step('Assertion of Error Logic', async () => {
      // Use regex for flexible matching
      const errorMessage = signupPage.signupContainer.getByText(/Email Address already exist/i);

      await expect(errorMessage).toBeVisible({ timeout: 10000 });

      // Verify error styling (red color)
      const errorStyle = await errorMessage.evaluate((el) => window.getComputedStyle(el).color);
      expect(errorStyle).toMatch(/rgb\(255,\s*0,\s*0\)/);

      // Visual regression with proper masking
      await expect.soft(page).toHaveScreenshot('TC-05-Registration-Error.png', {
        mask: [page.locator('header'), page.locator('footer'), page.locator('.subscription')],
        animations: 'disabled',
      });
    });
  });
});
