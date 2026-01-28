import { test as base } from '@playwright/test';

import { HomePage } from '../src/pages/HomePage';
import { LoginPage } from '../src/pages/LoginPage';
import { ProductsPage } from '../src/pages/ProductsPage';
import { Logger } from '../src/utils/Logger';

/**
 * ACCESSIBILITY TEST FIXTURES: Optimized Page Object Injection
 *
 * Benefits:
 * - Centralized page object initialization
 * - Consistent logger setup across tests
 * - Lazy-loading for performance
 * - Cleaner test code (fewer boilerplate instantiations)
 * - Better reusability across test suites
 * - Improved parallelization efficiency
 *
 * Usage:
 *   test('my test', async ({ page, homePage, loginPage, productsPage, logger }) => {
 *     // Page objects ready to use, no manual instantiation needed
 *   });
 */

type AccessibilityFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  productsPage: ProductsPage;
  logger: Logger;
};

export const test = base.extend<AccessibilityFixtures>({
  /**
   * CENTRALIZED LOGGER: Instance per test for better trace tracking
   * Benefits:
   * - Unique logger per test execution
   * - Helps with CI/CD log aggregation
   * - Supports test parallelization
   */
   
  logger: async ({ page: _page }, use) => {
    // Use a generic logger name; specific tests override with their own logger if needed
    const logger = Logger.getInstance('AccessibilityTest');
    await use(logger);
  },

  /**
   * HOME PAGE FIXTURE: Lazy-loaded HomePage instance
   * Benefits:
   * - Consistent initialization across all tests
   * - Page object ready immediately
   * - Better fixture reusability
   * - Automatic cleanup on test end
   */
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
    // Cleanup happens automatically when test ends
  },

  /**
   * LOGIN PAGE FIXTURE: Lazy-loaded LoginPage instance
   * Benefits:
   * - Pre-configured for authentication tests
   * - Consistent error handling via page object
   * - Improves test readability
   */
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  /**
   * PRODUCTS PAGE FIXTURE: Lazy-loaded ProductsPage instance
   * Benefits:
   * - Centralized product page operations
   * - Better test organization
   * - Easier to maintain page object methods
   */
  productsPage: async ({ page }, use) => {
    const productsPage = new ProductsPage(page);
    await use(productsPage);
  },
});

export { expect } from '@playwright/test';
