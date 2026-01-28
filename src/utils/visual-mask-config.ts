/**
 * Dynamic Content Masking Configuration
 *
 * Centralized configuration for masking dynamic elements in visual tests.
 * Prevents false positives from content that changes frequently.
 *
 * @usage
 * import { getMaskSelectorsForPage } from './visual-mask-config';
 * const selectors = getMaskSelectorsForPage('homepage');
 */

export interface MaskConfig {
  /**
   * CSS selectors for elements to mask
   */
  selectors: string[];

  /**
   * Description of what is being masked
   */
  description: string;

  /**
   * Whether this mask is enabled by default
   */
  enabled: boolean;
}

export interface PageMaskConfig {
  [key: string]: Record<string, MaskConfig>;
}

/**
 * Global masks applied to all pages
 */
export const GLOBAL_MASKS: Record<string, MaskConfig> = {
  timestamps: {
    selectors: [
      '[class*="timestamp"]',
      '[class*="time-stamp"]',
      '[class*="datetime"]',
      '[class*="date-time"]',
      '[id*="timestamp"]',
      '[data-testid*="timestamp"]',
      'time',
      '[datetime]',
    ],
    description: 'Timestamp and date-time elements',
    enabled: true,
  },

  counters: {
    selectors: [
      '[class*="counter"]',
      '[class*="count"]',
      '[class*="views"]',
      '[class*="likes"]',
      '[data-count]',
    ],
    description: 'Counter and dynamic number displays',
    enabled: true,
  },

  ads: {
    selectors: [
      '.advertisement',
      '.ad-banner',
      '.ad-container',
      '[class*="ad-"]',
      '[class*="advert"]',
      'iframe[src*="ads"]',
      'iframe[src*="doubleclick"]',
      'iframe[src*="googlesyndication"]',
    ],
    description: 'Advertisement and sponsored content',
    enabled: true,
  },

  thirdPartyWidgets: {
    selectors: [
      '[class*="widget-"]',
      '[class*="social-share"]',
      '[class*="chat-widget"]',
      'iframe[src*="facebook"]',
      'iframe[src*="twitter"]',
      'iframe[src*="instagram"]',
    ],
    description: 'Third-party widgets and social media embeds',
    enabled: true,
  },

  liveData: {
    selectors: [
      '[class*="ticker"]',
      '[class*="live-"]',
      '[class*="real-time"]',
      '[data-live]',
      '[data-refresh]',
    ],
    description: 'Live data and real-time updates',
    enabled: true,
  },

  animations: {
    selectors: [
      '[class*="carousel"]',
      '[class*="slider"]',
      '[class*="animated"]',
      '[class*="rotate"]',
    ],
    description: 'Animated carousels and sliders',
    enabled: false, // Can be enabled per-test
  },

  userGeneratedContent: {
    selectors: ['[class*="comment"]', '[class*="review"]', '[class*="user-content"]'],
    description: 'User-generated content areas',
    enabled: false, // Usually want to test this
  },
};

/**
 * Page-specific mask configurations
 */
export const PAGE_SPECIFIC_MASKS: PageMaskConfig = {
  homepage: {
    heroCarousel: {
      selectors: ['.carousel-inner', '.hero-slider'],
      description: 'Homepage hero carousel',
      enabled: true,
    },
    featuredProducts: {
      selectors: ['[class*="featured-"]', '[class*="trending-"]'],
      description: 'Featured and trending sections',
      enabled: false,
    },
    consentModals: {
      selectors: [
        '[class*="consent"]',
        '.cm',
        '[data-cc*="consent"]',
        '.cookieconsent',
        '[id*="consent"]',
        'button:has-text("Consent")',
      ],
      description: 'Cookie consent modals and overlays',
      enabled: true,
    },
  },

  products: {
    dynamicPricing: {
      selectors: ['[class*="discount"]', '[class*="sale"]', '[class*="price-strike"]'],
      description: 'Dynamic pricing and discount badges',
      enabled: true,
    },
  },

  productPage: {
    stockCount: {
      selectors: ['[class*="stock"]', '[class*="inventory"]', '[class*="availability"]'],
      description: 'Product stock information',
      enabled: true,
    },
    reviewDates: {
      selectors: ['.review-date', '[class*="review-time"]'],
      description: 'Product review dates',
      enabled: true,
    },
  },

  cart: {
    cartTotal: {
      selectors: ['[class*="total"]', '[class*="subtotal"]'],
      description: 'Cart total calculations',
      enabled: false, // Usually want to test totals
    },
  },

  checkout: {
    orderNumber: {
      selectors: ['[class*="order-number"]', '[class*="order-id"]'],
      description: 'Generated order numbers',
      enabled: true,
    },
  },
};

/**
 * Get all enabled mask selectors for a specific page
 */
export function getMaskSelectorsForPage(
  pageName?: string,
  includeGlobal: boolean = true,
): string[] {
  const selectors: string[] = [];

  // Add global masks
  if (includeGlobal) {
    Object.values(GLOBAL_MASKS).forEach((mask) => {
      if (mask.enabled) {
        selectors.push(...mask.selectors);
      }
    });
  }

  // Add page-specific masks
  if (pageName && PAGE_SPECIFIC_MASKS[pageName]) {
    Object.values(PAGE_SPECIFIC_MASKS[pageName]).forEach((mask) => {
      if (mask.enabled) {
        selectors.push(...mask.selectors);
      }
    });
  }

  return [...new Set(selectors)]; // Remove duplicates
}

/**
 * Get mask selectors for ads and third-party content only
 */
export function getAdMaskSelectors(): string[] {
  return [...GLOBAL_MASKS.ads.selectors, ...GLOBAL_MASKS.thirdPartyWidgets.selectors];
}

/**
 * Get mask selectors for time-based content only
 */
export function getTimeMaskSelectors(): string[] {
  return [...GLOBAL_MASKS.timestamps.selectors, ...GLOBAL_MASKS.liveData.selectors];
}

/**
 * Create custom mask configuration for a specific test
 */
export function createCustomMasks(
  additionalSelectors: string[],
  baseConfig: 'minimal' | 'standard' | 'aggressive' = 'standard',
): string[] {
  let baseSelectors: string[] = [];

  switch (baseConfig) {
    case 'minimal':
      baseSelectors = getTimeMaskSelectors();
      break;
    case 'standard':
      baseSelectors = getMaskSelectorsForPage();
      break;
    case 'aggressive':
      baseSelectors = [
        ...getMaskSelectorsForPage(),
        ...GLOBAL_MASKS.animations.selectors,
        ...GLOBAL_MASKS.userGeneratedContent.selectors,
      ];
      break;
  }

  return [...new Set([...baseSelectors, ...additionalSelectors])];
}

/**
 * Helper to create page-specific mask configuration at runtime
 */
export function configureMasksForTest(options: {
  page?: string;
  includeGlobal?: boolean;
  additionalSelectors?: string[];
  excludeCategories?: string[];
}): string[] {
  const { page, includeGlobal = true, additionalSelectors = [], excludeCategories = [] } = options;

  let selectors = getMaskSelectorsForPage(page, includeGlobal);

  // Remove excluded categories
  if (excludeCategories.length > 0) {
    const excludedSelectors = excludeCategories.flatMap((category) => {
      const mask = GLOBAL_MASKS[category];
      return mask ? mask.selectors : [];
    });

    selectors = selectors.filter((s) => !excludedSelectors.includes(s));
  }

  // Add additional selectors
  selectors.push(...additionalSelectors);

  return [...new Set(selectors)];
}
