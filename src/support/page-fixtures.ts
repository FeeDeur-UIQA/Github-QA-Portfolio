import { test as base } from '@playwright/test';

import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';

/**
 * ARCHITECTURAL TYPE DEFINITION: High-Fidelity Test Context
 */
export type MyFixtures = {
  loginPage: LoginPage;
  homePage: HomePage;
  signupPage: SignupPage;
  consoleGuard: void;
};

export const test = base.extend<MyFixtures>({
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

    // Route handler for ads with proper error handling
    await page.route('**/*', async (route) => {
      try {
        const url = route.request().url();
        if (adPatterns.some((pattern) => url.includes(pattern))) {
          await route.abort('blockedbyclient');
        } else {
          await route.continue();
        }
      } catch {
        // If route already handled, silently continue
        if (!route.request().postDataBuffer) {
          await route.continue().catch(() => {
            // Route already consumed, ignore
          });
        }
      }
    });

    // 2. TURBO MODE: Hyper-Optimization for Headless CI Runs
    if (process.env.TURBO_MODE === 'true') {
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', async (route) => {
        try {
          const resourceType = route.request().resourceType();
          if (resourceType === 'image' || resourceType === 'font') {
            await route.abort('blockedbyclient');
          } else {
            await route.continue();
          }
        } catch {
          // Handle already-consumed routes gracefully
          if (!route.request().postDataBuffer) {
            await route.continue().catch(() => {
              // Route already consumed, ignore
            });
          }
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
    { scope: 'test' },
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
