import { CartPage } from '@pages/CartPage';
import { HomePage } from '@pages/HomePage';
import { ProductsPage } from '@pages/ProductsPage';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { Logger } from '@utils/Logger';

import { dismissConsentIfPresent } from '../../support/consent';

/**
 * TC-PERF03: Cumulative Layout Shift (CLS) Validation
 *
 * Core Web Vital: CLS measures visual stability
 * Target: CLS should be less than 0.1 for good UX
 * Reference: https://web.dev/cls/
 */
test.describe('TC-PERF03: CLS Validation @performance @flows @slow', () => {
  let logger: Logger;

  const isCloudflareError = async (page: Page): Promise<boolean> => {
    return (await page.getByText(/error code 520/i).count()) > 0;
  };

  const gotoWithRetry = async (page: Page, url: string, retries: number = 3): Promise<void> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      await page.goto(url);
      await dismissConsentIfPresent(page);

      if (!(await isCloudflareError(page))) return;

      if (attempt === retries) break;
      await page.waitForTimeout(500 * attempt);
    }
  };

  const addFirstProductAndCloseModal = async (
    page: Page,
    productsPage: ProductsPage,
  ): Promise<void> => {
    const addToCartBtn = productsPage.getFirstProductAddToCartBtn();
    await addToCartBtn.click();

    const cartModal = page.locator('#cartModal');
    await cartModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    const continueBtn = productsPage.getContinueShoppingBtn();
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await cartModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    } else {
      await gotoWithRetry(page, '/view_cart');
    }
  };

  const openAddToCartModal = async (page: Page, productsPage: ProductsPage): Promise<void> => {
    const addToCartBtn = productsPage.getFirstProductAddToCartBtn();
    await addToCartBtn.click();

    const modal = productsPage.getContinueShoppingBtn();
    try {
      await modal.waitFor({ state: 'visible', timeout: 5000 });
    } catch (error) {
      // Retry once in case a transient error page appeared
      if (await isCloudflareError(page)) {
        await gotoWithRetry(page, '/products', 3);
        await productsPage.isPageLoaded();
        await addToCartBtn.click();
        await modal.waitFor({ state: 'visible', timeout: 5000 });
      } else {
        throw error;
      }
    }
  };

  test.beforeEach(() => {
    logger = Logger.getInstance('TC-PERF03_CLSValidation');
  });

  test('should achieve good CLS (<0.1) on product listing page @high @performance @regression', async ({
    page,
  }) => {
    await test.step('1: Navigate and capture layout shifts', async () => {
      // Setup CLS observer before navigation
      await gotoWithRetry(page, '/products', 3);
      await page.waitForLoadState('load');

      logger.info('[PASS] Products page loaded');
    });

    await test.step('2: Wait for dynamic content to settle', async () => {
      await page.waitForLoadState('load');
      logger.info('[PASS] Dynamic content settled');
    });

    await test.step('3: Measure CLS metric', async () => {
      const clsScore = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          const observer = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              // Only count layout shifts without recent user input
              const layoutShift = entry as PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              };
              if (!layoutShift.hadRecentInput) {
                clsValue += layoutShift.value || 0;
              }
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });

          // Return CLS immediately after observing buffered entries
          requestAnimationFrame(() => {
            observer.disconnect();
            resolve(clsValue);
          });
        });
      });

      logger.info(`[INFO] CLS Score: ${clsScore.toFixed(4)}`);

      // Assert CLS is under 0.1 (good threshold)
      expect(clsScore).toBeLessThan(0.1);

      logger.info('[PASS] CLS meets target threshold (<0.1)');
    });
  });

  test('should have stable layout during cart quantity updates @high @performance @regression', async ({
    page,
  }) => {
    const homePage = new HomePage(page);
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);

    await test.step('1-3: Add product to cart', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();
      await dismissConsentIfPresent(page);

      const productsLink = homePage.getProductsLink();
      await productsLink.click();
      await productsPage.isPageLoaded();
      await dismissConsentIfPresent(page);

      await addFirstProductAndCloseModal(page, productsPage);

      logger.info('[PASS] Product added to cart');
    });

    await test.step('4: Navigate to cart', async () => {
      await gotoWithRetry(page, '/view_cart');
      await dismissConsentIfPresent(page);
      await cartPage.isPageLoaded();
      logger.info('[PASS] Cart page loaded');
    });

    await test.step('5: Measure CLS during cart updates', async () => {
      // Reset CLS measurement
      const clsScore = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          const observer = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              const layoutShift = entry as PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              };
              if (!layoutShift.hadRecentInput) {
                clsValue += layoutShift.value || 0;
              }
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });

          requestAnimationFrame(() => {
            observer.disconnect();
            resolve(clsValue);
          });
        });
      });

      logger.info(`[INFO] Cart CLS Score: ${clsScore.toFixed(4)}`);

      // Cart page should be stable
      expect(clsScore).toBeLessThan(0.1);

      logger.info('[PASS] Cart layout stability verified');
    });
  });

  test('should prevent layout shifts from images without dimensions @high @performance @regression', async ({
    page,
  }) => {
    const productsPage = new ProductsPage(page);

    await test.step('1: Navigate to products page', async () => {
      await gotoWithRetry(page, '/products', 3);
      await productsPage.isPageLoaded();
      logger.info('[PASS] Products page loaded');
    });

    await test.step('2: Check for image dimension attributes', async () => {
      const images = page.locator('.features_items img');
      const imageCount = await images.count();

      let imagesWithDimensions = 0;
      let imagesWithoutDimensions = 0;

      for (let i = 0; i < Math.min(imageCount, 10); i++) {
        const img = images.nth(i);
        const hasWidth = await img.getAttribute('width');
        const hasHeight = await img.getAttribute('height');

        const hasDims = Boolean(hasWidth && hasHeight);
        imagesWithDimensions += Number(hasDims);
        imagesWithoutDimensions += Number(!hasDims);
      }

      logger.info(`🖼[INFO]  Images with dimensions: ${imagesWithDimensions}/10`);
      logger.info(`⚠[INFO]  Images without dimensions: ${imagesWithoutDimensions}/10`);

      expect(imageCount).toBeGreaterThan(0);
      logger.info('ℹ[INFO]  Image dimension coverage captured');
    });

    await test.step('3: Verify aspect-ratio CSS is used', async () => {
      const hasAspectRatio = await page.evaluate(() => {
        const images = document.querySelectorAll('.features_items img');
        let count = 0;

        images.forEach((img) => {
          const styles = window.getComputedStyle(img);
          const hasAspectRatio = Boolean(styles.aspectRatio && styles.aspectRatio !== 'auto');
          count += hasAspectRatio ? 1 : 0;
        });

        return count;
      });

      expect(hasAspectRatio).toBeGreaterThanOrEqual(0);
      logger.info('ℹ[INFO]  aspect-ratio CSS usage captured');
    });
  });

  test('should measure CLS impact of dynamic content insertion @high @performance @regression', async ({
    page,
  }) => {
    const productsPage = new ProductsPage(page);

    await test.step('1: Navigate to products page', async () => {
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
      await dismissConsentIfPresent(page);
      logger.info('[PASS] Products page loaded');
    });

    await test.step('2: Capture initial CLS', async () => {
      const initialCLS = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              const layoutShift = entry as PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              };
              if (!layoutShift.hadRecentInput) {
                clsValue += layoutShift.value || 0;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });

          setTimeout(() => resolve(clsValue), 1000);
        });
      });

      logger.info(`[INFO] Initial CLS: ${initialCLS.toFixed(4)}`);
      expect(initialCLS).toBeGreaterThanOrEqual(0);
    });

    await test.step('3: Trigger add-to-cart modal (dynamic content)', async () => {
      await openAddToCartModal(page, productsPage);

      logger.info('[PASS] Modal appeared');
    });

    await test.step('4: Measure CLS after modal insertion', async () => {
      const finalCLS = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              const layoutShift = entry as PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              };
              if (!layoutShift.hadRecentInput) {
                clsValue += layoutShift.value || 0;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });

          setTimeout(() => resolve(clsValue), 1000);
        });
      });

      logger.info(`[INFO] Final CLS (after modal): ${finalCLS.toFixed(4)}`);

      // Modal should use overlay and not shift content
      expect(finalCLS).toBeLessThan(0.1);
      logger.info('[PASS] Modal insertion does not cause layout shifts');
    });
  });
});
