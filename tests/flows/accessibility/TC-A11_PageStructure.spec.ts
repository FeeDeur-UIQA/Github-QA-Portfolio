import { test, expect } from '@playwright/test';

/**
 * TC-A11: Page Structure and Semantics - WCAG 1.3.1 Level A
 *
 * Verifies that page uses proper semantic HTML structure (headings, landmarks, lists).
 * This enables screen readers and assistive tech to navigate content properly.
 */

test.describe('TC-A11: Page Structure Tests @accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Page uses semantic heading structure', async ({ page }) => {
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();

    // Page should have at least one heading
    expect(headingCount, 'Page should have heading elements').toBeGreaterThan(0);

    if (headingCount > 0) {
      const firstHeading = await headings.first().textContent();
      expect(firstHeading?.trim().length, 'Headings should have text content').toBeGreaterThan(0);
    }
  });

  test('Page has navigational landmarks', async ({ page }) => {
    const landmarks = page.locator(
      'header, nav, [role="navigation"], main, [role="main"], footer, [role="contentinfo"]',
    );
    const landmarkCount = await landmarks.count();

    // Page should have structural landmarks
    expect(landmarkCount, 'Page should have semantic landmark elements').toBeGreaterThan(0);
  });

  test('Page navigation is accessible', async ({ page }) => {
    const navLinks = page.locator('nav a, header a, [role="navigation"] a');
    const navLinkCount = await navLinks.count();

    expect(navLinkCount, 'Page should have navigation links').toBeGreaterThan(0);
  });

  test('Content uses lists appropriately', async ({ page }) => {
    // Check if page properly uses list elements
    const lists = page.locator('ul, ol, [role="list"]');
    const listCount = await lists.count();

    // Many pages will have lists (nav, products, etc)
    if (listCount > 0) {
      const firstList = lists.first();
      const items = firstList.locator('li, [role="listitem"]');
      const itemCount = await items.count();
      expect(itemCount, 'Lists should have list items').toBeGreaterThan(0);
    }
  });

  test('Images have accessible descriptions', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();

    if (imageCount > 0) {
      // Check first few images
      let hasAccessibleImages = false;

      for (let i = 0; i < Math.min(imageCount, 5); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const title = await img.getAttribute('title');

        if (alt || title) {
          hasAccessibleImages = true;
          break;
        }
      }

      // At least some images should have alt text
      expect(
        hasAccessibleImages || imageCount === 0,
        'Images should have alt text or title attributes',
      ).toBe(true);
    }
  });
});
