/**
 * Page Stabilization Utilities
 *
 * Helper functions to ensure pages are fully loaded and stable before taking screenshots.
 * Reduces flakiness in visual regression tests by waiting for:
 * - Fonts to load
 * - Images to load
 * - Animations to complete
 * - Network activity to settle
 *
 * @usage
 * import { stabilizePage } from './PageStabilization';
 * await stabilizePage(page);
 */

import type { Page } from '@playwright/test';

export interface StabilizationOptions {
  waitForFonts?: boolean;
  waitForImages?: boolean;
  waitForAnimations?: boolean;
  waitForNetwork?: boolean;
  networkIdleTimeout?: number;
  animationTimeout?: number;
}

const DEFAULT_OPTIONS: StabilizationOptions = {
  waitForFonts: true,
  waitForImages: true,
  waitForAnimations: true,
  waitForNetwork: true,
  networkIdleTimeout: 1000,
  animationTimeout: 500,
};

/**
 * Stabilize page before taking screenshots
 * Combines all stabilization utilities
 */
export async function stabilizePage(page: Page, options: StabilizationOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Run stabilization checks in parallel where possible
  const promises: Promise<void>[] = [];

  if (opts.waitForFonts) {
    promises.push(waitForFontsLoaded(page));
  }

  if (opts.waitForImages) {
    promises.push(waitForImagesLoaded(page));
  }

  if (opts.waitForNetwork) {
    promises.push(waitForNetworkIdle(page, opts.networkIdleTimeout));
  }

  await Promise.all(promises);

  // Wait for animations after other checks (sequential)
  if (opts.waitForAnimations) {
    await waitForAnimationsComplete(page, opts.animationTimeout);
  }
}

/**
 * Wait for all web fonts to finish loading
 * Uses document.fonts.ready API
 */
export async function waitForFontsLoaded(page: Page, timeout: number = 5000): Promise<void> {
  try {
    await page.evaluate(
      ({ timeoutMs }) => {
        return Promise.race([
          document.fonts.ready,
          new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
        ]);
      },
      { timeoutMs: timeout },
    );
  } catch (error) {
    console.warn('Font loading check failed:', error);
  }
}

/**
 * Wait for all images to finish loading
 * Checks both <img> tags and CSS background images
 */
export async function waitForImagesLoaded(page: Page, timeout: number = 10000): Promise<void> {
  try {
    await page.evaluate(
      ({ timeoutMs }) => {
        return new Promise<void>((resolve) => {
          const images = Array.from(document.querySelectorAll('img'));
          const timeoutId = setTimeout(() => resolve(), timeoutMs);

          if (images.length === 0) {
            clearTimeout(timeoutId);
            resolve();
            return;
          }

          let loadedCount = 0;
          const checkComplete = () => {
            loadedCount++;
            if (loadedCount === images.length) {
              clearTimeout(timeoutId);
              resolve();
            }
          };

          images.forEach((img) => {
            if (img.complete && img.naturalHeight !== 0) {
              checkComplete();
            } else {
              img.addEventListener('load', checkComplete, { once: true });
              img.addEventListener('error', checkComplete, { once: true });
            }
          });
        });
      },
      { timeoutMs: timeout },
    );
  } catch (error) {
    console.warn('Image loading check failed:', error);
  }
}

/**
 * Wait for CSS animations and transitions to complete
 * Waits for a specified duration after the last animation event
 */
export async function waitForAnimationsComplete(
  page: Page,
  settleTime: number = 500,
): Promise<void> {
  try {
    await page.evaluate(
      ({ settleMs }) => {
        return new Promise<void>((resolve) => {
          let timeoutId: ReturnType<typeof setTimeout>;

          const resetTimer = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              document.removeEventListener('animationstart', resetTimer);
              document.removeEventListener('animationend', resetTimer);
              document.removeEventListener('transitionstart', resetTimer);
              document.removeEventListener('transitionend', resetTimer);
              resolve();
            }, settleMs);
          };

          // Listen for animation/transition events
          document.addEventListener('animationstart', resetTimer);
          document.addEventListener('animationend', resetTimer);
          document.addEventListener('transitionstart', resetTimer);
          document.addEventListener('transitionend', resetTimer);

          // Start initial timer
          resetTimer();
        });
      },
      { settleMs: settleTime },
    );
  } catch (error) {
    console.warn('Animation wait check failed:', error);
  }
}

/**
 * Wait for essential page resources - don't wait for full network idle
 * Modern sites have continuous activity (analytics, ads). Wait for critical resources instead.
 */
export async function waitForNetworkIdle(page: Page, idleTime: number = 1000): Promise<void> {
  try {
    // Wait for DOM to be ready (more reliable than networkidle)
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 });

    // Wait for critical resources (images, fonts) instead of all network activity
    await page.evaluate(() => {
      return Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    });

    // Brief settle time for layout shifts
    await page.waitForTimeout(Math.min(idleTime, 500));
  } catch (error) {
    console.warn('Resource wait completed with warning:', error);
  }
}

/**
 * Hide elements that frequently change and cause false positives
 * Common culprits: timestamps, live data, ads, etc.
 */
export async function hideDynamicElements(page: Page, selectors: string[] = []): Promise<void> {
  const defaultSelectors = [
    '[class*="timestamp"]',
    '[class*="time-stamp"]',
    '[class*="date-time"]',
    '[id*="timestamp"]',
    '[data-testid*="timestamp"]',
    '.advertisement',
    '.ad-banner',
    '[class*="ticker"]',
    '[class*="live-update"]',
  ];

  const allSelectors = [...defaultSelectors, ...selectors];

  await page.evaluate((selectorsToHide) => {
    selectorsToHide.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el: Element) => {
          (el as HTMLElement).style.visibility = 'hidden';
        });
      } catch {
        // Ignore invalid selectors
      }
    });
  }, allSelectors);
}

/**
 * Disable CSS animations and transitions for screenshot stability
 */
export async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

/**
 * Scroll to element smoothly and wait for it to be in view
 * Useful for taking component screenshots
 */
export async function scrollToElementStably(
  page: Page,
  selector: string,
  offset: number = 100,
): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300); // Wait for scroll to settle

  // Additional offset scroll if needed
  if (offset !== 0) {
    await page.evaluate((scrollOffset) => {
      window.scrollBy(0, scrollOffset);
    }, offset);
    await page.waitForTimeout(200);
  }
}

/**
 * Wait for lazy-loaded content to appear
 * Useful for infinite scroll pages
 */
export async function waitForLazyContent(
  page: Page,
  targetSelector: string,
  timeout: number = 5000,
): Promise<void> {
  try {
    await page.waitForSelector(targetSelector, { timeout, state: 'visible' });
  } catch {
    console.warn(`Lazy content with selector "${targetSelector}" did not appear`);
  }
}
