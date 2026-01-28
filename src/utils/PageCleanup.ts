 
import type { BrowserContext, Page } from '@playwright/test';

/**
 * Memory management utilities for preventing leaks in long test runs
 */
export class PageCleanup {
  private static pages: Set<Page> = new Set();
  private static contexts: Set<BrowserContext> = new Set();

  /**
   * Register a page for cleanup tracking
   */
  static registerPage(this: void, page: Page): void {
    PageCleanup.pages.add(page);

    // Auto-register context if available
    const context = page.context();
    if (context) {
      PageCleanup.contexts.add(context);
    }
  }

  /**
   * Clean up specific page resources
   */
  static async cleanupPage(this: void, page: Page): Promise<void> {
    try {
      // Cancel any pending operations
      await page.close({ runBeforeUnload: false });
      PageCleanup.pages.delete(page);
    } catch (error) {
      // Page might already be closed, ignore
      console.warn('Page cleanup warning:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Clean up all registered pages and contexts
   */
  static async cleanupAll(this: void): Promise<void> {
    const pageCleanups = Array.from(PageCleanup.pages).map((page) => PageCleanup.cleanupPage(page));
    const contextCleanups = Array.from(PageCleanup.contexts).map(async (context): Promise<void> => {
      try {
        await context.close();
      } catch (error) {
        console.warn(
          'Context cleanup warning:',
          error instanceof Error ? error.message : String(error),
        );
      }
    });

    await Promise.allSettled([...pageCleanups, ...contextCleanups]);

    // Clear tracking sets
    PageCleanup.pages.clear();
    PageCleanup.contexts.clear();
  }

  /**
   * Get current resource usage stats
   */
  static getStats(this: void): { activePages: number; activeContexts: number } {
    return {
      activePages: PageCleanup.pages.size,
      activeContexts: PageCleanup.contexts.size,
    };
  }

  /**
   * Emergency cleanup with timeout
   */
  static async emergencyCleanup(this: void, timeoutMs = 5000): Promise<void> {
    const cleanupPromise = PageCleanup.cleanupAll();
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn('Cleanup timeout reached, forcing cleanup');
        resolve();
      }, timeoutMs);
    });

    await Promise.race([cleanupPromise, timeoutPromise]);
  }
}

// Global cleanup registration for test teardown
export const setupGlobalCleanup = (): void => {
  // Register cleanup on process exit
  const handleExit = (): void => {
    console.log('Process exit - cleaning up resources...');
  };

  const handleSignal = async (): Promise<void> => {
    console.log('Signal received - cleaning up resources...');
    await PageCleanup.emergencyCleanup();
    process.exit(0);
  };

  process.on('exit', handleExit);
  process.on('SIGINT', () => {
    void handleSignal();
  });
  process.on('SIGTERM', () => {
    void handleSignal();
  });
};
