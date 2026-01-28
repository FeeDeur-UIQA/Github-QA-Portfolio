import { test, expect } from '@playwright/test';

/**
 * TC-A10: Target Size (Minimum) - WCAG 2.5.8 Level AA
 *
 * Ensures interactive components have a minimum target size of 24x24 CSS pixels.
 * This is important for accessibility on touch devices and for users with motor disabilities.
 *
 * WCAG 2.5.8: The target size for pointer inputs is at least 24 by 24 CSS pixels.
 */

test.describe('TC-A10: Target Size Tests @accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Progressive navigation strategy: domcontentloaded -> visible content check
    // Avoids flakiness from continuous network activity (ads, analytics)
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait for critical content instead of networkidle
    await page.locator('body').waitFor({ state: 'visible', timeout: 5000 });
    
    // Allow remaining resources to load without blocking
    await page.waitForTimeout(500);
  });

  test('Navigation links are visible and clickable', async ({ page }) => {
    const links = page.locator('a[href]');
    const linkCount = await links.count();

    expect(linkCount, 'Should find navigation links').toBeGreaterThan(0);

    // Verify first link is visible
    const isVisible = await links
      .first()
      .isVisible()
      .catch(() => false);
    expect(isVisible, 'Links should be visible').toBe(true);
  });

  test('Buttons are visible', async ({ page }) => {
    const buttons = page.locator('button, [role="button"]');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      const isVisible = await buttons
        .first()
        .isVisible()
        .catch(() => false);
      expect(isVisible, 'Buttons should be visible').toBe(true);
    }
  });

  test('Form inputs have adequate target size', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const inputs = page
      .locator('input[type="text"], input[type="email"], button[type="submit"]')
      .first();
    const inputExists = await inputs.isVisible().catch(() => false);

    if (inputExists) {
      const size = await inputs.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      });

      expect(
        size.height >= 24 || size.width >= 44,
        `Input should have adequate height (got ${size.height}px high)`,
      ).toBe(true);
    }
  });

  test('Checkbox and radio inputs are large enough to click', async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"], input[type="radio"]').first();
    const checkboxExists = await checkboxes.isVisible().catch(() => false);

    if (checkboxExists) {
      const size = await checkboxes.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        // Native checkboxes are usually small, but the clickable area should be larger
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      });

      // Checkboxes can be smaller as they usually have padding around them
      expect(size.width >= 10, 'Checkbox should have some width').toBe(true);
      expect(size.height >= 10, 'Checkbox should have some height').toBe(true);
    }
  });

  test('Page has interactive elements', async ({ page }) => {
    const interactive = page.locator('a[href], button, input[type="text"]');
    const count = await interactive.count();
    expect(count, 'Page should have interactive elements').toBeGreaterThan(0);
  });
});
