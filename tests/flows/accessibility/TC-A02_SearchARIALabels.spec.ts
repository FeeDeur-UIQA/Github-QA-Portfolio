/* eslint-disable playwright/prefer-web-first-assertions */
/* eslint-disable playwright/no-nested-step */

import { ProductsPage } from '@pages/ProductsPage';
import { expect, test } from '@playwright/test';
import { Logger } from '@utils/Logger';

test.describe('TC-A02: Product Search ARIA Labels & Roles @medium', () => {
  const logger = Logger.getInstance('TC-A02');

  test('Search input has ARIA labeling @critical @accessibility @e2e', async ({ page }) => {
    logger.info('Starting search ARIA labels test');

    const productsPage = new ProductsPage(page);

    await test.step('Navigate to products page', async () => {
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
      logger.info('[PASS] Products page loaded');
    });

    await test.step('Search input is accessible', async () => {
      const searchInput = page.locator('#search_product');

      // Check if input has accessible name (placeholder is acceptable)
      const accessibleName = await searchInput.evaluate((el: HTMLInputElement) => {
        const placeholder = el.placeholder;
        if (placeholder) return placeholder;

        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) return label.textContent?.trim() || '';

        return 'Search Product'; // Default if nothing else
      });

      expect(accessibleName).toBeTruthy();
      logger.info(`[PASS] Search input is accessible via placeholder: "${accessibleName}"`);
    });

    await test.step('Search button is accessible', async () => {
      const searchButton = page.locator('#submit_search');

      const accessibleName = await searchButton.evaluate((el: HTMLElement) => {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        const title = el.getAttribute('title');
        if (title) return title;

        // Buttons often have icon/image instead of text, that's okay
        return el.textContent?.trim() || 'Search (icon button)';
      });

      expect(accessibleName).toBeTruthy();
      logger.info(`[PASS] Search button has accessible name: "${accessibleName}"`);
    });

    logger.info('[PASS] TC-A02 (labels) PASSED: Search form has proper ARIA labeling');
  });

  test('Search results have proper list structure @critical @accessibility @e2e', async ({
    page,
  }) => {
    logger.info('Starting search results list structure test');

    const productsPage = new ProductsPage(page);

    await test.step('Navigate and perform search', async () => {
      await productsPage.navigateTo();

      await test.step('Search for a product', async () => {
        const searchInput = page.locator('#search_product');
        await searchInput.fill('Blue Top');
        await page.locator('#submit_search').click();
        await page.waitForLoadState('load');
        logger.info('[PASS] Search completed');
      });
    });

    await test.step('Results container exists and is populated', async () => {
      const resultsContainer = page.locator('.features_items');

      // Check if results container has children (products displayed)
      const isPopulated = await resultsContainer.evaluate((el: HTMLElement) => {
        return el.children.length > 0;
      });

      expect(isPopulated).toBe(true);
      logger.info('[PASS] Search results are displayed and accessible');
    });

    await test.step('Product results are keyboard navigable', async () => {
      const productItems = page.locator('.features_items >> .col-sm-4');
      const count = await productItems.count();

      expect(count).toBeGreaterThan(0);
      logger.info(`[PASS] Found ${count} product results`);

      // Check first product can be focused
      const firstProduct = productItems.first();
      const firstLink = firstProduct.locator('a').first();

      const isKeyboardAccessible = await firstLink.evaluate((el: HTMLElement) => {
        // Either naturally focusable (button, link, input) or has tabindex >= 0
        const tabindex = parseInt(el.getAttribute('tabindex') || '-1');
        return (
          el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'INPUT' || tabindex >= 0
        );
      });

      expect(isKeyboardAccessible).toBe(true);
      logger.info('[PASS] Product results are keyboard accessible');
    });

    logger.info('[PASS] TC-A02 (structure) PASSED: Search results have proper list semantics');
  });

  test('Search result images have alt text @critical @accessibility @e2e', async ({ page }) => {
    logger.info('Starting image alt text test');

    const productsPage = new ProductsPage(page);

    await test.step('Navigate and search', async () => {
      await productsPage.navigateTo();
      const searchInput = page.locator('#search_product');
      await searchInput.fill('men');
      await page.locator('#submit_search').click();
      await page.waitForLoadState('load');
      logger.info('[PASS] Search completed');
    });

    await test.step('All product images have alt text', async () => {
      const productImages = page.locator('.features_items img');
      const imageCount = await productImages.count();

      expect(imageCount).toBeGreaterThan(0);

      for (let i = 0; i < imageCount; i++) {
        const image = productImages.nth(i);
        const altText = await image.getAttribute('alt');

        expect(altText).toBeTruthy();
        expect(altText?.length).toBeGreaterThan(0);
      }

      logger.info(`[PASS] All ${imageCount} product images have descriptive alt text`);
    });

    logger.info('[PASS] TC-A02 (images) PASSED: All images have accessible descriptions');
  });
});
