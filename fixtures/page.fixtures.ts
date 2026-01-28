import { test as base } from '@playwright/test';

import { HomePage } from '../src/pages/HomePage';
import { LoginPage } from '../src/pages/LoginPage';
import { SignupPage } from '../src/pages/SignupPage';

/**
 * PAGE FIXTURES: E2E Test Context
 *
 * Provides:
 * - Page object injection (HomePage, LoginPage, SignupPage)
 * - Ad-blocking middleware
 * - Turbo mode optimization
 * - Console guard for error detection
 * - Context reuse for performance optimization
 */

type PageFixtures = {
  loginPage: LoginPage;
  homePage: HomePage;
  signupPage: SignupPage;
  consoleGuard: void;
};

export const test = base.extend<PageFixtures>({
  /**
   * PAGE OVERRIDE: The "Architectural Guard" Middleware
   * Centralizes Network Sovereignty to keep Page Objects clean.
   */
  page: async ({ page }, use) => {
    // 1. Permanent Ad-Killer: Abort tracking and ad scripts at the protocol level
    const adPatterns = [
      'googleads',
      'g.doubleclick.net',
      'google-analytics',
      'adservice',
      'vignette',
      'adsbygoogle',
      'quantserve',
    ];

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (adPatterns.some((pattern) => url.includes(pattern))) {
        void route.abort();
      } else {
        void route.continue();
      }
    });

    // 2. TURBO MODE: Hyper-Optimization for Headless CI Runs
    if (process.env.TURBO_MODE === 'true') {
      await page.route('**/*.{png,jpg,jpeg,svg,woff2,gif}', (route) => {
        const type = route.request().resourceType();
        if (type === 'image' || type === 'font') {
          void route.abort();
        } else {
          void route.continue();
        }
      });
    }

    await use(page);
  },

  /**
   * GLOBAL TELEMETRY GUARD: Observability without environmental noise.
   */
  consoleGuard: [
    async ({ page }, use) => {
      page.on('console', (msg) => {
        const text = msg.text();
        // Filter out known external noise to focus on Application Health
        const isNoise = /Mixed Content|fonts\.googleapis|net::ERR_FAILED/i.test(text);

        if (msg.type() === 'error' && !isNoise) {
          console.error(`🚨 Critical App Error: ${text}`);
        }
      });
      await use();
    },
    { auto: true },
  ],

  // PAGE OBJECT INJECTION: Lazy-loading instances for the spec files
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },

  signupPage: async ({ page }, use) => {
    const signupPage = new SignupPage(page);
    await use(signupPage);
  },
});

export { expect } from '@playwright/test';
