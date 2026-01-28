import { UserFactory } from '@factories/UserFactory';
import { test, expect } from '@support/page-fixtures';

test.describe('TC-17: Account Deletion Lifecycle @medium', () => {
  let tempUser: ReturnType<typeof UserFactory.createAccount>;
  let accountCreated = false;

  test.afterEach(async ({ page }) => {
    // Cleanup: Ensure account is deleted even if test fails
    if (accountCreated) {
      try {
        const deleteLink = page.getByRole('link', { name: / delete account/i });
        if (await deleteLink.isVisible({ timeout: 2000 })) {
          await deleteLink.click();
          await expect(page.getByText(/Account Deleted!/i)).toBeVisible({ timeout: 8000 });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('⚠️ Cleanup: Account deletion failed in afterEach', errorMessage);
      } finally {
        accountCreated = false;
      }
    }
  });

  test('Should ensure account removal for environmental hygiene @critical @account @regression @cleanup', async ({
    page,
    homePage,
    signupPage,
  }) => {
    tempUser = UserFactory.createAccount();
    accountCreated = false;

    await test.step('Prerequisite: Create Temporary Account', async () => {
      await homePage.navigateTo();
      await homePage.navigateToLogin();
      await signupPage.createAccount(tempUser);
      // Wait for "Account Created!" confirmation with explicit timeout
      await expect(page.getByText(/Account Created!/i)).toBeVisible({ timeout: 8000 });
      accountCreated = true;

      // Click Continue to proceed to logged-in state
      await page.getByRole('link', { name: /continue/i }).click();

      // Wait for user to be logged in (username appears in header)
      await expect(page.getByText(`Logged in as ${tempUser.name}`)).toBeVisible({ timeout: 5000 });
    });

    await test.step('Execution: Delete Account', async () => {
      // Navigate to Delete link via ARIA role
      const deleteLink = page.getByRole('link', { name: / delete account/i });
      await deleteLink.click();
      accountCreated = false; // Mark as cleaned up
    });

    await test.step('Verification: State Purge', async () => {
      await expect(page.getByText(/Account Deleted!/i)).toBeVisible({ timeout: 8000 });

      // Visual verification of the "Clean State"
      await expect.soft(page).toHaveScreenshot('TC-17-Account-Purged.png', {
        mask: [page.locator('header')],
      });

      await page.getByRole('link', { name: /continue/i }).click();
    });
  });
});
