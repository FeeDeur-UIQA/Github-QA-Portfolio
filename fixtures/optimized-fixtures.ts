import type { Page } from '@playwright/test';

import { test as base } from '@playwright/test';

import type { UserAccount } from '../src/support/factories/UserFactory';

import { userPool } from '../src/support/factories/UserPool';
import { PageCleanup, setupGlobalCleanup } from '../src/utils/PageCleanup';

// Setup global cleanup on import
setupGlobalCleanup();

/**
 * Custom fixture types for extended test
 */
interface CustomFixtures {
  user: UserAccount;
  page: Page;
}

// Extended test fixture with optimizations
export const test = base.extend<CustomFixtures>({
  // Optimized user fixture using pool
   
  user: async (_context, use: (user: UserAccount) => Promise<void>): Promise<void> => {
    const user = userPool.getUser();
    await use(user);
    // User is automatically released after test
  },

  // Page fixture with cleanup tracking
  page: async ({ page }, use): Promise<void> => {
    PageCleanup.registerPage(page);
    await use(page);
    await PageCleanup.cleanupPage(page);
  },
});

export { expect } from '@playwright/test';
