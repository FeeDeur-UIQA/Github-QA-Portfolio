import { expect, test } from '../../../fixtures/visual.fixtures';

import { getMaskSelectorsForPage } from '../../../src/utils/visual-mask-config';
import { dismissConsentIfPresent } from '../../support/consent';
import { skipIfCloudflareError } from '../../support/siteHealth';
import {
  stabilizeVisualLayout,
  stabilizeProductGrid,
  suppressAdsAndThirdParty,
  waitForStableLayout,
} from '../../support/visual-stabilizers';

/**
 * TC-VIS02: Product Grid Visual Regression
 *
 * Validates product listing page visual consistency
 * Ensures product cards render correctly across browsers
 * Catches image loading issues and grid layout problems
 *
 * @category Visual Regression
 * @priority High
 */

test.describe('TC-VIS02: Product Grid Visual Regression @slow', () => {
  test.beforeEach(async ({ stabilizedPage }) => {
    await stabilizedPage.goto('/products');
    await skipIfCloudflareError(stabilizedPage);
    await dismissConsentIfPresent(stabilizedPage);
    await suppressAdsAndThirdParty(stabilizedPage);
    await stabilizeVisualLayout(stabilizedPage);
    await stabilizedPage.waitForLoadState('load');
  });

  test('should match products page baseline @visual', async ({ stabilizedPage, browserName }) => {
    await test.step('Capture full products page', async () => {
      const productContainer = stabilizedPage.locator('.features_items');
      const maskSelectors = getMaskSelectorsForPage('products');
      const maskLocators = maskSelectors.map((selector) => stabilizedPage.locator(selector));

      await expect(productContainer).toBeVisible();

      // 2025 Hybrid Fix: Pre-load and stabilize all product images
      await stabilizeProductGrid(stabilizedPage);

      await waitForStableLayout(productContainer);

      // 2025 Hybrid Fix: Use project name for reliable mobile detection
      const projectName = test.info().project.name;
      const isMobile = projectName.includes('mobile-'); // mobile-chrome, mobile-safari
      const diffTolerance = isMobile ? 0.25 : 0.1;

      await expect(productContainer).toHaveScreenshot(`products-page-${browserName}.png`, {
        maxDiffPixelRatio: diffTolerance,
        animations: 'disabled',
        mask: maskLocators,
      });
    });
  });

  test('should match product card layout @visual', async ({ stabilizedPage, browserName }) => {
    await test.step('Capture first product card for detail verification', async () => {
      const firstProduct = stabilizedPage.locator('.productinfo').first();
      await expect(firstProduct).toBeVisible();
      await waitForStableLayout(firstProduct);

      // Natural card dimensions catch real layout regressions
      await expect(firstProduct).toHaveScreenshot(`product-card-${browserName}.png`, {
        maxDiffPixelRatio: 0.15, // Allow slight variation for product images
      });
    });
  });
});
