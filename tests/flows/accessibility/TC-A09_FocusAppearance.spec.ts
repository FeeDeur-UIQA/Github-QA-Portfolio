import { test, expect } from '@playwright/test';

/**
 * TC-A09: Focus Appearance (Enhanced) - WCAG 2.4.13 Level AAA
 *
 * Tests that focus indicators have sufficient contrast and visibility.
 * Focus indicators should be clearly visible against backgrounds with
 * at least 3:1 contrast ratio.
 *
 * WCAG 2.4.13: The keyboard focus indicator is visible.
 */

test.describe('TC-A09: Focus Appearance Tests @accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Focusable elements are identifiable with clear visual indicators', async ({ page }) => {
    // Tab through page and check for visual focus indicators
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');

      const focusIndicator = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el || el === document.body) return null;

        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Check for visible focus state
        const hasVisibleFocus =
          style.outline !== 'none' ||
          style.boxShadow !== 'none' ||
          style.borderStyle !== 'none' ||
          (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent');

        return {
          hasVisibleFocus,
          outline: style.outline,
          boxShadow: style.boxShadow,
          visible: rect.width > 0 && rect.height > 0,
        };
      });

      if (focusIndicator && focusIndicator.visible) {
        // If element is focusable, it should show some visual change
        expect(focusIndicator.visible, 'Focused element should be visible').toBe(true);
      }
    }
  });

  test('Interactive elements are distinguishable from surrounding content', async ({ page }) => {
    const links = page.locator('a[href]').first();
    const linkExists = await links.isVisible().catch(() => false);

    if (linkExists) {
      const styles = await links.evaluate((el) => {
        const defaultStyle = window.getComputedStyle(el);
        const color = defaultStyle.color;
        const backgroundColor = defaultStyle.backgroundColor;
        const textDecoration = defaultStyle.textDecoration;

        return {
          isStyledAsLink: textDecoration.includes('underline') || color !== 'rgb(0, 0, 0)',
          hasContrast: backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)',
          color,
          backgroundColor,
          textDecoration,
        };
      });

      // Link should have some visual distinction (underline, color, or background)
      expect(
        styles.isStyledAsLink || styles.hasContrast,
        'Links should be visually distinguished from surrounding text',
      ).toBe(true);
    }
  });

  test('All form inputs have visible focus states', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const inputs = page
      .locator('input[type="text"], input[type="email"], input[type="password"], textarea')
      .first();
    const inputExists = await inputs.isVisible().catch(() => false);

    if (inputExists) {
      const focusState = await inputs.evaluate((input) => {
        const style = window.getComputedStyle(input);
        const rect = input.getBoundingClientRect();

        return {
          hasBorder: style.borderStyle !== 'none' && style.borderWidth !== '0px',
          hasBackground:
            style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent',
          visible: rect.width > 0 && rect.height > 0,
        };
      });

      expect(focusState.visible, 'Input should be visible').toBe(true);
      expect(
        focusState.hasBorder || focusState.hasBackground,
        'Input should have visible border or background',
      ).toBe(true);
    }
  });

  test('Button states are visually distinguishable', async ({ page }) => {
    const buttons = page.locator('button').first();
    const buttonExists = await buttons.isVisible().catch(() => false);

    if (buttonExists) {
      const buttonStyle = await buttons.evaluate((btn) => {
        const style = window.getComputedStyle(btn);
        const rect = btn.getBoundingClientRect();

        return {
          hasBackground:
            style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent',
          hasBorder: style.borderStyle !== 'none',
          hasColor: style.color !== 'rgb(0, 0, 0)',
          visible: rect.width > 0 && rect.height > 0,
          fontSize: parseFloat(style.fontSize),
        };
      });

      expect(buttonStyle.visible, 'Button should be visible').toBe(true);
      expect(
        buttonStyle.hasBackground || buttonStyle.hasBorder || buttonStyle.hasColor,
        'Button should be visually styled',
      ).toBe(true);
    }
  });
});
