import { test, expect, registerSmokeHooks } from './smoke-hooks';
import { SmokeMetricsAggregator } from './smoke.utils';

registerSmokeHooks();

/**
 * TC-20: Search Functionality Smoke Test
 * Purpose: Validate search - primary product discovery method
 * Duration: ~10 seconds
 *
 * @high @smoke @e2e @search
 */
test.describe('TC-20: Search Smoke Test', () => {
  test('Verify product search returns results @high @smoke @e2e @search', async ({
    page,
    homePage,
  }, testInfo) => {
    const startTime = Date.now();

    try {
      await test.step('1. Navigate to Products Page', async () => {
        await homePage.navigateTo();
        await homePage.navigateToProducts();
        await expect(page).toHaveURL(/.*\/products/, { timeout: 5000 });
        console.log('[PASS] Navigated to products page');
      });

      await test.step('2. Locate Search Input', async () => {
        // Wait for search input to be available
        const searchInput = page.locator('#search_product, input[name="search"]');
        await expect(searchInput.first()).toBeVisible({ timeout: 5000 });

        console.log('[PASS] Search input field located');
      });

      await test.step('3. Enter Search Query', async () => {
        const searchInput = page.locator('#search_product, input[name="search"]').first();
        await searchInput.fill('shirt');

        // Verify text was entered
        await expect(searchInput).toHaveValue('shirt');

        console.log('[PASS] Search query entered: "shirt"');
      });

      await test.step('4. Submit Search', async () => {
        // Find and click search button
        const searchButton = page.locator('#submit_search, button[type="submit"]').first();
        await searchButton.click();

        // Wait for search results to load
        await page.waitForLoadState('domcontentloaded');

        console.log('[PASS] Search submitted');
      });

      await test.step('5. Verify Search Results Display', async () => {
        // Wait for products container
        await expect(page.locator('.features_items')).toBeVisible({ timeout: 5000 });

        // Verify search results heading
        const heading = page.locator('.title, h2.title');
        await expect(heading.first()).toContainText(/searched products/i, { timeout: 3000 });

        // Count products in results
        const products = page.locator('.features_items .col-sm-4');
        const count = await products.count();

        expect(count, 'Search should return at least one product').toBeGreaterThan(0);

        console.log(`[PASS] Search returned ${count} product(s)`);
      });

      await test.step('6. Verify Search Result Contains Query Term', async () => {
        // Get first product name
        const firstProductName = page
          .locator('.features_items .col-sm-4')
          .first()
          .locator('.productinfo p, .product-information h2');

        await expect(firstProductName.first()).toBeVisible();

        const productText = await firstProductName.first().textContent();

        // Verify product name contains search term (case-insensitive)
        expect(productText?.toLowerCase(), 'Product should match search term').toContain('shirt');

        console.log(`[PASS] First result verified: "${productText}"`);
      });

      await test.step('7. Verify First Result is Clickable', async () => {
        const firstResult = page.locator('.features_items .col-sm-4').first();
        const viewProductLink = firstResult.getByRole('link', { name: /view product/i });

        await expect(viewProductLink, 'View Product link should be visible').toBeVisible();

        await viewProductLink.click();

        // Verify navigation to product detail page
        await expect(page).toHaveURL(/.*product_details/, { timeout: 5000 });

        console.log('[PASS] Navigated to product detail page from search results');
      });

      await test.step('8. Verify Product Detail Page Loads', async () => {
        // Verify product information section exists
        const productInfo = page.locator('.product-information, .product-details');
        await expect(productInfo.first()).toBeVisible({ timeout: 5000 });

        // Verify product name is displayed
        const productName = page.locator('.product-information h2, .product-details h2');
        await expect(productName.first()).toBeVisible();

        const name = await productName.first().textContent();
        console.log(`[PASS] Product detail page loaded for: "${name}"`);
      });

      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'passed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'search',
      });
    } catch (error) {
      SmokeMetricsAggregator.recordTest({
        testName: testInfo.title,
        status: 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        browser: testInfo.project.name,
        feature: 'search',
        errors: [String(error)],
      });
      throw error;
    }
  });
});
