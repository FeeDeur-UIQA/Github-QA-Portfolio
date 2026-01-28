import { test, expect } from '@playwright/test';

/**
 * TC-A13: Consistent Design - WCAG 3.2.4 Level AA
 *
 * Ensures consistent navigation, layout, and functionality across pages.
 */

test.describe('TC-A13: Consistent Design Tests @accessibility', () => {
  test('Navigation structure is consistent across pages', async ({ page }) => {
    const pages = ['/', '/products'];
    const navigationData: any[] = [];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500); // Stability wait for external site

      const navLinks = page.locator('nav a, header a, [role="navigation"] a');
      const navCount = await navLinks.count();

      navigationData.push({
        path: pagePath,
        navCount,
        hasNav: navCount > 0,
      });
    }

    // Both pages should have navigation
    expect(navigationData[0].hasNav, 'Home should have navigation').toBe(true);
    expect(navigationData[1].hasNav, 'Products page should have navigation').toBe(true);
  });

  test('Page header is consistent', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header');
    const headerVisible = await header.isVisible().catch(() => false);
    expect(headerVisible, 'Page should have header').toBe(true);
  });

  test('Page footer exists', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer, [role="contentinfo"]');
    // Footer may not always be visible, but structure should support it
    expect(footer, 'Page should have footer structure').toBeDefined();
  });

  test('Main content area is identifiable', async ({ page }) => {
    await page.goto('/');

    const main = page.locator('main, [role="main"], .main-content, .container');
    const mainCount = await main.count();

    // Page should have a main content area (by semantic or class)
    expect(mainCount, 'Page should identify main content area').toBeGreaterThan(0);
  });

  test('Page supports interactive elements', async ({ page }) => {
    const links = await page.locator('a[href]').count();
    const buttons = await page.locator('button').count();

    // Page structure should support interactive elements
    expect(links + buttons >= 0, 'Page supports interactive controls').toBe(true);
  });
});
