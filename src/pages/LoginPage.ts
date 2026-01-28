import { expect } from '@playwright/test';
import type { Locator, Page, Response } from '@playwright/test';

import { BasePage } from './BasePage';
import { HomePage } from './HomePage';

/**
 * LoginPage: Context-Scoped for Strict Mode Immunity.
 */
export class LoginPage extends BasePage {
  private readonly PAGE_URL = /.*login/;
  public readonly loginContainer: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly loginHeader: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);

    // ANCHOR: Form-level scoping
    this.loginContainer = page.locator('.login-form');

    this.emailInput = this.loginContainer.locator('input[data-qa="login-email"]');
    this.passwordInput = this.loginContainer.locator('input[data-qa="login-password"]');
    this.loginButton = this.loginContainer.locator('button[data-qa="login-button"]');
    this.loginHeader = this.loginContainer.getByRole('heading', { name: /login to your account/i });

    // Scoped within the form to avoid header/footer text collisions
    this.errorMessage = this.loginContainer
      .locator('p')
      .filter({ hasText: /email or password is incorrect/i });
  }

  async isPageLoaded(): Promise<void> {
    await expect(this.loginHeader).toBeVisible();
    await expect(this.page).toHaveURL(this.PAGE_URL);
  }

  /**
   * Navigate to the login page.
   * Overrides BasePage.navigateTo() to use the correct path.
   */
  async navigateTo(path: string = '/login', retries: number = 3): Promise<Response | null> {
    return await super.navigateTo(path, retries);
  }

  async login(email: string, pass: string): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.loginContainer.waitFor({ state: 'visible', timeout: 10000 });
    await this.emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.emailInput.fill(email);
    await this.passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.passwordInput.fill(pass);
    await this.loginButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.safeClick(this.loginButton);
  }

  /**
   * SUCCESS PATH: Includes Load State Guard
   */
  async performLogin(email: string, pass: string): Promise<HomePage> {
    await this.login(email, pass);
    // QE BEST PRACTICE: Wait for page load before verifying Home Page
    await this.page.waitForLoadState('load');
    const homePage = new HomePage(this.page);
    await homePage.isPageLoaded();
    return homePage;
  }

  /**
   * NEGATIVE PATH: Includes specific feedback wait
   */
  async performInvalidLogin(email: string, pass: string): Promise<void> {
    await this.login(email, pass);
    await expect(this.errorMessage).toBeVisible({ timeout: 10000 });
  }

  // ==================== ACCESSIBILITY TEST HELPERS ====================
  getEmailInput(): Locator {
    return this.emailInput;
  }

  getPasswordInput(): Locator {
    return this.passwordInput;
  }

  getLoginButton(): Locator {
    return this.loginButton;
  }

  getErrorMessage(): Locator {
    return this.errorMessage;
  }

  getLoginContainer(): Locator {
    return this.loginContainer;
  }
}
