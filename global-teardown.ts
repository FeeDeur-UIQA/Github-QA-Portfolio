/**
 * Global Teardown - Test Data Cleanup
 *
 * Runs ONCE after all test workers complete.
 * Cleans up test users created during test runs.
 *
 * @fileoverview Production-grade test data management
 */

import fs from 'fs';
import path from 'path';

import { chromium } from '@playwright/test';

import { LoginPage } from './src/pages/LoginPage';
import { Logger } from './src/utils/Logger';

const TEST_USERS_FILE = path.join(__dirname, 'test-results', 'test-users.jsonl');

interface TestUser {
  email: string;
  password: string;
  timestamp: string;
  testFile?: string;
}

/**
 * Global teardown function - deletes all test users created during run
 */
async function globalTeardown(): Promise<void> {
  const logger = Logger.getInstance('GlobalTeardown');

  logger.info('🧹 Starting global teardown - cleaning test data');

  // Check if test users file exists
  if (!fs.existsSync(TEST_USERS_FILE)) {
    logger.info('No test users to clean up - file not found');
    return;
  }

  // Read all test users from JSONL file
  const fileContent = fs.readFileSync(TEST_USERS_FILE, 'utf-8');
  const testUsers: TestUser[] = fileContent
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as TestUser);

  if (testUsers.length === 0) {
    logger.info('No test users to clean up - file empty');
    return;
  }

  logger.info(`Found ${testUsers.length} test users to delete`);

  // Launch browser for cleanup
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let successCount = 0;
  let failCount = 0;

  // Delete each test user
  for (const user of testUsers) {
    try {
      logger.info(`Deleting test user: ${user.email}`);

      // Navigate to login page
      const loginPage = new LoginPage(page);
      await loginPage.navigateTo();

      // Login with test credentials
      await loginPage.login(user.email, user.password);

      // Wait for login success - URL should change from /login
      await page.waitForURL(/\//, { timeout: 10000 });

      // Delete account - direct click on delete account link
      await page.getByRole('link', { name: /delete account/i }).click();

      // Verify deletion confirmation
      await page.waitForURL(/\/delete_account/, { timeout: 10000 });

      successCount++;
      logger.info(`✅ Successfully deleted: ${user.email}`);
    } catch (error) {
      failCount++;
      logger.error(`❌ Failed to delete: ${user.email}`, { error });
    }
  }

  await browser.close();

  // Log summary
  logger.info('🧹 Global teardown complete', {
    total: testUsers.length,
    success: successCount,
    failed: failCount,
  });

  // Archive the test users file
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const archivePath = path.join(__dirname, 'test-results', `test-users-${timestamp}.jsonl`);
  fs.renameSync(TEST_USERS_FILE, archivePath);
  logger.info(`Archived test users to: ${archivePath}`);

  // Fail teardown if any deletions failed (highlights cleanup issues)
  if (failCount > 0) {
    throw new Error(
      `Global teardown failed: ${failCount} of ${testUsers.length} users could not be deleted`,
    );
  }
}

export default globalTeardown;
