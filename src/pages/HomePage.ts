import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { BasePage } from './BasePage';
import { ProductsPage } from './ProductsPage';

/**
 * HomePage: The Central Application Hub.
 * Strategy: Dynamic State Guards & Fluent Requirement Mapping.
 */
export class HomePage extends BasePage {
  private readonly PAGE_URL = /\/?$/;

  // Navigational Links
  private readonly signupLoginLink: Locator;
  private readonly logoutLink: Locator;
  private readonly productsLink: Locator;
  private readonly deleteAccountLink: Locator;
  private readonly loggedInAsText: Locator;

  constructor(page: Page) {
    super(page);

    // TC-01 Step 4: Guest Navigation
    this.signupLoginLink = page.getByRole('link', { name: /signup \/ login/i });

    // Authenticated Navigation
    this.logoutLink = page.getByRole('link', { name: /logout/i });
    this.deleteAccountLink = page.getByRole('link', { name: /delete account/i });
    this.productsLink = page.getByRole('link', { name: /products/i });

    // Identity Locator
    this.loggedInAsText = page.locator('li').filter({ hasText: /logged in as/i });
  }

  /**
   * Validate page load - checks for either login or logout link depending on session state.
   */
  async isPageLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(this.PAGE_URL);
    // Polish: Check for either Login or Logout to support Guest/User states
    await expect(this.signupLoginLink.or(this.logoutLink).first()).toBeVisible({ timeout: 10000 });
  }

  /**
   * TC-01 Step 4: Transitions to Signup/Login View.
   * Note: This resolves the VSC error "Property navigateToLogin does not exist".
   */
  async navigateToLogin(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.safeClick(this.signupLoginLink);
  }

  /**
   * TC-01 Step 17: UI-Driven Account Deletion.
   */
  async clickDeleteAccount(): Promise<void> {
    await this.safeClick(this.deleteAccountLink);
  }

  /**
   * NAVIGATION: Self-Healing Transition.
   */
  async navigateToProducts(): Promise<ProductsPage> {
    await this.page.waitForLoadState('load');
    await this.safeClick(this.productsLink);
    await expect(this.page).toHaveURL(/\/products/);

    const productsPage = new ProductsPage(this.page);
    await productsPage.isPageLoaded();
    return productsPage;
  }

  /**
   * DOMAIN LOGIC: Data integrity check for TC-01 Step 16.
   */
  async verifyLoggedInUser(expectedName: string): Promise<void> {
    await expect(this.loggedInAsText).toBeVisible();
    await expect(this.loggedInAsText).toContainText(expectedName);
  }

  /**
   * ACTION: Teardown the user session.
   */
  async logout(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.safeClick(this.logoutLink);
    await expect(this.signupLoginLink).toBeVisible();
  }

  /**
   * STATE RESET: Logs out only when a session is active.
   */
  async ensureLoggedOut(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    const isLoggedIn = await this.logoutLink.isVisible().catch(() => false);
    if (isLoggedIn) {
      await this.logout();
    }
  }

  // ==================== ACCESSIBILITY TEST HELPERS ====================
  getSignupLoginLink(): Locator {
    return this.signupLoginLink;
  }

  getProductsLink(): Locator {
    return this.productsLink;
  }

  getLogoutLink(): Locator {
    return this.logoutLink;
  }

  getDeleteAccountLink(): Locator {
    return this.deleteAccountLink;
  }

  getLoggedInAsText(): Locator {
    return this.loggedInAsText;
  }
}
