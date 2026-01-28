import * as path from 'path';

import { defineConfig, devices } from '@playwright/test';

// Load environment variables from .env file
import 'dotenv/config';

import { env } from './src/utils/env.config';

/**
 * Playwright configuration with environment-driven settings and custom reporters.
 */
export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: ['**/*.spec.ts', '**/*.smoke.ts'], // Support both .spec.ts and .smoke.ts files
  globalSetup: require.resolve('./src/support/GlobalSetup'),
  globalTeardown: require.resolve('./global-teardown'),

  // PERFORMANCE: Enable parallel execution with test isolation
  // Each test gets unique test data via UserFactory to prevent collisions
  fullyParallel: true,
  workers: env.WORKERS,
  retries: env.RETRIES,
  timeout: env.TIMEOUT,

  expect: {
    timeout: env.EXPECT_TIMEOUT,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.1, // Adjusted for local rendering variations
      animations: 'disabled',
      scale: 'css',
    },
  },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./src/utils/LogReporter.ts'],
    ['./src/utils/VisualRegressionReporter.ts'],
    ['./src/utils/JiraReporter.ts'],
    ['./src/utils/SmokeMetricsReporter.ts'], // Cross-worker smoke test metrics
  ],

  outputDir: 'test-results/',

  use: {
    baseURL: env.BASE_URL,
    trace: 'retain-on-failure',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: env.EXPECT_TIMEOUT,
    navigationTimeout: env.NAVIGATION_TIMEOUT,

    // Test isolation: each test gets fresh context
    storageState: undefined, // No shared storage between tests
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // SOLUTION: Disable QUIC to fix net::ERR_QUIC_PROTOCOL_ERROR
          // Disable-GPU and no-sandbox ensure CI stability
          args: ['--disable-setuid-sandbox', '--no-sandbox', '--disable-gpu', '--disable-quic'],
        },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },

    // Mobile viewports for cross-device testing
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
      },
    },
  ],
});
