import { expect, test } from '../../../fixtures/visual.fixtures';

import { getMaskSelectorsForPage } from '../../../src/utils/visual-mask-config';
import { dismissConsentIfPresent } from '../../support/consent';
import { skipIfCloudflareError } from '../../support/siteHealth';
import {
  freezeHomepageCarousel,
  stabilizeVisualLayout,
  suppressAdsAndThirdParty,
  waitForStableLayout,
} from '../../support/visual-stabilizers';

/**
 * TC-VIS01: Homepage Layout Visual Regression
 *
 * Validates homepage visual consistency across browsers and viewports
 * Catches CSS regressions, layout shifts, and responsive design issues
 *
 * @category Visual Regression
 * @priority Critical
 */

test.describe('TC-VIS01: Homepage Layout Visual Regression @slow', () => {
  test.beforeEach(async ({ stabilizedPage }) => {
    await stabilizedPage.goto('/');
    await skipIfCloudflareError(stabilizedPage);
    await dismissConsentIfPresent(stabilizedPage);
    await suppressAdsAndThirdParty(stabilizedPage);
    await stabilizeVisualLayout(stabilizedPage);
    await freezeHomepageCarousel(stabilizedPage);
    // Page auto-stabilizes with font, image, animation, and network idle waits
  });

  test('should match homepage baseline screenshot @critical @visual', async ({
    stabilizedPage,
    browserName,
  }) => {
    await test.step('Capture full page screenshot', async () => {
      // Get homepage-specific masks
      const maskSelectors = getMaskSelectorsForPage('homepage');
      const maskLocators = maskSelectors.map((s) => stabilizedPage.locator(s));
      await waitForStableLayout(stabilizedPage.locator('body'));

      // 2025 Hybrid Fix: Calculate stable content height to exclude variable footer ads
      const viewport = stabilizedPage.viewportSize();
      const stableHeight = await stabilizedPage.evaluate(() => {
        const footer = document.querySelector('footer');
        if (!footer) return 10000; // Fallback for full page

        // Capture up to footer start, excluding variable footer ad content
        const footerTop = footer.getBoundingClientRect().top + window.scrollY;
        return Math.min(footerTop, 15000); // Cap at reasonable max
      });

      const isMobile = viewport && viewport.width < 768;
      const width = viewport?.width ?? 1280;

      // Smart clipping: Use calculated stable height instead of fullPage for consistency
      const clipHeight = isMobile ? Math.min(stableHeight, 8000) : Math.min(stableHeight, 12000);

      const diffTolerance = isMobile ? 0.15 : browserName === 'chromium' ? 0.05 : 0.1;
      await expect(stabilizedPage).toHaveScreenshot(`homepage-${browserName}.png`, {
        maxDiffPixelRatio: diffTolerance,
        animations: 'disabled',
        fullPage: false, // Always use clipping for consistency
        clip: { x: 0, y: 0, width, height: clipHeight },
        mask: maskLocators,
      });
    });
  });

  test('should match hero section layout @visual', async ({ stabilizedPage, browserName }) => {
    await test.step('Capture hero section for carousel regression detection', async () => {
      const heroSection = stabilizedPage.locator('.carousel-inner').first();
      await expect(heroSection).toBeVisible();
      await waitForStableLayout(heroSection);

      if (process.env.VISUAL_DEMO === 'true') {
        // Intentional visual change to demo dashboard output
        await stabilizedPage.addStyleTag({
          content: '.carousel-inner { filter: invert(1) hue-rotate(180deg) saturate(2); }',
        });
      }

      // Verify actual rendered height before screenshot
      const actualHeight = await heroSection.evaluate((el) =>
        Math.round(el.getBoundingClientRect().height),
      );
      if (actualHeight < 430 || actualHeight > 452) {
        console.warn(`⚠️ Hero height ${actualHeight}px outside expected 441px ±11px range`);
      }

      await expect(heroSection).toHaveScreenshot(`hero-section-${browserName}.png`, {
        maxDiffPixelRatio: 0.05,
        animations: 'disabled',
      });
    });
  });
});
