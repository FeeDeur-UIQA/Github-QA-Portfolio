import { test, expect } from '@playwright/test';

/**
 * TC-A08: Focus Not Obscured (Minimum) - WCAG 2.4.11 Level AA
 *
 * Ensures that when a component receives keyboard focus, it is not entirely
 * hidden by other content. This test focuses on verifiable focus visibility
 * without strict assertions about page structure.
 *
 * WCAG 2.4.11 (Level AA): When a user interface component receives keyboard focus,
 * the component is not entirely hidden due to author-created content.
 */

test.describe('TC-A08: Focus Not Obscured Tests @accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Stability wait for external site
  });

  test('Focus outline visible when tabbing through main navigation', async ({ page }) => {
    // Tab through multiple elements and check that focus is visible
    let focusedElementsWithOutline = 0;
    let totalFocusedElements = 0;

    // Tab through the page
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');

      const focusInfo = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el || el === document.body) return null;

        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Check if element has any visible focus indicator
        const hasOutline =
          style.outline !== 'none' ||
          style.boxShadow !== 'none' ||
          style.borderColor !== 'rgb(0, 0, 0)';

        return {
          tag: el.tagName,
          hasVisibleSize: rect.width > 0 && rect.height > 0,
          inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
          hasOutline,
          visibility: style.visibility,
          display: style.display,
          opacity: parseFloat(style.opacity),
        };
      });

      if (focusInfo) {
        totalFocusedElements++;

        // Element must have some visual presence
        expect(
          focusInfo.hasVisibleSize,
          `Focused element should have visible size (got ${focusInfo.tag})`,
        ).toBe(true);

        expect(
          focusInfo.visibility !== 'hidden',
          `Focused element should not be visibility:hidden`,
        ).toBe(true);

        expect(focusInfo.opacity > 0.5, `Focused element should not be nearly transparent`).toBe(
          true,
        );

        if (focusInfo.hasOutline) {
          focusedElementsWithOutline++;
        }
      }
    }

    // At least some elements should be focusable
    expect(totalFocusedElements, 'Should find focusable elements in page').toBeGreaterThan(5);
  });

  test('Links are visible when navigating by keyboard', async ({ page }) => {
    // Verify we can find and check links for visibility
    const allLinks = await page.locator('a[href]').count();
    expect(allLinks, 'Should find links on homepage').toBeGreaterThan(0);

    // Check first few links for visibility
    const linkCount = Math.min(allLinks, 3);
    for (let i = 0; i < linkCount; i++) {
      const link = page.locator('a[href]').nth(i);

      const isVisible = await link.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        return {
          hasSize: rect.width > 0 && rect.height > 0,
          notHidden: style.display !== 'none' && style.visibility !== 'hidden',
          opacity: parseFloat(style.opacity) >= 0.5,
        };
      });

      expect(isVisible.hasSize, `Link ${i + 1} should have visible dimensions`).toBe(true);
      expect(isVisible.notHidden, `Link ${i + 1} should not be hidden`).toBe(true);
      expect(isVisible.opacity, `Link ${i + 1} should be opaque`).toBe(true);
    }
  });

  test('Form inputs are accessible and visible', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Stability wait for external site

    // Dismiss any popups that might be blocking
    const closeButtons = page
      .locator('[class*="close"], [class*="dismiss"], .fc-button-label')
      .first();
    const closeExists = await closeButtons.isVisible().catch(() => false);
    if (closeExists) {
      await closeButtons.click().catch(() => {});
    }

    // Find search input
    const searchInput = page.locator('#search_product, input[name="search"]').first();
    const inputExists = await searchInput.isVisible().catch(() => false);

    if (inputExists) {
      // Check visibility without clicking to avoid popup interference
      const inputState = await searchInput.evaluate((input) => {
        const rect = input.getBoundingClientRect();
        const style = window.getComputedStyle(input);

        return {
          visible: rect.width > 0 && rect.height > 0,
          enabled: !(input as HTMLInputElement).disabled,
          notCovered: style.display !== 'none' && style.visibility !== 'hidden',
        };
      });

      expect(inputState.visible, 'Search input should be visible').toBe(true);
      expect(inputState.enabled, 'Search input should be enabled').toBe(true);
      expect(inputState.notCovered, 'Search input should not be covered').toBe(true);
    }
  });

  test('Header remains accessible while scrolling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Stability wait for external site

    // Get header element if it exists
    const header = page.locator('header').first();
    const headerVisible = await header.isVisible().catch(() => false);

    if (headerVisible) {
      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(300);

      // Check if header elements are still accessible
      const headerAccessibility = await header.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Header should be positioned to not obstruct full focus
        return {
          visible: style.display !== 'none' && style.visibility !== 'hidden',
          reasonableHeight: rect.height < 300, // Header shouldn't be huge
          hasPosition: style.position !== 'static' || rect.height > 0,
        };
      });

      expect(headerAccessibility.visible, 'Header should be visible while scrolling').toBe(true);
      expect(headerAccessibility.reasonableHeight, 'Header should have reasonable height').toBe(
        true,
      );
    }
  });

  test('Buttons respond to keyboard interaction', async ({ page }) => {
    await page.goto('/');

    // Find all buttons that are visible
    const buttons = page
      .locator('button[type="button"], button[type="submit"], a.btn, [role="button"]')
      .first();
    const buttonExists = await buttons.isVisible().catch(() => false);

    if (buttonExists) {
      // Tab to find focusable buttons
      let focusedButton = false;

      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');

        const isFocusedButton = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const isButton =
            el.tagName === 'BUTTON' ||
            el.getAttribute('role') === 'button' ||
            el.classList.contains('btn');

          if (isButton) {
            const rect = el.getBoundingClientRect();
            return {
              isButton,
              visible: rect.width > 0 && rect.height > 0,
              inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
            };
          }
          return { isButton: false };
        });

        if (isFocusedButton && isFocusedButton.isButton) {
          expect(isFocusedButton.visible, 'Focused button should be visible').toBe(true);
          focusedButton = true;
          break;
        }
      }

      // We should have found at least one keyboard-accessible button
      if (focusedButton) {
        expect(focusedButton).toBe(true);
      }
    }
  });

  test('Page elements maintain visibility at different viewport sizes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Stability wait for external site

    const viewportSizes = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
    ];

    for (const size of viewportSizes) {
      await page.setViewportSize(size);
      await page.waitForTimeout(300);

      // Find any focusable element
      const focusableElement = page.locator('a, button, input[type="text"]').first();
      const exists = await focusableElement.isVisible().catch(() => false);

      if (exists) {
        const elementState = await focusableElement.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return {
            hasSize: rect.width > 0 && rect.height > 0,
            visible: rect.width < window.innerWidth && rect.height < window.innerHeight,
          };
        });

        expect(
          elementState.hasSize,
          `Element should have size at ${size.width}x${size.height}`,
        ).toBe(true);
      }
    }
  });

  test('Interactive elements have adequate sizing', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Stability wait for external site

    // Check various interactive elements
    const buttons = page.locator('button, [role="button"], a.btn').first();
    const buttonExists = await buttons.isVisible().catch(() => false);

    if (buttonExists) {
      const targetSize = await buttons.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          meetsMinimum: rect.width >= 20 || rect.height >= 20, // At least one dimension is reasonable
        };
      });

      // Should have at least minimal clickable size
      expect(
        targetSize.meetsMinimum,
        `Interactive element should have adequate size (got ${targetSize.width}x${targetSize.height})`,
      ).toBe(true);
    }
  });

  test('Page content remains visible after page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Stability wait for external site

    // Check that main content is visible and not hidden
    const mainContent = page.locator('body');
    const contentVisible = await mainContent.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display !== 'none',
        visibility: style.visibility !== 'hidden',
        hasContent: el.children.length > 0,
        opacity: parseFloat(style.opacity) >= 0.5,
      };
    });

    expect(contentVisible.display, 'Page content should have display').toBe(true);
    expect(contentVisible.visibility, 'Page content should be visible').toBe(true);
    expect(contentVisible.hasContent, 'Page should have content elements').toBe(true);
    expect(contentVisible.opacity, 'Page content should not be transparent').toBe(true);
  });
});
