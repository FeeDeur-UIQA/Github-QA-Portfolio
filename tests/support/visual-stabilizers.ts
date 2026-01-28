import type { Locator, Page } from '@playwright/test';

/**
 * Wait for layout stabilization by comparing bounding box measurements
 * @param locator - Element to monitor for stability
 * @param options - Configuration for tolerance, interval, and retry attempts
 */
export async function waitForStableLayout(
  locator: Locator,
  { tolerance = 5, interval = 120, attempts = 3 } = {},
): Promise<void> {
  // Wait until two consecutive height samples are within tolerance to reduce visual flake
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const first = await locator.boundingBox();
    await locator.page().waitForTimeout(interval);
    const second = await locator.boundingBox();

    if (first && second && Math.abs((second.height ?? 0) - (first.height ?? 0)) <= tolerance) {
      return;
    }
  }
}

const AD_SELECTORS = [
  '.advertisement',
  '.ad-banner',
  '[class^="ad-"]',
  '[class*=" ad-"]',
  '[class$="-ad"]',
  '[id^="ad-"]',
  '[id*="ad-"]',
  '[id*="google_ads"]',
  'iframe[id^="google_ads"]',
  'iframe[src*="googleads"]',
  'iframe[src*="adsbygoogle"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'ins.adsbygoogle',
  'ins[class*="adsbygoogle"]',
];

const CMP_TEXT_MATCHERS = [
  'Privacy and cookie settings',
  'Managed by Google',
  'Managed by Google. Complies with IAB TCF',
  'CMP ID',
];
const CMP_SELECTORS = [
  '[id*="sp_message"]',
  '[class*="sp_message"]',
  '[aria-label*="cookie settings"]',
];

/**
 * Remove third-party ad slots that change layout height and cause visual diffs.
 */
export async function suppressAdsAndThirdParty(page: Page): Promise<void> {
  await page.evaluate(
    ({ selectors, cmpSelectors, cmpTextMatchers }) => {
      const neutralize = (node: Element) => {
        const element = node as HTMLElement;

        // 2025 Hybrid Fix: Complete removal from layout flow (no preserved height)
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('height', '0px', 'important');
        element.style.setProperty('min-height', '0px', 'important');
        element.style.setProperty('max-height', '0px', 'important');
        element.style.setProperty('margin', '0px', 'important');
        element.style.setProperty('padding', '0px', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('position', 'absolute', 'important');
      };

      const shouldNeutralizeIframe = (frame: HTMLIFrameElement) => {
        const src = frame.src || '';
        return (
          src.includes('googleads') ||
          src.includes('doubleclick') ||
          src.includes('adsbygoogle') ||
          src.includes('googlesyndication')
        );
      };

      const collapseCmpArtifacts = () => {
        const collapseElement = (el: HTMLElement) => {
          // Only collapse the specific element, not its parent
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('height', '0px', 'important');
          el.style.setProperty('min-height', '0px', 'important');
          el.style.setProperty('max-height', '0px', 'important');
          el.style.setProperty('margin', '0px', 'important');
          el.style.setProperty('padding', '0px', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
        };

        const ensureCmpStyle = () => {
          const styleId = 'cmp-visual-hide';
          if (document.getElementById(styleId)) return;
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
          /* Surgical CMP suppression - only target CMP overlay, not footer */
          [id*="sp_message"],
          [class*="sp_message"],
          [aria-label*="cookie settings"],
          footer button[aria-label*="cookie"],
          footer button[aria-label*="Cookie"],
          button:has(span:contains("Privacy and cookie settings")) {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            opacity: 0 !important;
            visibility: hidden !important;
          }
        `;
          document.head.appendChild(style);
        };

        const collapseCmpButton = () => {
          document.querySelectorAll('button').forEach((button) => {
            const text = (button.textContent || '').trim().toLowerCase();
            if (text.includes('privacy and cookie settings')) {
              // Only collapse the button itself, not the entire footer
              collapseElement(button as HTMLElement);
            }
          });
        };

        cmpSelectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => collapseElement(el as HTMLElement));
        });

        // Surgical text-based targeting: only collapse known CMP containers
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode()) {
          const currentNode = walker.currentNode;
          if (!currentNode) continue;
          const current = currentNode as HTMLElement;
          const text = (current.innerText || '').trim();
          if (!text) continue;
          const matched = cmpTextMatchers.some((token) => text.includes(token));
          if (matched) {
            // Only target specific CMP containers, not body/footer
            const isCmpContainer =
              current.classList.contains('sp_message') ||
              current.id.includes('sp_message') ||
              current.getAttribute('role') === 'dialog';
            if (isCmpContainer) {
              collapseElement(current);
            }
          }
        }

        collapseCmpButton();
        ensureCmpStyle();
      };

      const sweep = () => {
        selectors.forEach((selector) => {
          try {
            document.querySelectorAll(selector).forEach((el) => neutralize(el));
          } catch {
            /* ignore bad selectors */
          }
        });

        document.querySelectorAll('iframe').forEach((frame) => {
          if (shouldNeutralizeIframe(frame)) {
            neutralize(frame);
          }
        });

        document.querySelectorAll('ins').forEach((insEl) => {
          if (insEl.querySelector('iframe')) {
            neutralize(insEl);
          }
        });

        collapseCmpArtifacts();
      };

      sweep();

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;

            if (node.tagName === 'IFRAME' && shouldNeutralizeIframe(node as HTMLIFrameElement)) {
              neutralize(node);
            }

            if (node.tagName === 'INS' && node.querySelector('iframe')) {
              neutralize(node);
            }

            selectors.forEach((selector) => {
              if (node.matches(selector)) {
                neutralize(node);
              }
            });

            node.querySelectorAll('iframe').forEach((childFrame) => {
              if (shouldNeutralizeIframe(childFrame)) {
                neutralize(childFrame);
              }
            });

            node.querySelectorAll(selectors.join(',')).forEach((child) => neutralize(child));
          });
        });

        collapseCmpArtifacts();
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 10000);
    },
    { selectors: AD_SELECTORS, cmpSelectors: CMP_SELECTORS, cmpTextMatchers: CMP_TEXT_MATCHERS },
  );

  await page.waitForTimeout(300);
}

/**
 * Normalize key visual elements so image-dependent areas do not collapse when assets fail to load.
 * Lock layout AFTER page stabilization, with !important overrides & dimension verification.
 */
export async function stabilizeVisualLayout(page: Page): Promise<void> {
  // Step 1: Inject high-specificity CSS with !important to override Bootstrap/inline styles
  try {
    await page.addStyleTag({
      content: `
      /* Carousel height lock - applies to all nested elements */
      .carousel-inner {
        min-height: 441px !important;
        max-height: 441px !important;
        height: 441px !important;
        overflow: hidden !important;
      }
      .carousel-inner .item {
        min-height: 441px !important;
        max-height: 441px !important;
        height: 441px !important;
        overflow: hidden !important;
        display: block !important;
      }
      .carousel-inner .item img {
        min-height: 441px !important;
        max-height: 441px !important;
        height: 441px !important;
        width: 100% !important;
        object-fit: cover !important;
        display: block !important;
      }

      /* Product card wrapper - strict box model */
      .product-image-wrapper {
        min-height: 426px !important;
        max-height: 426px !important;
        height: 426px !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        display: block !important;
      }
      .product-image-wrapper img {
        min-height: 426px !important;
        max-height: 426px !important;
        height: 426px !important;
        width: 100% !important;
        object-fit: cover !important;
        display: block !important;
      }

      /* Product info text */
      .productinfo img {
        min-height: 260px !important;
        height: 260px !important;
        display: block !important;
      }

      /* Prevent layout shift from margins/padding */
      .features_items > div {
        margin: 0 !important;
        padding: 0 !important;
      }
    `,
    });
  } catch (error) {
    console.warn(
      `CSS injection failed (CSP): ${error instanceof Error ? error.message : 'unknown'}`,
    );
  }

  // Step 2: Apply inline overrides for elements that may already have inline styles
  await page.evaluate(() => {
    const forceHeight = (selector: string, height: string) => {
      document.querySelectorAll(selector).forEach((el) => {
        const element = el as HTMLElement;
        element.style.setProperty('min-height', height, 'important');
        element.style.setProperty('max-height', height, 'important');
        element.style.setProperty('height', height, 'important');
        element.style.setProperty('overflow', 'hidden', 'important');
      });
    };

    forceHeight('.carousel-inner', '441px');
    forceHeight('.carousel-inner .item', '441px');
    forceHeight('.carousel-inner .item img', '441px');
    forceHeight('.product-image-wrapper', '426px');
    forceHeight('.product-image-wrapper img', '426px');
    forceHeight('.productinfo img', '260px');
  });

  // Step 3: Wait for layout to stabilize after CSS application
  await page.waitForTimeout(200);

  // Step 4: Verify actual rendered dimensions match expected
  const carouselCheck = await page.evaluate(() => {
    const el = document.querySelector('.carousel-inner');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { expected: 441, actual: Math.round(rect.height) };
  });

  const productCheck = await page.evaluate(() => {
    const el = document.querySelector('.product-image-wrapper');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { expected: 426, actual: Math.round(rect.height) };
  });

  // Step 5: If dimensions don't match, apply emergency re-lock (retry strategy)
  if (carouselCheck && carouselCheck.actual !== carouselCheck.expected) {
    await page.evaluate(() => {
      document
        .querySelectorAll('.carousel-inner, .carousel-inner .item, .carousel-inner .item img')
        .forEach((el) => {
          const element = el as HTMLElement;
          element.style.setProperty('height', '441px', 'important');
          element.style.setProperty('min-height', '441px', 'important');
          element.style.setProperty('max-height', '441px', 'important');
        });
    });
    await page.waitForTimeout(100);
  }

  if (productCheck && productCheck.actual !== productCheck.expected) {
    await page.evaluate(() => {
      document
        .querySelectorAll('.product-image-wrapper, .product-image-wrapper img')
        .forEach((el) => {
          const element = el as HTMLElement;
          element.style.setProperty('height', '426px', 'important');
          element.style.setProperty('min-height', '426px', 'important');
          element.style.setProperty('max-height', '426px', 'important');
        });
    });
    await page.waitForTimeout(100);
  }
}

/**
 * Stabilize product grid by pre-loading and decoding all images
 * Prevents height calculation issues on mobile browsers
 */
export async function stabilizeProductGrid(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Force eager loading of all product images
    const productImages = Array.from(
      document.querySelectorAll<HTMLImageElement>('.product-image-wrapper img, .productinfo img'),
    );

    // Wait for all images to fully decode
    await Promise.all(
      productImages.map(async (img) => {
        if (!img.complete) {
          await new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        }

        // Ensure image is decoded before proceeding
        if (img.decode) {
          try {
            await img.decode();
          } catch {
            // Ignore decode errors
          }
        }
      }),
    );

    // Disable lazy loading for consistency
    productImages.forEach((img) => {
      img.loading = 'eager';
    });
  });

  // Wait for layout to settle after all images loaded
  await page.waitForTimeout(200);
}

/**
 * Freeze the homepage carousel so we always capture the first slide.
 */
export async function freezeHomepageCarousel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const freezeCarousel = (selector: string) => {
      const carousel = document.querySelector(selector);
      if (!carousel) return;

      carousel.removeAttribute('data-ride');
      carousel.removeAttribute('data-interval');

      const ensureFirstSlide = () => {
        const inner = carousel.querySelector('.carousel-inner');
        if (!inner) return;

        const items = Array.from(inner.querySelectorAll('.item'));
        items.forEach((item, index) => {
          const element = item as HTMLElement;
          const isActive = index === 0;
          element.classList.toggle('active', isActive);
          element.style.display = isActive ? 'block' : 'none';
        });

        const indicators = carousel.querySelectorAll('.carousel-indicators li');
        indicators.forEach((indicator, index) => {
          indicator.classList.toggle('active', index === 0);
        });
      };

      ensureFirstSlide();

      const observer = new MutationObserver(() => ensureFirstSlide());
      observer.observe(carousel, { attributes: true, childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 4000);

      const style = document.createElement('style');
      style.textContent = `
        ${selector}, ${selector} * {
          animation-duration: 0s !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(style);
    };

    freezeCarousel('#slider-carousel');
    freezeCarousel('#recommended-item-carousel');
  });
}
