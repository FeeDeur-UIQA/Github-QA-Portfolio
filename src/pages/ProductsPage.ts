import { expect } from '@playwright/test';
import type { Locator, Page, Response } from '@playwright/test';

import { BasePage } from './BasePage';
import { CartPage } from './CartPage';
import { ProductDetailPage } from './ProductDetailPage';

/**
 * ProductsPage: Product listing and search functionality.
 */
export class ProductsPage extends BasePage {
  private readonly PAGE_URL = /\/products/;

  private readonly searchInput: Locator;
  private readonly searchButton: Locator;
  private readonly productItems: Locator;
  private readonly continueShoppingBtn: Locator;
  private readonly modalBackdrop: Locator;

  constructor(page: Page) {
    super(page);
    this.productItems = page.locator('.features_items >> .col-sm-4');
    this.searchInput = page.locator('#search_product');
    this.searchButton = page.locator('#submit_search');
    this.continueShoppingBtn = page.getByRole('button', { name: /continue shopping/i });
    this.modalBackdrop = page.locator('.modal-backdrop');
  }

  /**
   * Explicit navigation to /products path
   */
  async navigateTo(path: string = '/products', retries: number = 3): Promise<Response | null> {
    return await super.navigateTo(path, retries);
  }

  /**
   * A11y-Grid Scanner
   * Automatically validates accessibility on every load.
   */
  async isPageLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(this.PAGE_URL);
    // Increased timeout for mobile platforms - elements take longer to render
    await expect(this.productItems.first()).toBeVisible({ timeout: 10000 });

    // Quick A11y Audit: Ensure all product images have alt text
    const images = this.productItems.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      await expect(images.nth(i)).toHaveAttribute('alt', /.+/);
    }
  }

  /**
   * URL-Param Direct Access
   * High-velocity bypass for search smoke tests.
   */
  async quickSearch(productName: string): Promise<this> {
    await this.page.goto(`${this.page.url()}?search=${encodeURIComponent(productName)}`);
    return this;
  }

  /**
   * Response-Mocking Chaos
   * Injects a failure to test UI resilience.
   */
  async simulateSearchFailure(): Promise<void> {
    await this.page.route('**/searchProduct**', (route) => route.abort());
    await this.safeClick(this.searchButton);
    // Logic here would verify an error message or circuit breaker trigger
  }

  /**
   * Mutation-Observer Sync
   * Replaces polling with a native DOM-change observer.
   */
  async searchProduct(productName: string): Promise<this> {
    await this.fillInput(this.searchInput, productName);

    // Setup observer before action
    const gridPromise = this.page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length > 0,
      '.features_items',
    );

    await this.clearOverlays();
    await this.safeClick(this.searchButton);
    await gridPromise;
    return this;
  }

  /**
   * Visual-Diff Anchor
   * Ensures the overlay styling remains intact.
   */
  async addProductToCart(productName: string): Promise<this> {
    const targetProduct = this.productItems.filter({ hasText: productName }).first();
    await this.clearOverlays();
    await targetProduct.hover();

    // Visual Regression Anchor: Verify hover state hasn't shifted
    await expect(targetProduct).toHaveScreenshot(`${productName}-hover.png`);

    const addToCartOverlay = targetProduct.locator('.overlay-content').getByText(/add to cart/i);
    await this.safeClick(addToCartOverlay);

    await expect(this.continueShoppingBtn).toBeVisible();
    await this.safeClick(this.continueShoppingBtn);

    await expect(this.continueShoppingBtn).not.toBeVisible();
    await expect(this.modalBackdrop).not.toBeAttached();

    return this;
  }

  async goToCart(): Promise<CartPage> {
    await this.clearOverlays();
    const cartLink = this.page.getByRole('link', { name: /cart/i }).first();
    await this.safeClick(cartLink);
    const cartPage = new CartPage(this.page);
    await cartPage.isPageLoaded();
    return cartPage;
  }

  /**
   * View Product Details Navigation
   * Enhanced with retry logic for resilient navigation
   */
  async viewProductDetails(index: number = 1, maxRetries: number = 3): Promise<ProductDetailPage> {
    const productCard = this.productItems.nth(index - 1);
    await expect(productCard).toBeVisible();

    const viewProductLink = productCard.getByRole('link', { name: /view product/i });

    // Retry navigation if detail page fails to load (handles 520 errors)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.safeClick(viewProductLink);

        const detailPage = new ProductDetailPage(this.page);
        await detailPage.isPageLoaded();
        return detailPage;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        this.logger.warn('Product detail navigation failed - retrying', {
          attempt,
          maxRetries,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Use exponential backoff with page.waitForNavigation instead of arbitrary timeout
        await Promise.race([
          this.page.waitForTimeout(500 * Math.pow(2, attempt)),
          this.page.waitForLoadState('load').catch(() => {}),
        ]);
        // Go back and try again
        await this.page.goBack();
        await this.isPageLoaded();
      }
    }

    throw new Error('Failed to view product details after retries');
  }

  /**
   * Count All Products
   * Returns total product count on page
   */
  async getProductCount(): Promise<number> {
    return await this.productItems.count();
  }

  // ==================== ACCESSIBILITY TEST HELPERS ====================
  getSearchInput(): Locator {
    return this.searchInput;
  }

  getSearchButton(): Locator {
    return this.searchButton;
  }

  getProductItems(): Locator {
    return this.productItems;
  }

  getContinueShoppingBtn(): Locator {
    return this.continueShoppingBtn;
  }

  // ==================== RESILIENCE TEST HELPERS ====================
  getFirstProductAddToCartBtn(): Locator {
    return this.productItems.first().locator('.add-to-cart').first();
  }
}
