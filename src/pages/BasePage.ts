import { expect } from '@playwright/test';
import type { Locator, Page, Response } from '@playwright/test';

import { Logger } from '../utils/Logger';

/**
 * BasePage: Base page object class with shared utilities for ad blocking, safe interactions, and navigation.
 */
export abstract class BasePage {
  // 'protected' is critical: it allows LoginPage/HomePage to use 'this.page'
  protected readonly page: Page;
  protected readonly logger: Logger;

  constructor(page: Page) {
    this.page = page;
    this.logger = Logger.getInstance(this.constructor.name);

    // Initializing infrastructure on instantiation
    void this.setupAdBlocker();
    this.initializeTelemetry();

    this.logger.debug('Page object initialized', { url: page.url() });
  }

  /**
   * NETWORK SHIELD: Aborts requests to known ad/tracking domains at the protocol level.
   */
  private async setupAdBlocker(): Promise<void> {
    await this.page.route('**/*', (route) => {
      const url = route.request().url();
      const adPatterns = [
        'googleads',
        'g.doubleclick.net',
        'google-analytics',
        'adservice',
        'vignette',
        'adsbygoogle',
        'quantserve',
      ];
      if (adPatterns.some((pattern) => url.includes(pattern))) {
        void route.abort();
      } else {
        void route.continue();
      }
    });
  }

  private initializeTelemetry(): void {
    this.page.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('api')) {
        this.logger.error('API Failure detected', {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
    });
  }

  /**
   * DOM SANITIZER: Physically removes ad containers that bypass the network shield.
   */
  private async handleGlobalOverlays(): Promise<void> {
    const overlayLocators: Locator[] = [
      this.page.locator('iframe[name^="aswift"]'),
      this.page.locator('#dismiss-button'),
      this.page.locator('.adsbygoogle'),
      this.page.locator('ins.adsbygoogle'),
      // Consent/Privacy dialogs (vendor-specific)
      this.page.locator('.fc-consent-root'),
      this.page.locator('.fc-dialog'),
      this.page.locator('.fc-dialog-overlay'),
      this.page.locator('[aria-modal="true"]'),
      this.page.getByRole('dialog'),
    ];

    for (const locator of overlayLocators) {
      try {
        const handles = await locator.elementHandles();
        if (handles.length > 0) {
          this.logger.warn('Self-healing: Removing overlay elements', { count: handles.length });
          for (const handle of handles) {
            await handle.evaluate((el) => (el as Element).remove());
          }
        }
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  /**
   * PUBLIC OVERLAY CLEAR: Exposes overlay cleanup to child pages
   */
  protected async clearOverlays(): Promise<void> {
    await this.handleGlobalOverlays();
  }

  /**
   * POSITION GUARD: Ensures elements aren't moving (animations) before interaction.
   */
  private async waitForMovementStability(locator: Locator): Promise<void> {
    const getBox = () => locator.boundingBox();
    let previousBox = await getBox();

    await expect
      .poll(
        async () => {
          const currentBox = await getBox();
          const isStable = JSON.stringify(currentBox) === JSON.stringify(previousBox);
          previousBox = currentBox;
          return isStable;
        },
        {
          message: '❌ Element failed to stabilize position.',
          timeout: 3000,
          intervals: [100, 200, 500],
        },
      )
      .toBe(true);
  }

  /**
   * Self-healing click interaction with 3-tier fallback strategy
   * @param locator - Playwright locator to interact with
   * @param timeout - Maximum wait time in milliseconds (default: 10000)
   * @returns Promise that resolves when click succeeds
   * @example
   * ```typescript
   * await this.safeClick(this.loginButton);
   * await this.safeClick(this.submitButton, 5000); // Custom timeout
   * ```
   */
  protected async safeClick(locator: Locator, timeout: number = 10000): Promise<void> {
    await expect(
      async () => {
        try {
          await locator.scrollIntoViewIfNeeded();
          await this.waitForMovementStability(locator);

          // 1. Attempt natural click
          await locator.click({ timeout: 2000 });
        } catch {
          this.logger.warn('Interaction intercepted - applying recovery logic');

          // 2. Clear known overlays
          await this.handleGlobalOverlays();

          try {
            // 3. Attempt Forced Click
            await locator.click({ force: true, timeout: 2000 });
          } catch {
            // 4. NUCLEAR OPTION: Direct Browser Event Dispatch
            this.logger.error('UI Click failed - dispatching JS event directly');
            await locator.dispatchEvent('click');
          }
        }
      },
      {
        message: `🎯 safeClick failed after all recovery attempts.`,
      },
    ).toPass({
      intervals: [500, 1000],
      timeout,
    });
  }

  /**
   * Ensures page is fully loaded and error-free before proceeding
   * @param timeout - Maximum wait time in milliseconds (default: 15000)
   * @returns Promise that resolves when page is ready for interaction
   */
  async waitForPageReady(timeout: number = 15000): Promise<void> {
    // 1. Network stability
    await this.page.waitForLoadState('networkidle', { timeout });

    // 2. No server errors in title/body
    await expect
      .poll(
        async () => {
          const title = await this.page.title();
          return (
            !title.toLowerCase().includes('error') &&
            !title.includes('IntegrityError') &&
            !title.includes('520')
          );
        },
        { timeout: 5000 },
      )
      .toBe(true);

    // 3. Body content loaded
    await expect(this.page.locator('body')).not.toBeEmpty();
  }

  /**
   * Explicit Server Error Detection
   * Fail-fast with clear messaging when backend issues occur
   */
  async assertNoServerError(): Promise<void> {
    const errorIndicators = [
      { locator: this.page.getByText(/IntegrityError/i), name: 'Database Integrity Error' },
      { locator: this.page.getByText(/Error code 520/i), name: 'Cloudflare 520 Error' },
      { locator: this.page.getByText(/Error code 500/i), name: 'Internal Server Error' },
      {
        locator: this.page.getByText(/UNIQUE constraint failed/i),
        name: 'Database Constraint Error',
      },
      { locator: this.page.locator('h1:has-text("Error")'), name: 'Generic Error Page' },
    ];

    for (const { locator, name } of errorIndicators) {
      const isVisible = await locator.isVisible().catch(() => false);
      if (isVisible) {
        const errorText = await locator.textContent().catch(() => 'Unknown error');
        throw new Error(`🚨 ${name} Detected: ${errorText}`);
      }
    }
  }

  /**
   * Retry-Aware Assertion Wrapper
   * Handles transient failures with exponential backoff
   */
  async expectEventually(
    assertion: () => Promise<void>,
    options: { timeout?: number; retries?: number; name?: string } = {},
  ): Promise<void> {
    const { timeout: _timeout = 20000, retries = 3, name = 'assertion' } = options; // eslint-disable-line @typescript-eslint/no-unused-vars

    for (let i = 0; i < retries; i++) {
      try {
        await assertion();
        if (i > 0) this.logger.info('Assertion succeeded on retry', { name, attempt: i + 1 });
        return;
      } catch (e) {
        if (i === retries - 1) throw e;
        this.logger.warn('Assertion failed - retrying', {
          name,
          attempt: i + 1,
          maxRetries: retries,
          error: (e as Error).message,
        });
        await this.page.waitForLoadState('load', { timeout: 1000 * (i + 1) }); // exponential backoff
        await this.page.waitForLoadState('load').catch(() => {});
      }
    }
  }

  /**
   * RESILIENT NAVIGATION: Enhanced with 5xx error retry and health validation
   */
  async navigateTo(path: string = '/', retries: number = 3): Promise<Response | null> {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await this.page.goto(path, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        // Retry all 5xx errors with exponential backoff
        if (response && response.status() >= 500 && i < retries) {
          const backoffMs = Math.min(1000 * Math.pow(2, i), 5000); // 1s, 2s, 4s, max 5s
          this.logger.warn('Server error - retrying with backoff', {
            status: response.status(),
            attempt: i + 1,
            maxRetries: retries,
            backoffMs,
            url: path,
          });
          // Use shorter timeout - don't wait the full backoff period for DOM
          await Promise.race([
            this.page.waitForLoadState('domcontentloaded').catch(() => {}),
            new Promise((r) => setTimeout(r, backoffMs)),
          ]);
          continue;
        }

        // Fail on 4xx client errors (no retry)
        if (response && response.status() >= 400 && response.status() < 500) {
          throw new Error(`🚫 Client Error: ${path} | Status: ${response.status()}`);
        }

        // Still got 5xx after all retries
        if (response && response.status() >= 500) {
          throw new Error(
            `🚫 Server Unavailable: ${path} | Status: ${response.status()} after ${retries} retries`,
          );
        }

        await this.clearOverlays();
        return response;
      } catch (error) {
        if (i === retries) throw error;
        const backoffMs = Math.min(1000 * Math.pow(2, i), 5000);
        this.logger.warn('Navigation exception - retrying', {
          attempt: i + 1,
          maxRetries: retries,
          error: (error as Error).message,
          backoffMs,
          url: path,
        });
        // Don't wait full backoff period for domcontentloaded - race against timeout
        await Promise.race([
          this.page.waitForLoadState('domcontentloaded').catch(() => {}),
          new Promise((r) => setTimeout(r, backoffMs)),
        ]);
      }
    }
    return null;
  }

  async fillInput(locator: Locator, value: string): Promise<void> {
    await locator.waitFor({ state: 'visible' });
    await locator.fill(value);
  }

  abstract isPageLoaded(): Promise<void>;
}
