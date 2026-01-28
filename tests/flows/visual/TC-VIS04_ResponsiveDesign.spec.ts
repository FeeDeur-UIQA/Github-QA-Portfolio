import { test, expect } from '../../../fixtures/visual.fixtures';
import { createCustomMasks } from '../../../src/utils/visual-mask-config';

import { skipIfCloudflareError } from '../../support/siteHealth';

/**
 * TC-VIS04: Responsive Design Visual Regression
 *
 * ARCHITECTURE: Uses stabilizedPage fixture for intelligent page stabilization
 * - Automatic font loading wait (document.fonts.ready)
 * - Image completion checks
 * - Animation settle time
 * - Network idle handling
 *
 * MASKING STRATEGY: Hides dynamic content (ads, consent modals) instead of inflating tolerance
 * COMPONENT-FIRST: Tests stable regions with tight tolerances
 *
 * Validates responsive breakpoints and mobile layouts
 * Ensures UI adapts correctly across device sizes
 * Catches responsive CSS issues and mobile navigation problems
 *
 * @category Visual Regression
 * @priority High
 */

const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 },
];

/**
 * Helper: Wait for layout to stabilize after viewport changes
 */
async function waitForStableLayout(locator: any): Promise<void> {
  try {
    // Wait for element to be visible and stable
    await locator.waitFor({ state: 'visible', timeout: 5000 });

    // Check layout stability by measuring position twice
    const box1 = await locator.boundingBox();
    await locator.page().waitForTimeout(100);
    const box2 = await locator.boundingBox();

    // If position changed, wait for stabilization
    if (box1 && box2 && (box1.y !== box2.y || box1.height !== box2.height)) {
      await locator.page().waitForTimeout(300);
    }
  } catch {
    // Element may not be visible in all viewports
  }
}

test.describe('TC-VIS04: Responsive Design Visual Regression @slow', () => {
  for (const viewport of viewports) {
    test.describe(`${viewport.name} viewport`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
      });

      test(`should match homepage at ${viewport.name} size @visual`, async ({
        stabilizedPage,
        browserName,
      }) => {
        const projectName = test.info().project.name;
        const isMobileProject = projectName.includes('mobile');
        if (isMobileProject && viewport.name !== 'mobile') {
          test.skip(); // Mobile emulation projects only validate mobile viewport
        }

        await test.step(`Capture homepage at ${viewport.width}x${viewport.height}`, async () => {
          await stabilizedPage.goto('/');
          await skipIfCloudflareError(stabilizedPage);

          // Strategic masking instead of high tolerance
          // Create mobile-specific masks for dynamic content
          const mobileSpecificMasks =
            viewport.width <= 768
              ? [
                  '[class*="ad-"]',
                  'iframe[src*="doubleclick"]',
                  'iframe[src*="googlesyndication"]',
                  '[class*="consent"]',
                  '.cm',
                  '[data-cc*="consent"]',
                  '.cookieconsent',
                ]
              : [];

          const allMasks = createCustomMasks([...mobileSpecificMasks], 'standard');
          const maskLocators = allMasks.map((s) => stabilizedPage.locator(s));

          // Wait for body layout stabilization
          await waitForStableLayout(stabilizedPage.locator('body'));

          // 2025 Hybrid Approach: Tighter tolerance thanks to stabilization + masking
          const isMobile = viewport.width <= 768;
          const diffTolerance = isMobile ? 0.12 : 0.08; // Reduced from 20%/12%

          await expect(stabilizedPage).toHaveScreenshot(
            `homepage-${viewport.name}-${browserName}.png`,
            {
              fullPage: true,
              maxDiffPixelRatio: diffTolerance,
              animations: 'disabled',
              mask: maskLocators,
              threshold: 0.2, // Per-pixel color threshold
            },
          );
        });
      });

      test(`should match navigation at ${viewport.name} size @visual`, async ({
        stabilizedPage,
        browserName,
      }) => {
        const projectName = test.info().project.name;
        const isMobileProject = projectName.includes('mobile');
        if (isMobileProject && viewport.name !== 'mobile') {
          test.skip(); // Mobile emulation projects only validate mobile viewport
        }

        await test.step('Capture navigation header component', async () => {
          await stabilizedPage.goto('/');
          await skipIfCloudflareError(stabilizedPage);

          // Component-level testing: Focus on stable navigation region
          const header = stabilizedPage.locator('header');
          await expect(header).toBeVisible();
          await waitForStableLayout(header);

          // Mask any dynamic elements in header
          const headerMasks = [
            header.locator('[class*="badge"]'),
            header.locator('[class*="notification"]'),
            header.locator('[class*="cart-count"]'),
          ];

          await expect(header).toHaveScreenshot(`nav-${viewport.name}-${browserName}.png`, {
            maxDiffPixelRatio: 0.05, // Component tests allow tighter tolerance
            mask: headerMasks,
          });
        });
      });

      test(`should match product grid at ${viewport.name} size @visual`, async ({
        stabilizedPage,
        browserName,
      }) => {
        const projectName = test.info().project.name;
        const isMobileProject = projectName.includes('mobile');
        if (isMobileProject && viewport.name !== 'mobile') {
          test.skip(); // Mobile emulation projects only validate mobile viewport
        }

        await test.step('Capture product grid layout component', async () => {
          await stabilizedPage.goto('/products');
          await skipIfCloudflareError(stabilizedPage);

          // Component-level: Test just the product grid
          const productGrid = stabilizedPage.locator('.features_items');
          await expect(productGrid).toBeVisible();
          await waitForStableLayout(productGrid);

          // Mask ads and dynamic pricing within grid
          const gridMasks = createCustomMasks(
            [
              '.features_items [class*="ad-"]',
              '.features_items iframe',
              '.features_items [class*="discount"]',
            ],
            'minimal',
          );
          const gridMaskLocators = gridMasks.map((s) => stabilizedPage.locator(s));

          // 2025 Hybrid: Component testing + smart masking = tight tolerance
          const isMobile = viewport.width <= 768;
          const diffTolerance = isMobile ? 0.15 : 0.1; // Reduced from 30%/18%

          await expect(productGrid).toHaveScreenshot(
            `products-${viewport.name}-${browserName}.png`,
            {
              maxDiffPixelRatio: diffTolerance,
              mask: gridMaskLocators,
            },
          );
        });
      });
    });
  }

  test('should match mobile menu hamburger @visual', async ({ stabilizedPage, browserName }) => {
    await test.step('Test mobile menu interaction at small viewport', async () => {
      await stabilizedPage.setViewportSize({ width: 375, height: 667 });
      await stabilizedPage.goto('/');
      await skipIfCloudflareError(stabilizedPage);

      // Check if mobile menu toggle exists
      const menuToggle = stabilizedPage.locator('.navbar-toggle');
      if (await menuToggle.isVisible()) {
        await menuToggle.click();

        // Wait for menu animation to complete
        const nav = stabilizedPage.locator('.navbar-collapse');
        await waitForStableLayout(nav);

        // Component-level screenshot of just the expanded menu
        await expect(nav).toHaveScreenshot(`mobile-menu-open-${browserName}.png`, {
          maxDiffPixelRatio: 0.08,
        });
      }
    });
  });

  // 2025 Enhancement: Hero section component test for carousel stability
  test('should match hero section across viewports @visual', async ({
    stabilizedPage,
    browserName,
  }) => {
    for (const viewport of viewports) {
      await test.step(`Capture hero at ${viewport.name}`, async () => {
        await stabilizedPage.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await stabilizedPage.goto('/');
        await skipIfCloudflareError(stabilizedPage);

        const hero = stabilizedPage.locator('.carousel-inner').first();
        if (await hero.isVisible().catch(() => false)) {
          await waitForStableLayout(hero);

          // Freeze carousel on first slide
          await stabilizedPage.evaluate(() => {
            const carousel = document.querySelector('.carousel');
            if (carousel) {
              carousel.classList.add('paused');
              // Stop Bootstrap carousel
              const bsCarousel = (window as any).bootstrap?.Carousel?.getInstance(carousel);
              if (bsCarousel) bsCarousel.pause();
            }
          });

          await expect(hero).toHaveScreenshot(`hero-${viewport.name}-${browserName}.png`, {
            maxDiffPixelRatio: 0.05, // Tight tolerance for frozen component
          });
        }
      });
    }
  });
});
