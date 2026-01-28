/**
 * Visual Regression Test Fixtures
 *
 * Custom Playwright fixtures for visual regression testing with:
 * - Automatic page stabilization
 * - Dynamic content masking
 * - Screenshot utilities
 * - Stability metadata tracking (external JSON-based)
 * - Automated monitoring and alerts
 *
 * @usage
 * import { test, expect } from '../fixtures/visual.fixtures';
 *
 * test('visual test', async ({ stabilizedPage }) => {
 *   await stabilizedPage.goto('/');
 *   await expect(stabilizedPage).toHaveScreenshot();
 * });
 */

import * as fs from 'fs';

import * as path from 'path';

import { test as base, expect } from '@playwright/test';
import type { PageAssertionsToHaveScreenshotOptions, Page } from '@playwright/test';

import { stabilizePage, hideDynamicElements } from '../src/utils/PageStabilization';

// Load stability metadata from external file
let stabilityMetadata: any = null;
function getStabilityMetadata() {
  if (!stabilityMetadata) {
    try {
      const metadataPath = path.join(process.cwd(), 'test-stability.json');
      if (fs.existsSync(metadataPath)) {
        stabilityMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      }
    } catch (error) {
      console.warn('Failed to load test-stability.json:', error);
      stabilityMetadata = { tests: {} };
    }
  }
  return stabilityMetadata;
}

function getTestStability(testPath: string, testName: string, projectName: string) {
  const metadata = getStabilityMetadata();

  // Try to match test by path and name
  for (const [testId, data] of Object.entries(metadata.tests || {})) {
    const testData = data as any;
    if (testData.testPath?.includes(testPath) || testData.testName?.includes(testName)) {
      // Check if there are browser/device specific issues
      const relevantIssues = testData.historicalIssues?.filter(
        (issue: any) => projectName.includes(issue.browser) || projectName.includes(issue.device),
      );

      return {
        testId,
        ...testData,
        relevantIssues: relevantIssues || [],
        hasHistoricalIssues: relevantIssues?.length > 0,
      };
    }
  }

  return null;
}

// Common dynamic selectors that change and cause false positives
const DEFAULT_MASK_SELECTORS = [
  '[class*="timestamp"]',
  '[class*="time-stamp"]',
  '[class*="date-time"]',
  '[id*="timestamp"]',
  '[data-testid*="timestamp"]',
  '.advertisement',
  '.ad-banner',
  '[class*="ad-"]',
  '[class*="ticker"]',
  '[class*="live-update"]',
  'iframe[src*="ads"]',
  'iframe[src*="doubleclick"]',
];

interface VisualFixtures {
  /**
   * Page with automatic stabilization applied
   * Waits for fonts, images, animations, and network idle
   */
  stabilizedPage: Page;

  /**
   * Default mask selectors for dynamic content
   * Can be customized per test
   */
  maskSelectors: string[];

  /**
   * Helper to take stabilized screenshot with masking
   */
  takeStableScreenshot: (page: Page, name: string, options?: any) => Promise<void>;
}

export const test = base.extend<VisualFixtures>({
  maskSelectors: DEFAULT_MASK_SELECTORS,

  stabilizedPage: async ({ page, maskSelectors }, use, testInfo) => {
    // Check stability metadata
    const testPath = testInfo.file.split('/').slice(-3).join('/');
    const testName = testInfo.title;
    const projectName = testInfo.project.name;

    const stabilityInfo = getTestStability(testPath, testName, projectName);

    // Add annotations for visibility
    if (stabilityInfo) {
      if (stabilityInfo.currentStatus === 'monitoring') {
        testInfo.annotations.push({
          type: '🔍 stability-monitoring',
          description: `Passes: ${stabilityInfo.consecutivePasses}/${stabilityInfo.autoRemoveMonitoringAfter} until auto-removal`,
        });
      }

      if (stabilityInfo.hasHistoricalIssues) {
        const issuesSummary = stabilityInfo.relevantIssues
          .map((i: any) => `${i.issue} (fixed: ${i.fix})`)
          .join('; ');

        testInfo.annotations.push({
          type: '📊 historical-flakiness',
          description: issuesSummary,
        });
      }

      if (stabilityInfo.stabilityScore >= 1.0 && stabilityInfo.consecutivePasses >= 30) {
        testInfo.annotations.push({
          type: '✅ fully-stable',
          description: `Score: ${stabilityInfo.stabilityScore} | Monitoring can be removed`,
        });
      }
    }

    // Override goto to add optional stabilization
    const originalGoto = page.goto.bind(page);
    page.goto = async (url: string, options?: any) => {
      // Use longer timeout for visual tests - webkit needs time to render
      const gotoOptions: any = {
        referer: options?.referer,
        timeout: options?.timeout ?? 15000, // Increased from 8s for webkit stability
        waitUntil: options?.waitUntil ?? 'load', // Changed from 'domcontentloaded' for full page load
      };

      const response = await originalGoto(url, gotoOptions);

      // Stabilize page after navigation - allow enough time for mobile browsers
      // Add extra buffer for tests under monitoring
      const extraStabilization = stabilityInfo?.currentStatus === 'monitoring' ? 500 : 0;

      try {
        await Promise.race([
          stabilizePage(page, {
            waitForFonts: true,
            waitForImages: true,
            waitForAnimations: true,
            waitForNetwork: true,
            networkIdleTimeout: 300 + extraStabilization,
            animationTimeout: 200,
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Stabilization timeout')),
              10000 + extraStabilization,
            ),
          ),
        ]);
      } catch (error) {
        console.warn(
          `Page stabilization partial: ${error instanceof Error ? error.message : 'unknown'}, continuing...`,
        );
        // Give one more brief moment for stragglers
        await page.waitForTimeout(500);
      }

      // Hide dynamic elements - wrap in try-catch
      try {
        await hideDynamicElements(page, maskSelectors);
      } catch (error) {
        console.warn(
          `Dynamic element hiding failed: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }

      return response;
    };

    await use(page);
  },

  takeStableScreenshot: async ({ maskSelectors }, use) => {
    const takeScreenshot = async (
      pageTouse: Page,
      name: string,
      options: PageAssertionsToHaveScreenshotOptions = {},
    ) => {
      // Ensure page is stable
      await stabilizePage(pageTouse);
      await hideDynamicElements(pageTouse, maskSelectors);

      // Default screenshot options
      const defaultOptions: PageAssertionsToHaveScreenshotOptions = {
        animations: 'disabled',
        maxDiffPixelRatio: 0.1,
        mask: [], // Will be populated below
      };

      // Convert mask selectors to locators
      const maskLocators = maskSelectors
        .map((selector) => {
          try {
            return pageTouse.locator(selector).first();
          } catch {
            return null;
          }
        })
        .filter((locator): locator is ReturnType<Page['locator']> => Boolean(locator));

      const mergedOptions: PageAssertionsToHaveScreenshotOptions = {
        ...defaultOptions,
        ...(options ?? {}),
        mask: [...(options?.mask ?? []), ...maskLocators],
      };

      await expect(pageTouse).toHaveScreenshot(name, mergedOptions);
    };

    await use(takeScreenshot);
  },
});

export { expect };
