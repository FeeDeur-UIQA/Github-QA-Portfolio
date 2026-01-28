/**
 * Visual Regression Testing Budgets
 *
 * Defines per-component/per-page tolerance levels for visual diffs.
 * Enables precise failure detection and reduces false positives.
 *
 * Ratio: 0-1 normalized pixel difference (0.01 = 1% of pixels)
 * Pixels: Absolute pixel count threshold
 *
 * @usage
 * import { getVisualBudget } from './visual-budgets';
 * const budget = getVisualBudget('product-card');
 * if (diffPercentage > budget.ratio) {
 *   // Fail the test
 * }
 */

export interface VisualBudget {
  /** Ratio of differing pixels (0-1) */
  ratio: number;

  /** Absolute pixel count threshold */
  pixels: number;

  /** Component/page category */
  category: 'critical' | 'content' | 'media' | 'dynamic';

  /** Human-readable description */
  description: string;
}

/**
 * Component-level visual budgets
 *
 * Categories:
 * - critical: Core layout (navigation, headers, footers)
 * - content: Text & structured content (cards, forms, lists)
 * - media: Images & complex visuals
 * - dynamic: Frequently changing content (carousels, counters)
 */
export const VISUAL_BUDGETS: Record<string, VisualBudget> = {
  // Critical: Navigation & Layout (0-1% variance allowed)
  header: {
    ratio: 0.01,
    pixels: 100,
    category: 'critical',
    description: 'Main header/navigation bar - strict tolerance',
  },
  navigation: {
    ratio: 0.01,
    pixels: 100,
    category: 'critical',
    description: 'Navigation menu - strict tolerance',
  },
  footer: {
    ratio: 0.02,
    pixels: 150,
    category: 'critical',
    description: 'Footer section - nearly strict',
  },
  sidebar: {
    ratio: 0.01,
    pixels: 80,
    category: 'critical',
    description: 'Sidebar navigation - strict tolerance',
  },

  // Content: Product cards, forms, sections (3-5% variance allowed)
  'product-card': {
    ratio: 0.03,
    pixels: 300,
    category: 'content',
    description: 'Individual product card - moderate tolerance',
  },
  form: {
    ratio: 0.04,
    pixels: 400,
    category: 'content',
    description: 'Form container - input fields & labels',
  },
  'login-form': {
    ratio: 0.03,
    pixels: 250,
    category: 'content',
    description: 'Login/signup form - strict to moderate',
  },
  'product-grid': {
    ratio: 0.05,
    pixels: 1000,
    category: 'content',
    description: 'Product grid layout - moderate tolerance',
  },
  'cart-items': {
    ratio: 0.04,
    pixels: 500,
    category: 'content',
    description: 'Cart item list - moderate tolerance',
  },
  'checkout-form': {
    ratio: 0.03,
    pixels: 300,
    category: 'content',
    description: 'Checkout form - strict to moderate',
  },

  // Media: Hero, images, complex visuals (10-15% variance allowed)
  hero: {
    ratio: 0.1,
    pixels: 2000,
    category: 'media',
    description: 'Hero section - image-heavy, higher tolerance',
  },
  'hero-section': {
    ratio: 0.1,
    pixels: 2000,
    category: 'media',
    description: 'Hero carousel/section - higher tolerance',
  },
  banner: {
    ratio: 0.12,
    pixels: 1500,
    category: 'media',
    description: 'Promotional banner - image-heavy',
  },
  'image-gallery': {
    ratio: 0.15,
    pixels: 3000,
    category: 'media',
    description: 'Product image gallery - highest tolerance',
  },
  carousel: {
    ratio: 0.12,
    pixels: 2000,
    category: 'media',
    description: 'Image carousel - moderate-high tolerance',
  },

  // Dynamic: Frequently changing elements (15-20% variance allowed)
  'recommended-section': {
    ratio: 0.15,
    pixels: 2500,
    category: 'dynamic',
    description: 'Recommended items - dynamic content',
  },
  'trending-section': {
    ratio: 0.15,
    pixels: 2500,
    category: 'dynamic',
    description: 'Trending items - dynamic content',
  },
  'live-data': {
    ratio: 0.2,
    pixels: 3000,
    category: 'dynamic',
    description: 'Live updating data - highest tolerance',
  },

  // Full-page captures
  homepage: {
    ratio: 0.05,
    pixels: 5000,
    category: 'content',
    description: 'Full homepage - mixed content',
  },
  'products-page': {
    ratio: 0.06,
    pixels: 6000,
    category: 'content',
    description: 'Full products page - grid + filters',
  },
  'cart-page': {
    ratio: 0.05,
    pixels: 3000,
    category: 'content',
    description: 'Full cart page - list of items',
  },
  'checkout-page': {
    ratio: 0.04,
    pixels: 2000,
    category: 'content',
    description: 'Full checkout page - strict tolerance',
  },

  // Responsive layouts (per breakpoint)
  'mobile-layout': {
    ratio: 0.03,
    pixels: 500,
    category: 'content',
    description: 'Mobile (375px) layout',
  },
  'tablet-layout': {
    ratio: 0.04,
    pixels: 1000,
    category: 'content',
    description: 'Tablet (768px) layout',
  },
  'desktop-layout': {
    ratio: 0.05,
    pixels: 2000,
    category: 'content',
    description: 'Desktop (1920px) layout',
  },
};

/**
 * Get visual budget for a component
 * Falls back to default if exact match not found
 */
export function getVisualBudget(
  componentName: string,
  defaultBudget: VisualBudget = DEFAULT_BUDGET,
): VisualBudget {
  return VISUAL_BUDGETS[componentName] || defaultBudget;
}

/**
 * Check if diff is within budget
 */
export function isWithinBudget(
  diffPercentage: number,
  componentName: string,
  ignoreDefault = false,
): boolean {
  const budget = VISUAL_BUDGETS[componentName];

  if (!budget && ignoreDefault) {
    return false; // Fail if component not configured and strict mode
  }

  const threshold = budget?.ratio || DEFAULT_BUDGET.ratio;
  return diffPercentage <= threshold;
}

/**
 * Get violations for a failure
 */
export function getViolations(
  componentName: string,
  diffPercentage: number,
  diffPixels: number,
): { ratio: boolean; pixels: boolean } {
  const budget = getVisualBudget(componentName);

  return {
    ratio: diffPercentage > budget.ratio,
    pixels: diffPixels > budget.pixels,
  };
}

/**
 * Format budget for display
 */
export function formatBudget(budget: VisualBudget): string {
  return `${(budget.ratio * 100).toFixed(1)}% (~${budget.pixels} pixels)`;
}

/**
 * Get all budgets by category
 */
export function getBudgetsByCategory(
  category: 'critical' | 'content' | 'media' | 'dynamic',
): Record<string, VisualBudget> {
  return Object.fromEntries(
    Object.entries(VISUAL_BUDGETS).filter(([, budget]) => budget.category === category),
  );
}

/**
 * Default budget (used as fallback)
 * Moderate tolerance for unmapped components
 */
export const DEFAULT_BUDGET: VisualBudget = {
  ratio: 0.1,
  pixels: 1000,
  category: 'content',
  description: 'Default visual budget (unmapped component)',
};

/**
 * Summary of all budgets by category
 */
export function getBudgetSummary(): Record<string, { count: number; avgRatio: number }> {
  const categories = ['critical', 'content', 'media', 'dynamic'] as const;
  const summary: Record<string, { count: number; avgRatio: number }> = {};

  for (const category of categories) {
    const budgets = Object.values(getBudgetsByCategory(category));
    summary[category] = {
      count: budgets.length,
      avgRatio: budgets.reduce((sum, b) => sum + b.ratio, 0) / budgets.length,
    };
  }

  return summary;
}
