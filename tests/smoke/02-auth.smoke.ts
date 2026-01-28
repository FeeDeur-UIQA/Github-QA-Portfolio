import { SignupPage } from '../../src/pages/SignupPage';
import { UserFactory } from '../../src/support/factories/UserFactory';

import { test, expect, registerSmokeHooks } from './smoke-hooks';
import { SmokeMetricsAggregator } from './smoke.utils';

registerSmokeHooks();

/**
 * SMOKE TEST SUITE: Authentication Flows
 * Consolidated: Registration + Login + Account Lifecycle
 * Phase 2 Complete: Unified metrics collection + performance budgets
 */

/**
 * TC-01: User Registration Lifecycle
 * Goal: Verify full CRUD lifecycle with Performance Telemetry.
 */
test.describe('Authentication Smoke Tests', () => {
  test('TC-01: Should successfully register and delete a user @critical @smoke @e2e @auth', async ({
    page,
    homePage,
    signupPage,
    request,
  }, testInfo) => {
    const startTime = Date.now();

    // 1. DATA INITIALIZATION
    const newUser = UserFactory.createAccount();

    test.info().annotations.push({
      type: 'Test Data',
      description: `Name: ${newUser.name} | Email: ${newUser.email}`,
    });

    try {
      // 2. PRE-FLIGHT CHECK (Environmental Health)
      await test.step('Navigation & Connectivity', async () => {
        const response = await request.get('/');
        expect(response.ok(), 'Endpoint Resilience Failure').toBeTruthy();

        await homePage.navigateTo();
        await homePage.isPageLoaded();
      });

      // 3. AUTHENTICATION ENTRY
      await test.step('Access Signup UI', async () => {
        await homePage.navigateToLogin();
        await signupPage.isSignupFormVisible();
        // Scoped assertion to ensure we are in the correct form
        await expect(signupPage.signupContainer.getByText('New User Signup!')).toBeVisible();
      });

      // 4. MULTI-PHASE FORM COMPLETION
      await test.step('Execute Multi-Phase Registration', async () => {
        const startTime = Date.now();

        // Form transitions from account details (Phase 1) to verification (Phase 2)
        await signupPage.createAccount(newUser);

        const duration = (Date.now() - startTime) / 1000;
        // Log performance warning without failing (better UX)

        if (duration > 12) {
          test.info().annotations.push({
            type: 'Performance Warning',
            description: `Flow took ${duration}s`,
          });
        }
      });

      // 5. POST-REGISTRATION VALIDATION
      await test.step('Confirm Identity & Visual Integrity', async () => {
        // Multi-layer validation for zero flakiness
        await homePage.assertNoServerError();
        await homePage.waitForPageReady();

        // Gated transition - URL check before content assertion
        await expect(page).toHaveURL(/.*account_created/i);

        // Retry wrapper handles transient failures
        await homePage.expectEventually(
          async () =>
            await expect(page.getByRole('heading', { name: /account created!/i })).toBeVisible(),
          { timeout: 20000, retries: 3, name: 'Account Created confirmation' },
        );

        // Double-click protection with navigation guard
        await Promise.all([
          page.waitForURL(/\//),
          page.getByRole('link', { name: 'Continue' }).click(),
        ]);

        const headerIdentity = page.locator('header').getByText(`Logged in as ${newUser.name}`);
        await expect(headerIdentity).toBeVisible();
      });

      // 6. TEARDOWN (CLEANUP)
      await test.step('Purge Account (Environmental Hygiene)', async () => {
        await page.getByRole('link', { name: /delete account/i }).click();

        await expect(page).toHaveURL(/.*delete_account/i);
        await expect(page.getByRole('heading', { name: /account deleted!/i })).toBeVisible();

        await page.getByRole('link', { name: 'Continue' }).click();
        await expect(page).toHaveURL(/\/$/);
      });

      // Record successful test metrics
      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'passed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'auth',
      });
    } catch (error) {
      // Record failed test metrics
      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'auth',
        errors: [String(error)],
      });
      throw error;
    }
  });

  /**
   * TC-02: Login User with correct email and password
   * Strategy: Validate the complete lifecycle from Auth to Account Purge.
   */
  test('TC-02: Should successfully login and delete user account @critical @smoke @e2e @auth', async ({
    page,
    homePage,
    loginPage,
  }, testInfo) => {
    const startTime = Date.now();

    // 1. DATA INITIALIZATION
    // Nanosecond-precision email ensures zero collision across parallel workers
    const newUser = UserFactory.createAccount();
    const signupPage = new SignupPage(page);

    try {
      await test.step('Architectural Setup: Prerequisite State', async () => {
        await homePage.navigateTo();
        await homePage.navigateToLogin();
        await signupPage.createAccount(newUser);

        // Server error detection before assertion
        await homePage.assertNoServerError();
        await homePage.waitForPageReady();

        // Retry wrapper for account creation confirmation
        await homePage.expectEventually(
          async () =>
            await expect(page.getByRole('heading', { name: /account created!/i })).toBeVisible(),
          { timeout: 20000, retries: 3, name: 'Account Created confirmation' },
        );
        await page.getByRole('link', { name: 'Continue' }).click();

        // Identity Guard - Ensure we are logged in before we try to 'log in' again
        const logoutLink = page.getByRole('link', { name: /Logout/i });
        await logoutLink.waitFor({ state: 'visible', timeout: 10000 });
        await logoutLink.click({ timeout: 8000 });
      });

      await test.step('1-5: Authentication Navigation', async () => {
        await homePage.navigateTo();
        await homePage.navigateToLogin();
        await loginPage.isPageLoaded();
      });

      await test.step('6-8: Identity Challenge & Verification', async () => {
        // Login with explicit load state wait
        await loginPage.login(newUser.email, newUser.password);

        // Targeted wait for successful login (URL + identity check)
        // Faster than networkidle, more specific to login completion
        await page.waitForURL(/\//, { timeout: 8000 });

        // Verify identity using dynamic name from the factory
        const identityLocator = page.locator('header').getByText(`Logged in as ${newUser.name}`);
        await expect(identityLocator).toBeVisible({ timeout: 12000 });
      });

      await test.step('9-10: Environmental Cleanup (Teardown)', async () => {
        // ARIA-based link selection for stability (lowercase for consistency)
        await page.getByRole('link', { name: /delete account/i }).click();

        await expect(page).toHaveURL(/.*delete_account/i);
        const successHeading = page.getByRole('heading', { name: /account deleted!/i });
        await expect(successHeading).toBeVisible();

        // Ensure system returns to neutral landing state
        await page.getByRole('link', { name: 'Continue' }).click();
        await expect(page).toHaveURL(/\/$/);
      });

      // Record successful test metrics
      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'passed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'auth',
      });
    } catch (error) {
      // Record failed test metrics
      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'auth',
        errors: [String(error)],
      });
      throw error;
    }
  });
});
