import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import type { UserAccount } from '../support/factories/UserFactory';

import { BasePage } from './BasePage';

/**
 * SignupPage: Handles two-phase user registration (account details, then verification).
 */
export class SignupPage extends BasePage {
  private readonly PAGE_URL = /.*signup/;

  // Publicly accessible container for spec-level scoping (Fixes TC-05 error)
  public readonly signupContainer: Locator;

  // Phase 1: Initial Signup (Scoped)
  private readonly nameInput: Locator;
  private readonly emailInput: Locator;
  private readonly signupButton: Locator;

  // Phase 2: Account Details (ID-based)
  private readonly titleMrRadio: Locator;
  private readonly titleMrsRadio: Locator;
  private readonly passwordInput: Locator;
  private readonly daysSelect: Locator;
  private readonly monthsSelect: Locator;
  private readonly yearsSelect: Locator;
  private readonly newsletterCheckbox: Locator;
  private readonly specialOffersCheckbox: Locator;

  // Phase 3: Address Information (ID-based)
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly companyInput: Locator;
  private readonly address1Input: Locator;
  private readonly address2Input: Locator;
  private readonly countrySelect: Locator;
  private readonly stateInput: Locator;
  private readonly cityInput: Locator;
  private readonly zipcodeInput: Locator;
  private readonly mobileInput: Locator;

  private readonly createAccountButton: Locator;

  constructor(page: Page) {
    super(page);

    // Define Phase 1 container to solve locator ambiguity
    this.signupContainer = page.locator('.signup-form');

    // Scoped Phase 1 Locators
    this.nameInput = this.signupContainer.locator('input[data-qa="signup-name"]');
    this.emailInput = this.signupContainer.locator('input[data-qa="signup-email"]');
    this.signupButton = this.signupContainer.locator('button[data-qa="signup-button"]');

    // Global ID Locators (Stable across phases)
    this.titleMrRadio = page.locator('#id_gender1');
    this.titleMrsRadio = page.locator('#id_gender2');
    this.passwordInput = page.locator('#password');
    this.daysSelect = page.locator('#days');
    this.monthsSelect = page.locator('#months');
    this.yearsSelect = page.locator('#years');
    this.newsletterCheckbox = page.locator('#newsletter');
    this.specialOffersCheckbox = page.locator('#optin');

    this.firstNameInput = page.locator('#first_name');
    this.lastNameInput = page.locator('#last_name');
    this.companyInput = page.locator('#company');
    this.address1Input = page.locator('#address1');
    this.address2Input = page.locator('#address2');
    this.countrySelect = page.locator('#country');
    this.stateInput = page.locator('#state');
    this.cityInput = page.locator('#city');
    this.zipcodeInput = page.locator('#zipcode');
    this.mobileInput = page.locator('#mobile_number');

    this.createAccountButton = page.locator('button[data-qa="create-account"]');
  }

  async isPageLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(this.PAGE_URL);
    await expect(this.signupContainer).toBeVisible();
  }

  /**
   * Validates that the initial signup form is visible on /login page.
   * Use this for TC-01 Step 3 before submitting signup details.
   */
  async isSignupFormVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/login/);
    await expect(this.signupContainer).toBeVisible();
  }

  /**
   * ATOMIC ACTION: Used by TC-05.
   */
  async enterSignupDetails(name: string, email: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
  }

  /**
   * ATOMIC ACTION: Triggers registration POST.
   */
  async clickSignup(): Promise<void> {
    await this.safeClick(this.signupButton);
  }

  /**
   * ORCHESTRATION: Full User Registration Flow (TC-01).
   */
  async createAccount(userData: UserAccount): Promise<void> {
    // PARALLELIZATION FIX: Add a small random delay to stagger account creation
    // This prevents overwhelming the server with simultaneous signup requests during parallel test execution
    const delayMs = Math.random() * 1000 + 500; // 500-1500ms random delay
    await this.page.waitForTimeout(delayMs);

    // Phase 1
    await this.enterSignupDetails(userData.name, userData.email);
    await this.clickSignup();

    // Transition Guard: Ensure Phase 2 form is rendered
    await expect(this.passwordInput).toBeVisible({ timeout: 15000 });

    // Phase 2: Personal Info
    if (userData.title === 'Mr') await this.titleMrRadio.check();
    else await this.titleMrsRadio.check();

    await this.passwordInput.fill(userData.password);
    await this.daysSelect.selectOption(userData.day);
    await this.monthsSelect.selectOption(userData.month);
    await this.yearsSelect.selectOption(userData.year);

    if (userData.subscribe) await this.newsletterCheckbox.check();
    if (userData.specialOffers) await this.specialOffersCheckbox.check();

    // Phase 3: Address & Contact
    await this.firstNameInput.fill(userData.firstName);
    await this.lastNameInput.fill(userData.lastName);
    if (userData.company) await this.companyInput.fill(userData.company);
    await this.address1Input.fill(userData.address1);
    if (userData.address2) await this.address2Input.fill(userData.address2);

    await this.countrySelect.selectOption(userData.country);
    await this.stateInput.fill(userData.state);
    await this.cityInput.fill(userData.city);
    await this.zipcodeInput.fill(userData.zipcode);
    await this.mobileInput.fill(userData.mobile);

    // Ensure button is in viewport and stable before clicking
    await this.createAccountButton.scrollIntoViewIfNeeded();
    // Playwright best practice: Replace blind timeout with element stability check
    // waitFor with stable state ensures element is ready for interaction
    await this.createAccountButton.waitFor({ state: 'visible', timeout: 5000 });

    // Use direct click with timeout instead of safeClick which has multiple fallbacks
    try {
      await this.createAccountButton.click({ timeout: 5000 });
    } catch (error) {
      this.logger.warn(
        `First click attempt failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      // Retry with force click
      try {
        await this.createAccountButton.click({ force: true, timeout: 5000 });
      } catch (retryError) {
        this.logger.warn(
          `Force click failed: ${retryError instanceof Error ? retryError.message : 'unknown'}`,
        );
        // Final attempt: navigate via keyboard if button won't click
        await this.createAccountButton.focus();
        await this.page.keyboard.press('Enter');
      }
    }
  }
}
