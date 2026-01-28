import type { FullConfig } from '@playwright/test';
import { chromium } from '@playwright/test';

import { HomePage } from '../pages/HomePage';
import { SignupPage } from '../pages/SignupPage';
import { env, getEnvSummary, isCI, isTurboMode } from '../utils/env.config';
import { Logger } from '../utils/Logger';

/**
 * GLOBAL SETUP: Test Initialization
 *
 * Responsibilities:
 * 1. Validate all environment configuration (fail-fast on missing secrets)
 * 2. Pre-populate test database with known test accounts
 * 3. Log environment summary for audit trail
 * 4. Detect CI/CD environment automatically
 * 5. Initialize structured logging system
 *
 * Execution: Runs in a separate process before any worker starts
 *
 * Features:
 * - Zod schema validation (type-safe at runtime)
 * - Secret validation with helpful error messages
 * - Automatic environment detection (CI vs Local)
 * - Structured logging for observability
 * - Idempotent setup (safe to run multiple times)
 */

async function globalSetup(_config: FullConfig) {
  const logger = Logger.getInstance('GlobalSetup');

  try {
    // ============================================================================
    // STEP 1: VALIDATE ENVIRONMENT CONFIGURATION
    // ============================================================================
    logger.info('🔐 Validating Environment Configuration');

    // env module validates on import - environment is ready

    // Log environment summary (non-sensitive data only)
    const envSummary = getEnvSummary();
    logger.info('✅ Environment Configuration Loaded', envSummary);

    // Warn if running with optional secrets missing
    if (!env.TEST_EMAIL || !env.TEST_PASSWORD) {
      logger.warn('⚠️  Test Credentials Not Configured', {
        hasTestEmail: !!env.TEST_EMAIL,
        hasTestPassword: !!env.TEST_PASSWORD,
        note: 'Tests will use default test account instead',
      });
    }

    if (env.NOTIFICATION_ENABLED && !env.SLACK_WEBHOOK) {
      logger.warn('⚠️  Slack Notifications Enabled But Webhook Not Configured');
    }

    // ============================================================================
    // STEP 2: DETECT ENVIRONMENT (CI vs Local)
    // ============================================================================
    logger.info('🌍 Detecting Environment');

    const environmentInfo = {
      isCI: isCI(),
      environment: env.NODE_ENV,
      turboMode: isTurboMode(),
      workers: env.WORKERS,
      logLevel: env.LOG_LEVEL,
      timeout: env.TIMEOUT,
      retriesOnFailure: env.RETRIES,
    };

    if (isCI()) {
      logger.info('🤖 Running in CI/CD Environment', {
        platform: process.env.GITHUB_ACTIONS
          ? 'GitHub Actions'
          : process.env.CI
            ? 'CI System'
            : 'Unknown',
        repository: process.env.GITHUB_REPOSITORY || 'N/A',
        branch: process.env.GITHUB_REF_NAME || 'N/A',
        actor: process.env.GITHUB_ACTOR || 'N/A',
      });
    } else {
      logger.info('💻 Running in Local Development Environment', {
        nodeVersion: process.version,
        platform: process.platform,
        hostname: 'local-development',
      });
    }

    // ============================================================================
    // STEP 3: LOG CONFIGURATION SUMMARY
    // ============================================================================
    logger.info('📋 Test Suite Configuration Summary', {
      ...environmentInfo,
      baseUrl: env.BASE_URL,
      databaseUrl: 'N/A (Live site testing)',
      logDirectory: env.LOG_DIR,
      snapshotsPath: 'tests/*-snapshots',
    });

    // ============================================================================
    // STEP 4: INITIALIZE TEST DATABASE (Pre-populate Known Users)
    // ============================================================================
    logger.info('🗄️  Initializing Test Data');

    // Skip browser-based setup in CI - browsers may not be fully installed yet
    // Tests will handle user creation as needed
    if (isCI()) {
      logger.info('⏭️  Skipping browser-based test data setup in CI', {
        reason: 'Browser installation happens separately in CI pipeline',
        note: 'Tests will create accounts as needed during execution',
      });
    } else {
      // Local development: Pre-populate test accounts
      let browser;
      try {
        browser = await chromium.launch();
        const page = await browser.newPage();

        const homePage = new HomePage(page);
        const signupPage = new SignupPage(page);

        // Use environment variables if available, fallback to defaults
        const existingUser = {
          name: 'Test User',
          email: env.TEST_EMAIL || 'valid_user_pw@example.com',
          password: env.TEST_PASSWORD || 'Password123!',
        };

        try {
          logger.info('📝 Setting Up Pre-Existing Test Account', {
            email: existingUser.email,
            note: 'This account will be used by multiple tests',
          });

          await homePage.navigateTo(env.BASE_URL);
          await homePage.navigateToLogin();

          // Attempt registration - idempotent operation
          // If user already exists, site handles it gracefully
          await signupPage.enterSignupDetails(existingUser.name, existingUser.email);
          await signupPage.clickSignup();

          logger.info('✅ Test Account Ready', {
            email: existingUser.email,
            status: 'Available for all test runs',
          });
        } catch (setupError) {
          // User might already exist (idempotent) or site may be down
          logger.warn('⚠️  Test Account Setup Issue', {
            email: existingUser.email,
            error: setupError instanceof Error ? setupError.message : 'Unknown error',
            recovery: 'Proceeding - account may already exist',
          });
        } finally {
          await browser.close();
        }
      } catch (browserError) {
        // Browser launch failed - likely not installed
        logger.warn('⚠️  Browser not available for test data setup', {
          error: browserError instanceof Error ? browserError.message : 'Unknown error',
          recovery: 'Proceeding without pre-populating test data',
        });
      }
    }

    // ============================================================================
    // STEP 5: VALIDATION COMPLETE - READY FOR TEST EXECUTION
    // ============================================================================
    logger.info('✨ Global Setup Complete - Ready to Run Tests', {
      timestamp: new Date().toISOString(),
      totalWorkers: env.WORKERS,
      testTimeout: `${env.TIMEOUT}ms`,
      navigationTimeout: `${env.NAVIGATION_TIMEOUT}ms`,
      assertionTimeout: `${env.EXPECT_TIMEOUT}ms`,
    });

    // Log secret configuration status (without exposing values)
    logger.debug('🔒 Secret Configuration Status', {
      hasBaseUrl: !!env.BASE_URL,
      hasTestCredentials: !!(env.TEST_EMAIL && env.TEST_PASSWORD),
      hasApiKey: !!env.API_KEY,
      hasGitHubToken: !!env.GITHUB_TOKEN,
      hasSlackWebhook: !!env.SLACK_WEBHOOK,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('🚨 Global Setup Failed - Critical Error', {
      error: errorMessage,
      stack: errorStack ? errorStack.split('\n').slice(0, 5) : undefined,
      remedy: 'Check environment configuration and secrets - See Secrets-Management-Guide.md',
    });

    // Re-throw to fail the test suite immediately
    throw error;
  }
}

export default globalSetup;
