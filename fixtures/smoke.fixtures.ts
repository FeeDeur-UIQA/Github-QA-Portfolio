import { test as base } from '@playwright/test';

/**
 * SMOKE TEST FIXTURES: Fast-Path Test Context
 *
 * Optimized for:
 * - Minimal setup (no unnecessary page objects)
 * - Fast execution (critical path only)
 * - Ad-blocking + turbo mode by default
 * - Metrics collection for SLOs
 * - Performance budget enforcement (Google/Stripe standard)
 */

/**
 * PERFORMANCE BUDGETS: Industry Standard Thresholds
 * Smoke tests MUST complete within these thresholds
 */
const SMOKE_PERFORMANCE_BUDGETS = {
  health: 8000, // 8s max - API checks + DOM validation
  auth: 18000, // 18s max - Full registration or login flow
  cart: 12000, // 12s max - Add to cart workflow
  search: 8000, // 8s max - Search + results validation
  default: 15000, // 15s max - General smoke test threshold
};

interface SmokeMetrics {
  testName: string;
  duration: number;
  passed: boolean;
  timestamp: string;
  budgetStatus?: 'within' | 'warning' | 'exceeded';
}

type SmokeFixtures = {
  smokeMetrics: SmokeMetrics[];
};

export const test = base.extend<SmokeFixtures>({
  /**
   * PAGE OVERRIDE: Lean Ad-Blocking for Smoke Tests
   */
  page: async ({ page }, use) => {
    // Minimal ad-blocking for smoke tests
    const adPatterns = ['googleads', 'g.doubleclick.net', 'google-analytics', 'adservice'];

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (adPatterns.some((pattern) => url.includes(pattern))) {
        void route.abort();
      } else {
        void route.continue();
      }
    });

    // TURBO_MODE enabled by default for smoke tests (via GitHub Actions)
    if (process.env.TURBO_MODE === 'true' || process.env.CI === 'true') {
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
   * METRICS COLLECTION: Track smoke test performance
   */
  smokeMetrics: async (_fixtures, use, testInfo) => {
    const metrics: SmokeMetrics[] = [];
    const startTime = Date.now();

    // Enforce performance budget based on test tags
    const testTitle = testInfo.title.toLowerCase();
    let budget = SMOKE_PERFORMANCE_BUDGETS.default;

    if (testTitle.includes('health') || testTitle.includes('tc-00')) {
      budget = SMOKE_PERFORMANCE_BUDGETS.health;
    } else if (
      testTitle.includes('auth') ||
      testTitle.includes('tc-01') ||
      testTitle.includes('tc-02')
    ) {
      budget = SMOKE_PERFORMANCE_BUDGETS.auth;
    } else if (testTitle.includes('cart') || testTitle.includes('tc-13')) {
      budget = SMOKE_PERFORMANCE_BUDGETS.cart;
    } else if (testTitle.includes('search') || testTitle.includes('tc-20')) {
      budget = SMOKE_PERFORMANCE_BUDGETS.search;
    }

    // Set timeout to budget + 10s grace period
    testInfo.setTimeout(budget + 10000);

    await use(metrics);

    // Post-test performance analysis
    const duration = Date.now() - startTime;
    const budgetUtilization = (duration / budget) * 100;

    if (budgetUtilization <= 80) {
      // within budget
    } else if (budgetUtilization <= 100) {
      console.warn(
        `⚠️ Performance Warning: ${testInfo.title} used ${budgetUtilization.toFixed(0)}% of budget (${duration}ms / ${budget}ms)`,
      );
    } else {
      console.error(
        `❌ Budget Exceeded: ${testInfo.title} took ${duration}ms (budget: ${budget}ms)`,
      );
    }

    // Post-suite reporting
    if (metrics.length > 0) {
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
      console.log(`📊 Smoke Suite: ${metrics.length} tests, avg ${avgDuration.toFixed(0)}ms`);
    }
  },
});

export { expect } from '@playwright/test';
