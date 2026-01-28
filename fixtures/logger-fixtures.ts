/**
 * Enhanced Playwright Fixtures with Structured Logging Integration
 *
 * This fixture extends base Playwright test with:
 * - Automatic test context injection into Logger
 * - Test-level timing and performance tracking
 * - Automatic log cleanup between tests
 * - CI/CD optimized output formatting
 */

import { test as base } from '@playwright/test';

import { Logger } from '../src/utils/Logger';

type LoggerFixtures = {
  testLogger: Logger;
};

/**
 * Enhanced test fixture with automatic logger configuration
 */
export const test = base.extend<LoggerFixtures>({
  /**
   * Enhanced page fixture with ad-blocking in TURBO_MODE
   * Blocks images and fonts for faster test execution
   */
  page: async ({ page }, use, testInfo) => {
    const startTime = Date.now();
    const logger = Logger.getInstance('TestRunner');

    // Set test context for log correlation
    Logger.setTestContext({
      testId: testInfo.testId,
      testTitle: testInfo.title,
      worker: testInfo.workerIndex,
    });

    logger.info('Test started', {
      title: testInfo.title,
      project: testInfo.project.name,
      file: testInfo.file,
      tags: testInfo.tags,
    });

    // TURBO_MODE: Block images and fonts for speed
    if (process.env.TURBO_MODE === 'true') {
      await page.route('**/*', (route) => {
        const request = route.request();
        const resourceType = request.resourceType();

        if (['image', 'font', 'media'].includes(resourceType)) {
          void route.abort();
        } else {
          void route.continue();
        }
      });
      logger.debug('TURBO_MODE enabled: blocking images, fonts, and media');
    }

    // Execute test
    await use(page);

    // Cleanup and log test completion
    const duration = Date.now() - startTime;
    const status = testInfo.status;

    if (status === 'passed') {
      logger.info('Test passed', { duration, title: testInfo.title });
    } else if (status === 'failed') {
      logger.error('Test failed', {
        duration,
        title: testInfo.title,
        error: testInfo.error?.message,
        errors: testInfo.errors.map((e) => e.message),
      });
    } else if (status === 'timedOut') {
      logger.error('Test timed out', { duration, title: testInfo.title });
    } else if (status === 'skipped') {
      logger.warn('Test skipped', { title: testInfo.title });
    }

    // Clear test context for next test
    Logger.clearTestContext();
  },

  /**
   * Dedicated test logger fixture
   * Use this in tests for test-specific logging
   */
  testLogger: async (_fixtures: {}, use, testInfo): Promise<void> => {
    const logger = Logger.getInstance(`Test:${testInfo.title}`);
    await use(logger);
  },
});

export { expect } from '@playwright/test';
