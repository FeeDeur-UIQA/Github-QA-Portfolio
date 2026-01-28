import type { Page } from '@playwright/test';

/**
 * Dismisses the EU consent overlay used by the target site.
 * Falls back to DOM removal when buttons are not interactable.
 */
export async function dismissConsentIfPresent(page: Page): Promise<void> {
  // Try to click the consent button if visible
  const consentButtons = [
    page.getByRole('button', { name: /consent|accept|agree|allow/i }),
    page.getByRole('button', { name: /manage options/i }),
  ];

  for (const btn of consentButtons) {
    const visible = await btn.isVisible().catch(() => false);
    if (visible) {
      await btn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(100);
      break;
    }
  }

  // Ensure residual overlays are removed so clicks are not intercepted
  await page.evaluate(() => {
    const selectors = [
      '.fc-consent-root',
      '.fc-dialog',
      '.fc-dialog-overlay',
      '[aria-modal="true"]',
    ];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    });
  });
}
