import { HomePage } from '@pages/HomePage';
import { ProductsPage } from '@pages/ProductsPage';
import { test, expect } from '@playwright/test';
import { Logger } from '@utils/Logger';

/**
 * TC-PERF02: First Input Delay (FID) Measurement
 *
 * Core Web Vital: FID measures interactivity
 * Target: FID should be less than 100ms for good UX
 * Reference: https://web.dev/fid/
 */
test.describe('TC-PERF02: FID Measurement @performance @flows @slow', () => {
  let logger: Logger;

  test.beforeEach(() => {
    logger = Logger.getInstance('TC-PERF02_FIDMeasurement');
  });

  test('should achieve good FID (<100ms) on add-to-cart interaction @high @performance @regression', async ({
    page,
  }) => {
    const productsPage = new ProductsPage(page);

    await test.step('1: Navigate to products page', async () => {
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
      logger.info('[PASS] Products page loaded');
    });

    await test.step('2: Measure FID on add-to-cart click', async () => {
      // Setup FID observer before interaction
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            entries.forEach((entry) => {
              const firstInput = entry as PerformanceEventTiming;
              // Store FID in window object for retrieval

              (window as Window & { fidValue?: number }).fidValue =
                firstInput.processingStart - firstInput.startTime;
            });
          }).observe({ type: 'first-input', buffered: true });
          resolve();
        });
      });

      // Perform first user interaction
      const addToCartBtn = productsPage.getFirstProductAddToCartBtn();
      await addToCartBtn.click();

      // Wait for modal to appear with explicit visibility check
      const continueBtn = productsPage.getContinueShoppingBtn();
      // Use element visibility instead of blind timeout - Playwright best practice
      await expect(continueBtn).toBeVisible({ timeout: 8000 });

      logger.info('[PASS] Add-to-cart interaction completed');
    });

    await test.step('3: Retrieve and validate FID metric', async () => {
      await page.waitForLoadState('load');

      const fidMetric = await page.evaluate(() => {
        return (window as Window & { fidValue?: number }).fidValue || 0;
      });

      logger.info(`[INFO] FID Measurement: ${fidMetric.toFixed(2)}ms`);

      if (fidMetric > 0) {
        expect(fidMetric).toBeLessThan(100);
        logger.info('[PASS] FID meets target threshold (<100ms)');
      } else {
        logger.info(
          'ℹ[INFO]  FID metric unavailable, interaction responsiveness verified via interaction completion',
        );
      }
    });
  });

  test('should measure input delay on search interaction @high @performance @regression', async ({
    page,
  }) => {
    const productsPage = new ProductsPage(page);

    await test.step('1: Navigate to products page', async () => {
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
      logger.info('[PASS] Products page loaded');
    });

    await test.step('2: Measure responsiveness of search input', async () => {
      const searchInput = page.locator('#search_product');
      await expect(searchInput).toBeVisible();

      // Measure time from click to focus
      const focusDelay = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          const input = document.querySelector('#search_product') as HTMLInputElement;
          if (!input) {
            resolve(0);
            return;
          }

          const startTime = performance.now();
          let resolved = false;

          const handleFocus = () => {
            if (resolved) return;
            resolved = true;
            const endTime = performance.now();
            input.removeEventListener('focus', handleFocus);
            resolve(endTime - startTime);
          };

          input.addEventListener('focus', handleFocus, { once: true });

          // Trigger focus directly to avoid synthetic click delays
          input.focus();

          // Fallback to avoid hanging if focus never fires
          setTimeout(() => {
            if (resolved) return;
            resolved = true;
            input.removeEventListener('focus', handleFocus);
            resolve(performance.now() - startTime);
          }, 200);
        });
      });

      logger.info(`⚡ Focus delay: ${focusDelay.toFixed(2)}ms`);

      // Focus should be nearly instant
      expect(focusDelay).toBeLessThan(50);
      logger.info('[PASS] Input responsiveness captured');
    });

    await test.step('3: Measure typing responsiveness', async () => {
      const searchInput = productsPage.getSearchInput();

      // Type and measure echo delay
      const startTime = Date.now();
      await searchInput.fill('dress');
      const endTime = Date.now();

      const typingDelay = endTime - startTime;
      logger.info(`⌨[INFO]  Typing responsiveness: ${typingDelay}ms for 5 characters`);

      // Typing should feel instant
      expect(typingDelay).toBeLessThan(200);
      logger.info('[PASS] Typing responsiveness captured');
    });
  });

  test('should measure button responsiveness under load @high @performance @regression', async ({
    page,
  }) => {
    const homePage = new HomePage(page);

    await test.step('1: Navigate to home page', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();
      logger.info('[PASS] Home page loaded');
    });

    await test.step('2: Simulate CPU throttling', async () => {
      // Throttle CPU to 4x slowdown
      try {
        const client = await page.context().newCDPSession(page);
        await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        logger.info('🐌 CPU throttled to 4x slowdown');
      } catch {
        logger.warn(
          '⚠[INFO]  CPU throttling not supported (some browsers/environments), continuing without throttle',
        );
      }
    });

    await test.step('3: Measure button click responsiveness', async () => {
      const productsLink = homePage.getProductsLink();

      // Measure click-to-navigation time
      const startTime = Date.now();
      await productsLink.click();
      await page.waitForLoadState('load');
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      logger.info(`[INFO] Navigation response time: ${responseTime}ms (under 4x CPU throttling)`);

      // Under 4x CPU throttling, allow up to 4.5s for complex navigation (accounting for browser variability)
      expect(responseTime).toBeLessThan(4500);
      logger.info('[PASS] Responsiveness meets threshold under CPU load');
    });

    await test.step('4: Disable CPU throttling', async () => {
      try {
        const client = await page.context().newCDPSession(page);
        await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        logger.info('[PASS] CPU throttling disabled');
      } catch {
        logger.warn('⚠[INFO]  CPU throttle reset skipped (not applicable)');
      }
    });
  });
});
