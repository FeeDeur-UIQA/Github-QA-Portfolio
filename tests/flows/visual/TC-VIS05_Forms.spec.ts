import type { Page } from '@playwright/test';

import { expect, test } from '../../../fixtures/visual.fixtures';
import { dismissConsentIfPresent } from '../../support/consent';
import { skipIfCloudflareError } from '../../support/siteHealth';

/**
 * TC-VIS05: Forms Visual Regression
 *
 * Uses stabilizedPage and masking to keep baselines deterministic across CI runs.
 */

const maskForms = (page: Page) => [
  page.locator('iframe'),
  page.locator('.advertisement, [class*="ad-"], ins'),
  page.getByRole('button', { name: /privacy and cookie settings/i }).first(),
];

test.describe('TC-VIS05: Forms Visual Regression @slow', () => {
  test('should match login form baseline @visual', async ({ stabilizedPage }) => {
    await stabilizedPage.goto('/login');
    await skipIfCloudflareError(stabilizedPage);
    await dismissConsentIfPresent(stabilizedPage);

    // Capture both login and signup forms in single page view
    // Optimized from 5 screenshots to 2 (login page + contact form)
    const loginForm = stabilizedPage.locator('.login-form');
    await expect(loginForm).toBeVisible();
    await expect(loginForm).toHaveScreenshot('login-form.png', {
      maxDiffPixelRatio: 0.08,
      mask: maskForms(stabilizedPage),
    });
  });

  test('should match contact form baseline @visual', async ({ stabilizedPage }) => {
    await stabilizedPage.goto('/contact_us');
    await skipIfCloudflareError(stabilizedPage);
    await dismissConsentIfPresent(stabilizedPage);

    // Contact form validates complex form layouts with file upload
    const contactForm = stabilizedPage.locator('#contact-page');
    await expect(contactForm).toBeVisible();
    await expect(contactForm).toHaveScreenshot('contact-form.png', {
      maxDiffPixelRatio: 0.08,
      mask: maskForms(stabilizedPage),
    });
  });
});
