import type { Page } from '@playwright/test';

import { expect, test } from '../../../fixtures/visual.fixtures';
import { dismissConsentIfPresent } from '../../support/consent';
import { gotoWithRetry, isCloudflareError } from '../../support/siteHealth';
import { waitForStableLayout } from '../../support/visual-stabilizers';

/**
 * TC-VIS03: Cart & Checkout Visual Regression
 *
 * Uses stabilizedPage fixture to block flaky diffs (fonts/images/animations) and masks ads/iframes.
 * Adds a cart item up front so all captures are in a consistent state.
 */

const maskDynamicRegions = (page: Page) => [
  page.locator('iframe'),
  page.locator('.advertisement, [class*="ad-"], ins'),
  page.getByRole('button', { name: /privacy and cookie settings/i }).first(),
];

const addFirstProductToCart = async (page: Page): Promise<void> => {
  const firstProduct = page.locator('.product-image-wrapper').first();
  await firstProduct.scrollIntoViewIfNeeded();
  await firstProduct.hover();

  const addToCart = firstProduct.getByText(/add to cart/i).first();
  await addToCart.click();

  const cartModal = page.locator('#cartModal');
  await cartModal.waitFor({ state: 'visible', timeout: 5000 }).catch(async () => {
    if (await isCloudflareError(page)) {
      await gotoWithRetry(page, '/products');
      await firstProduct.scrollIntoViewIfNeeded();
      await firstProduct.hover();
      await addToCart.click();
      await cartModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    }
  });

  // Poll-retry pattern for modal dismissal
  const continueBtn = page.getByRole('button', { name: /continue shopping/i }).first();
  if (await continueBtn.isVisible()) {
    // Try click with brief retries for ad overlays
    let clicked = false;
    for (let attempt = 0; attempt < 3 && !clicked; attempt++) {
      try {
        await continueBtn.click({ force: true, timeout: 3000 });
        clicked = true;
      } catch {
        await page.waitForTimeout(300);
      }
    }

    // Poll for modal to disappear with progressive fallbacks
    for (let check = 0; check < 20; check++) {
      if (!(await cartModal.isVisible({ timeout: 100 }))) break;

      if (check === 5) {
        // Fallback 1: ESC key
        await page.keyboard.press('Escape');
      } else if (check === 10) {
        // Fallback 2: direct style manipulation
        await page.evaluate(() => {
          const modal = document.querySelector('#cartModal');
          if (modal instanceof HTMLElement) {
            modal.style.display = 'none';
            modal.classList.remove('show');
          }
        });
      }
      await page.waitForTimeout(200);
    }
  }
};

test.describe('TC-VIS03: Cart & Checkout Visual Regression @slow', () => {
  test.beforeEach(async ({ stabilizedPage }) => {
    await gotoWithRetry(stabilizedPage, '/products', 3, dismissConsentIfPresent);
    await addFirstProductToCart(stabilizedPage);
  });

  test('should match cart page baseline @visual', async ({ stabilizedPage }) => {
    await gotoWithRetry(stabilizedPage, '/view_cart', 3, dismissConsentIfPresent);

    const cartContainer = stabilizedPage.locator('#cart_info');
    await expect(cartContainer).toBeVisible();
    await waitForStableLayout(cartContainer);
    await stabilizedPage.waitForTimeout(500); // Allow dynamic ads to settle on mobile webkit

    // Natural cart layout for authentic visual validation
    await expect(cartContainer).toHaveScreenshot('cart-page.png', {
      maxDiffPixelRatio: 0.12,
      animations: 'disabled',
      mask: maskDynamicRegions(stabilizedPage),
    });
  });

  test('should match empty cart state @visual', async ({ stabilizedPage }) => {
    await gotoWithRetry(stabilizedPage, '/view_cart');
    await dismissConsentIfPresent(stabilizedPage);

    const deleteBtn = stabilizedPage.locator('.cart_quantity_delete').first();
    await deleteBtn.click();
    await stabilizedPage.waitForLoadState('load');

    // Empty state is critical for UX validation
    const emptyState = stabilizedPage.locator('#empty_cart');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveScreenshot('cart-empty.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});
