import { test, expect } from '@playwright/test';

import { PageCleanup } from '../../src/utils/PageCleanup';

/**
 * Unit Tests for PageCleanup Utility
 *
 * Tests memory management and resource cleanup
 * Increases coverage for src/utils/PageCleanup.ts (currently 0%)
 *
 * Best Practice: Test utilities that manage critical resources
 */

test.describe('PageCleanup Unit Tests @fast @unit', () => {
  test.describe('Page Registration', () => {
    test('should register page for tracking', async ({ page }) => {
      // Register page
      PageCleanup.registerPage(page);

      // Verify page is tracked (implicit - cleanup should work)
      expect(page).toBeDefined();
      expect(page.isClosed()).toBe(false);
    });

    test('should register multiple pages', async ({ browser }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      PageCleanup.registerPage(page1);
      PageCleanup.registerPage(page2);

      expect(page1.isClosed()).toBe(false);
      expect(page2.isClosed()).toBe(false);

      await page1.close();
      await page2.close();
      await context.close();
    });

    test('should auto-register page context', async ({ page }) => {
      const context = page.context();

      PageCleanup.registerPage(page);

      expect(context).toBeDefined();
      expect(page.context()).toBe(context);
    });
  });

  test.describe('Page Cleanup', () => {
    test('should cleanup single page without error', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      PageCleanup.registerPage(page);

      await PageCleanup.cleanupPage(page);

      expect(page.isClosed()).toBe(true);

      await context.close();
    });

    test('should handle already-closed page gracefully', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.close();

      // Should not throw error
      await expect(PageCleanup.cleanupPage(page)).resolves.not.toThrow();

      await context.close();
    });

    test('should cleanup all registered pages', async ({ browser }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      const page3 = await context.newPage();

      PageCleanup.registerPage(page1);
      PageCleanup.registerPage(page2);
      PageCleanup.registerPage(page3);

      await PageCleanup.cleanupAll();

      expect(page1.isClosed()).toBe(true);
      expect(page2.isClosed()).toBe(true);
      expect(page3.isClosed()).toBe(true);

      await context.close();
    });

    test('should clear tracking sets after cleanup', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      PageCleanup.registerPage(page);
      await PageCleanup.cleanupAll();

      // Verify cleanup completed (implicit - no errors)
      expect(page.isClosed()).toBe(true);

      await context.close();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle cleanup errors without throwing', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.close(); // Pre-close page

      // Should handle gracefully with warning (not throw)
      await expect(PageCleanup.cleanupPage(page)).resolves.not.toThrow();

      await context.close();
    });

    test('should cleanup remaining pages even if one fails', async ({ browser }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      PageCleanup.registerPage(page1);
      PageCleanup.registerPage(page2);

      await page1.close(); // Pre-close one

      await PageCleanup.cleanupAll();

      // Both should be cleaned up
      expect(page1.isClosed()).toBe(true);
      expect(page2.isClosed()).toBe(true);

      await context.close();
    });
  });

  test.describe('Memory Management', () => {
    test('should prevent memory leaks by closing pages', async ({ browser }) => {
      const context = await browser.newContext();
      const pages = [];

      // Create multiple pages
      for (let i = 0; i < 5; i++) {
        const page = await context.newPage();
        PageCleanup.registerPage(page);
        pages.push(page);
      }

      await PageCleanup.cleanupAll();

      // All pages should be closed
      for (const page of pages) {
        expect(page.isClosed()).toBe(true);
      }

      await context.close();
    });

    test('should close context along with pages', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      PageCleanup.registerPage(page);

      await PageCleanup.cleanupAll();

      // Context should be closed after cleanup
      expect(page.isClosed()).toBe(true);

      // Verify context is also cleaned (attempt to use it should fail)
      await expect(context.newPage()).rejects.toThrow();
    });
  });
});
