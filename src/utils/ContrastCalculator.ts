/**
 * ContrastCalculator Utility
 *
 * Provides WCAG 2.2 contrast ratio calculations and color utilities
 * Reference: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
 */

/**
 * Evaluate contrast for an element (browser context evaluation)
 * Returns calculated contrast ratio for text on its background
 * Designed to work with locator.evaluate()
 *
 * @param element - DOM element
 * @returns Contrast ratio
 */
export function evaluateElementContrast(element: HTMLElement): number {
  const styles = window.getComputedStyle(element);
  const color = styles.color;

  // Inline helper for parseRGB
  const parseRGB = (rgb: string): number[] => {
    const match = rgb.match(/\d+/g);
    return match ? match.slice(0, 3).map(Number) : [0, 0, 0];
  };

  // Inline helper for getLuminance
  const getLuminance = (rgb: number[]): number => {
    const [r, g, b] = rgb.map((val) => {
      const sRGB = val / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Get effective background color
  let bgColor = styles.backgroundColor;
  if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
    let parent = element.parentElement;
    while (parent && (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent')) {
      bgColor = window.getComputedStyle(parent).backgroundColor;
      parent = parent.parentElement;
    }
  }

  const textRGB = parseRGB(color);
  const bgRGB = parseRGB(bgColor);

  const lum1 = getLuminance(textRGB);
  const lum2 = getLuminance(bgRGB);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Evaluate border contrast (contrast between border and background)
 * Designed to work with locator.evaluate()
 *
 * @param element - DOM element
 * @returns Contrast ratio
 */
export function evaluateBorderContrast(element: HTMLElement): number {
  const styles = window.getComputedStyle(element);
  const borderColor = styles.borderColor || styles.borderTopColor;
  const bgColor = styles.backgroundColor;

  // Inline helper for parseRGB
  const parseRGB = (rgb: string): number[] => {
    const match = rgb.match(/\d+/g);
    return match ? match.slice(0, 3).map(Number) : [0, 0, 0];
  };

  // Inline helper for getLuminance
  const getLuminance = (rgb: number[]): number => {
    const [r, g, b] = rgb.map((val) => {
      const sRGB = val / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const borderRGB = parseRGB(borderColor);
  const bgRGB = parseRGB(bgColor);

  const lum1 = getLuminance(borderRGB);
  const lum2 = getLuminance(bgRGB);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA standard (4.5:1 for normal text)
 *
 * @param contrast - Contrast ratio
 * @returns True if meets AA standard
 */
export function meetsWCAG_AA(contrast: number): boolean {
  return contrast >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA standard (7:1 for normal text)
 *
 * @param contrast - Contrast ratio
 * @returns True if meets AAA standard
 */
export function meetsWCAG_AAA(contrast: number): boolean {
  return contrast >= 7.0;
}

/**
 * Check if contrast meets minimum practical standard (3:1)
 *
 * @param contrast - Contrast ratio
 * @returns True if meets minimum standard
 */
export function meetsMinimum(contrast: number): boolean {
  return contrast >= 3.0;
}

/**
 * Get human-readable compliance level
 *
 * @param contrast - Contrast ratio
 * @returns Compliance string
 */
export function getComplianceLevel(contrast: number): string {
  if (contrast >= 7.0) return 'AAA (excellent)';
  if (contrast >= 4.5) return 'AA (good)';
  if (contrast >= 3.0) return 'A (minimum)';
  return 'Failed';
}
