import { test, expect } from '@playwright/test';

import { evaluateElementContrast } from '../../src/utils/ContrastCalculator';

/**
 * Unit Tests for ContrastCalculator Utility
 *
 * Tests WCAG 2.2 contrast ratio calculations
 * Increases coverage for src/utils/ContrastCalculator.ts (currently 10.5%)
 *
 * Best Practice: Test accessibility utilities with known values
 */

test.describe('ContrastCalculator Unit Tests @fast @unit @a11y', () => {
  test.describe('Element Contrast Evaluation', () => {
    test('should calculate contrast for black text on white background', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: white; padding: 20px;">
          <p style="color: black; margin: 0;">High contrast text</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Black on white should have maximum contrast (21:1)
      expect(contrast).toBeGreaterThan(20);
      expect(contrast).toBeLessThanOrEqual(21);
    });

    test('should calculate contrast for white text on black background', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: black; padding: 20px;">
          <p style="color: white; margin: 0;">High contrast inverted</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // White on black should also be maximum contrast
      expect(contrast).toBeGreaterThan(20);
      expect(contrast).toBeLessThanOrEqual(21);
    });

    test('should calculate contrast for gray text on white background', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: white; padding: 20px;">
          <p style="color: rgb(118, 118, 118); margin: 0;">Medium contrast</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Gray on white should have medium contrast (around 3.5-4.5:1)
      expect(contrast).toBeGreaterThan(3);
      expect(contrast).toBeLessThan(6);
    });

    test('should calculate contrast for light gray on white (low contrast)', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: white; padding: 20px;">
          <p style="color: rgb(200, 200, 200); margin: 0;">Low contrast</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Light gray on white should have low contrast (< 3:1)
      expect(contrast).toBeGreaterThan(1);
      expect(contrast).toBeLessThan(3);
    });
  });

  test.describe('WCAG Compliance Validation', () => {
    test('should meet WCAG AA for normal text (4.5:1 minimum)', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: white; padding: 20px;">
          <p style="color: rgb(88, 88, 88); margin: 0;">WCAG AA compliant</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Should meet WCAG AA minimum (4.5:1)
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    test('should meet WCAG AAA for normal text (7:1 minimum)', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: white; padding: 20px;">
          <p style="color: rgb(50, 50, 50); margin: 0;">WCAG AAA compliant</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Should meet WCAG AAA minimum (7:1)
      expect(contrast).toBeGreaterThanOrEqual(7);
    });

    test('should meet WCAG AA for large text (3:1 minimum)', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: white; padding: 20px;">
          <h1 style="color: rgb(130, 130, 130); font-size: 24px; margin: 0;">Large text</h1>
        </div>
      `);

      const contrast = await page.locator('h1').evaluate(evaluateElementContrast);

      // Large text has lower requirement (3:1)
      expect(contrast).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Background Color Inheritance', () => {
    test('should find background color from parent when transparent', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: rgb(255, 255, 255); padding: 20px;">
          <div style="background-color: transparent;">
            <p style="color: black; margin: 0;">Text with transparent bg</p>
          </div>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Should inherit white background from parent
      expect(contrast).toBeGreaterThan(20);
    });

    test('should traverse DOM tree to find non-transparent background', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: rgb(0, 0, 0); padding: 20px;">
          <div style="background-color: transparent;">
            <div style="background-color: rgba(0, 0, 0, 0);">
              <p style="color: white; margin: 0;">Nested transparent</p>
            </div>
          </div>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Should find black background from grandparent
      expect(contrast).toBeGreaterThan(20);
    });
  });

  test.describe('Color Format Handling', () => {
    test('should handle RGB color format', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: rgb(255, 255, 255); padding: 20px;">
          <p style="color: rgb(0, 0, 0); margin: 0;">RGB format</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      expect(contrast).toBeGreaterThan(20);
    });

    test('should handle hex color format via computed styles', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: #FFFFFF; padding: 20px;">
          <p style="color: #000000; margin: 0;">Hex format</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Browser converts hex to rgb in computed styles
      expect(contrast).toBeGreaterThan(20);
    });

    test('should handle named colors via computed styles', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: white; padding: 20px;">
          <p style="color: black; margin: 0;">Named colors</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      expect(contrast).toBeGreaterThan(20);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle same color for text and background (1:1 ratio)', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: rgb(100, 100, 100); padding: 20px;">
          <p style="color: rgb(100, 100, 100); margin: 0;">Same color</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Same color should have 1:1 ratio
      expect(contrast).toBeCloseTo(1, 0);
    });

    test('should return positive number for all color combinations', async ({ page }) => {
      const colors = [
        { text: 'rgb(0, 0, 0)', bg: 'rgb(255, 255, 255)' },
        { text: 'rgb(255, 0, 0)', bg: 'rgb(0, 255, 0)' },
        { text: 'rgb(0, 0, 255)', bg: 'rgb(255, 255, 0)' },
      ];

      for (const { text, bg } of colors) {
        await page.setContent(`
          <div style="background-color: ${bg}; padding: 20px;">
            <p style="color: ${text}; margin: 0;">Test</p>
          </div>
        `);

        const contrast = await page.locator('p').evaluate(evaluateElementContrast);

        expect(contrast).toBeGreaterThan(0);
        expect(typeof contrast).toBe('number');
      }
    });

    test('should handle zero luminance gracefully', async ({ page }) => {
      await page.setContent(`
        <div style="background-color: rgb(0, 0, 0); padding: 20px;">
          <p style="color: rgb(1, 1, 1); margin: 0;">Near black</p>
        </div>
      `);

      const contrast = await page.locator('p').evaluate(evaluateElementContrast);

      // Should handle near-zero luminance without error
      expect(contrast).toBeGreaterThan(1);
      expect(contrast).toBeLessThan(2);
    });
  });
});
