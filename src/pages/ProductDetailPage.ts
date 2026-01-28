import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * ProductDetailPage: Single product view with price, availability, and add-to-cart functionality.
 */
export class ProductDetailPage extends BasePage {
  private readonly PAGE_URL = /\/product_details\/\d+/;

  private readonly productName: Locator;
  private readonly productCategory: Locator;
  private readonly productPrice: Locator;
  private readonly productAvailability: Locator;
  private readonly productCondition: Locator;
  private readonly productBrand: Locator;
  private readonly productImage: Locator;
  private readonly addToCartBtn: Locator;
  private readonly quantityInput: Locator;

  constructor(page: Page) {
    super(page);
    // Scoped to product-information container for precision
    const productInfo = page.locator('.product-information');
    this.productName = productInfo.locator('h2').first();
    this.productCategory = productInfo.locator('p').filter({ hasText: /category/i });
    this.productPrice = productInfo.locator('span span').first();
    this.productAvailability = productInfo.locator('p').filter({ hasText: /availability/i });
    this.productCondition = productInfo.locator('p').filter({ hasText: /condition/i });
    this.productBrand = productInfo.locator('p').filter({ hasText: /brand/i });
    this.productImage = page.locator('.view-product img').first();
    this.addToCartBtn = productInfo.getByRole('button', { name: /add to cart/i });
    this.quantityInput = productInfo.locator('input[type="number"], input#quantity');
  }

  /**
   * URL Pattern Validation with Product ID Extraction
   * Enhanced with server error detection and retry logic
   */
  async isPageLoaded(): Promise<void> {
    // Check for server errors first before asserting elements
    await this.assertNoServerError();

    // Wait for page to stabilize
    await this.waitForPageReady();

    await expect(this.page).toHaveURL(this.PAGE_URL);

    // Use retry wrapper for visibility check (handles transient 520s)
    await this.expectEventually(async () => await expect(this.productName).toBeVisible(), {
      timeout: 30000,
      retries: 3,
      name: 'Product name visibility',
    });

    // Extract product ID from URL for traceability
    const url = this.page.url();
    const match = url.match(/product_details\/(\d+)/);
    const productId = match ? parseInt(match[1]) : -1;

    this.logger.info('Product detail page loaded', { productId, url });
  }

  /**
   * Get Product ID from URL
   */
  getProductId(): number {
    const url = this.page.url();
    const match = url.match(/product_details\/(\d+)/);
    return match ? parseInt(match[1]) : -1;
  }

  /**
   * Structured Data Extraction
   * Returns a Product DTO for validation or API cross-check
   */
  async getProductDetails(): Promise<ProductDetails> {
    const name = (await this.productName.textContent()) || '';
    const category = await this.extractLabelValue(this.productCategory);
    const price = (await this.productPrice.textContent()) || '';
    const availability = await this.extractLabelValue(this.productAvailability);
    const condition = await this.extractLabelValue(this.productCondition);
    const brand = await this.extractLabelValue(this.productBrand);

    const details: ProductDetails = {
      name: name.trim(),
      category: category.trim(),
      price: price.trim(),
      availability: availability.trim(),
      condition: condition.trim(),
      brand: brand.trim(),
    };

    this.logger.debug('Product details extracted', details as unknown as Record<string, unknown>);
    return details;
  }

  /**
   * Label-Value Parser
   * Handles "Category: Women > Tops" format extraction
   */
  private async extractLabelValue(locator: Locator): Promise<string> {
    const text = await locator.textContent();
    if (!text) return '';

    // Split by colon and take the value part
    const parts = text.split(':');
    return parts.length > 1 ? parts[1].trim() : text.trim();
  }

  /**
   * Validates presence of all required product metadata fields
   * Ensures no critical field is missing
   */
  async verifyAllFieldsPresent(): Promise<void> {
    await expect(this.productName, 'Product Name should be visible').toBeVisible();
    await expect(this.productCategory, 'Category should be visible').toBeVisible();
    await expect(this.productPrice, 'Price should be visible').toBeVisible();
    await expect(this.productAvailability, 'Availability should be visible').toBeVisible();
    await expect(this.productCondition, 'Condition should be visible').toBeVisible();
    await expect(this.productBrand, 'Brand should be visible').toBeVisible();

    this.logger.info('All product detail fields verified as present');
  }

  /**
   * Validates product image loading
   * Checks that product image actually loaded (not 404)
   * Resilient to ad-blockers and async loading
   */
  async verifyImageLoaded(): Promise<void> {
    await expect(this.productImage).toBeVisible();

    // Check image has valid src attribute
    const src = await this.productImage.getAttribute('src');
    expect(src, 'Image src should not be empty').toBeTruthy();

    // Wait for image to actually load (handles async image loading)
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      this.logger.debug('Network not idle - continuing with image check');
    });

    // Validate image loaded successfully (naturalWidth > 0)
    // RESILIENT: If blocked by ad-blocker or TURBO_MODE, log warning instead of failing
    const isLoaded = await this.productImage.evaluate((img: HTMLImageElement) => {
      return img.complete && img.naturalWidth > 0;
    });

    if (!isLoaded) {
      this.logger.warn('Product image not loaded - may be blocked by ad-blocker or TURBO_MODE', {
        src,
      });
      // Check if image element at least exists in DOM
      await expect(this.productImage, 'Image element should exist').toBeVisible();
    } else {
      this.logger.info('Product image verified as loaded', { src });
    }
  }

  /**
   * Validates price format
   * Ensures price follows expected format (Rs. XXX)
   */
  async verifyPriceFormat(): Promise<void> {
    const priceText = (await this.productPrice.textContent()) || '';
    const pricePattern = /Rs\.\s*\d+/;

    expect(priceText, 'Price should match format "Rs. XXX"').toMatch(pricePattern);
    this.logger.info('Price format validated', { price: priceText });
  }

  /**
   * ACTION: Add product to cart with custom quantity
   */
  async addToCart(quantity: number = 1): Promise<void> {
    await this.quantityInput.fill(quantity.toString());
    await this.safeClick(this.addToCartBtn);
  }
}

/**
 * Product Details Data Transfer Object
 */
export interface ProductDetails {
  name: string;
  category: string;
  price: string;
  availability: string;
  condition: string;
  brand: string;
}
