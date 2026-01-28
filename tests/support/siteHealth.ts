import type { Page } from '@playwright/test';
import { test } from '@playwright/test';

/**
 * Skip the current test when the target site returns a Cloudflare 5xx error page.
 * This avoids false negatives in CI when the external site is temporarily unavailable.
 */
export async function skipIfCloudflareError(page: Page): Promise<void> {
  // Quick heuristics: explicit heading and Ray ID text appear on the Cloudflare 5xx landing page.
  const heading = page.getByRole('heading', { name: /error code 52\d/i });
  const rayId = page.getByText(/Cloudflare Ray ID/i);

  const hasHeading = await heading.isVisible().catch(() => false);
  const hasRayId = await rayId.isVisible().catch(() => false);

  if (hasHeading || hasRayId) {
    test.skip();
    return;
  }

  const bodyText = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  if (/cloudflare.*5xx error|error code 52\d/i.test(bodyText)) {
    test.skip();
    return;
  }
}

/**
 * Check if page is showing Cloudflare 520 error
 * @param page - Playwright page object
 * @returns True if Cloudflare error detected
 */
export async function isCloudflareError(page: Page): Promise<boolean> {
  return (await page.getByText(/error code 520/i).count()) > 0;
}

/**
 * Navigate with retry logic for Cloudflare transient errors
 * @param page - Playwright page object
 * @param url - Target URL to navigate to
 * @param retries - Maximum retry attempts (default: 3)
 * @param dismissConsent - Optional consent dismissal function
 */
export async function gotoWithRetry(
  page: Page,
  url: string,
  retries: number = 3,
  dismissConsent?: (page: Page) => Promise<void>,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    await page.goto(url);
    if (dismissConsent) {
      await dismissConsent(page);
    }

    if (!(await isCloudflareError(page))) return;

    if (attempt === retries) break;
    await page.waitForTimeout(500 * attempt);
  }
}
