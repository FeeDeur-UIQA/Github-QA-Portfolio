/**
 * EXAMPLE: Logger Integration Demo
 *
 * This test demonstrates how to use the structured logging system
 * with the logger-fixtures for automatic test correlation.
 *
 * To use in your tests:
 * 1. Import from logger-fixtures: import { test, expect } from '../fixtures/logger-fixtures'
 * 2. Use testLogger fixture for test-level logging
 * 3. Page objects automatically log via BasePage
 */

import { expect, test } from '@playwright/test';

import { HomePage } from '../src/pages/HomePage';
import { Logger, LogLevel } from '../src/utils/Logger';

test.describe('Structured Logging Demo @demo @fast', () => {
  test.beforeAll(() => {
    // Optional: Set log level for this suite
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
  });

  test('DEMO: Logger features showcase @regression', async ({ page }) => {
    const testLogger = Logger.getInstance('DemoLogger');
    testLogger.info('Demo test started - showcasing logger features');

    // Assert the logger was initialized properly
    expect(testLogger).toBeDefined();

    await test.step('1: Navigate with automatic page logging', async () => {
      const homePage = new HomePage(page);

      // BasePage logger automatically logs navigation attempts and retries
      await homePage.navigateTo();
      await homePage.isPageLoaded();

      testLogger.info('Home page loaded successfully');
    });

    await test.step('2: Different log levels', () => {
      testLogger.debug('This is debug-level information', {
        environment: 'test',
        userId: 'demo-user',
      });

      testLogger.info('This is informational message', {
        action: 'demonstration',
        step: 2,
      });

      testLogger.warn('This is a warning (not a failure)', {
        reason: 'demonstration',
        severity: 'low',
      });

      // Note: logger.error is typically used in catch blocks
      // Demonstrating it doesn't fail the test
      testLogger.error('This is an error log (for demo only)', {
        type: 'demonstration',
        actualError: false,
      });
    });

    await test.step('3: Performance tracking', async () => {
      const timer = testLogger.startTimer();

      // Simulate some operation
      await page.waitForLoadState('domcontentloaded');

      testLogger.endTimer('Demo operation', timer, {
        operation: 'simulated delay',
        iterations: 1,
      });
    });

    await test.step('4: Rich metadata logging', () => {
      const productData = {
        id: 1,
        name: 'Blue Top',
        price: 500,
        category: 'Women > Tops',
      };

      testLogger.info('Processing product data', {
        product: productData,
        timestamp: new Date().toISOString(),
        worker: test.info().workerIndex,
      });
    });

    testLogger.info('Demo test completed - check test-results/logs for output');
  });

  test('DEMO: Error correlation showcase @regression', async ({ page }) => {
    const testLogger = Logger.getInstance('DemoLogger');
    testLogger.info('Demonstrating error correlation in logs');

    try {
      // Intentional failure for demo
      await page.goto('/nonexistent-page');
      await expect(page.locator('#does-not-exist')).toBeVisible({ timeout: 2000 });
    } catch (error) {
      testLogger.error('Expected error caught for demonstration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        page: page.url(),
        timestamp: Date.now(),
      });

      // This shows how errors are correlated with test failures
      // Check test-results/logs/{test-name}.json to see the correlation
    }

    testLogger.info('Error correlation demo completed');
  });
});

/**
 * USAGE INSTRUCTIONS:
 *
 * 1. Run with standard log level (INFO):
 *    npx playwright test TC-XX_LoggerDemo.spec.ts
 *
 * 2. Run with debug logs:
 *    LOG_LEVEL=DEBUG npx playwright test TC-XX_LoggerDemo.spec.ts
 *
 * 3. Run in CI mode (JSON output):
 *    CI=true npx playwright test TC-XX_LoggerDemo.spec.ts
 *
 * 4. View aggregated logs:
 *    cat test-results/logs/summary.json | jq
 *
 * 5. View specific test logs:
 *    cat test-results/logs/demo__logger_features_showcase.json | jq
 */
