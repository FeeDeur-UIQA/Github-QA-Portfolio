/**
 * Data Isolation Fixtures
 *
 * Provides automatic test data cleanup and isolation.
 * Ensures each test starts with a clean state.
 *
 * @usage
 * import { test } from '../fixtures/data-isolation.fixtures';
 *
 * test('my test', async ({ isolatedUser, dataCleanup }) => {
 *   // Use isolatedUser - automatically cleaned up after test
 *   await page.goto('/login');
 * });
 */

import { test as base } from '@playwright/test';

import { TestUserFactory } from '../src/support/factories/TestUserFactory';
import { Logger } from '../src/utils/Logger';

const logger = Logger.getInstance('DataIsolationFixtures');

export interface DataIsolationFixtures {
  /**
   * Automatically create and register a user for the test.
   * User is cleaned up after test completion.
   */
  isolatedUser: {
    name: string;
    email: string;
    password: string;
  };

  /**
   * Cleanup function to manually trigger cleanup.
   * Automatically called after each test.
   */
  dataCleanup: () => Promise<void>;

  /**
   * User factory for creating multiple users in a test
   */
  userFactory: typeof TestUserFactory;
}

export const test = base.extend<DataIsolationFixtures>({
  /**
   * Create an isolated user for each test
   */
  isolatedUser: async ({ page }, use, testInfo) => {
    logger.info(`Creating isolated user for test: ${testInfo.title}`);

    const user = await TestUserFactory.createAndRegisterUser(page, {
      namePrefix: 'isolated',
      testName: testInfo.title,
    });

    // Provide user to test
    await use(user);

    // Cleanup after test
    logger.info(`Cleaning up isolated user: ${user.email}`);
    await TestUserFactory.cleanup(user.email, page);
  },

  /**
   * Provide cleanup function to tests
   */
  dataCleanup: async ({ page }, use, testInfo) => {
    const cleanupFn = async () => {
      logger.info(`Manual cleanup triggered for test: ${testInfo.title}`);
      await TestUserFactory.cleanupByTest(testInfo.title, page);
    };

    await use(cleanupFn);

    // Auto-cleanup after test completion
    logger.info(`Auto-cleanup for test: ${testInfo.title}`);
    await TestUserFactory.cleanupByTest(testInfo.title, page);
  },

  /**
   * Provide user factory to tests
   */
  userFactory: async (_testFixtures, use, testInfo) => {
    // Configure factory with test context
    await use(TestUserFactory);

    // Cleanup all users created by this test
    await TestUserFactory.cleanupByTest(testInfo.title);
  },
});

/**
 * Global test hooks for data management
 */
test.beforeEach(async (_testFixtures, testInfo) => {
  logger.info(`Starting test: ${testInfo.title}`);
  logger.debug('Test data isolation enabled');
});

test.afterEach(async (_testFixtures, testInfo) => {
  const summary = TestUserFactory.getSummary();
  logger.info(`Test completed: ${testInfo.title}`, {
    usersCreated: summary.byTest[testInfo.title] || 0,
  });

  // Final cleanup verification
  const remainingUsers = TestUserFactory.getUsersByTest(testInfo.title);
  if (remainingUsers.length > 0) {
    logger.warn(`${remainingUsers.length} users not cleaned up for test: ${testInfo.title}`);
  }
});

export { expect } from '@playwright/test';
