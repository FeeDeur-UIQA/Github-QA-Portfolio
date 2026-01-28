/**
 * Load Test Utilities
 * 
 * Shared helper functions for k6 load tests
 */

/**
 * Generate random think time based on user behavior
 */
export function thinkTime(min: number = 1, max: number = 3): number {
  return min + Math.random() * (max - min);
}

/**
 * Generate random email for load test users
 */
export function generateEmail(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `loadtest_${timestamp}_${random}@example.com`;
}

/**
 * Generate random username
 */
export function generateUsername(): string {
  const adjectives = ['Happy', 'Quick', 'Clever', 'Bright', 'Swift'];
  const nouns = ['Tester', 'User', 'Shopper', 'Buyer', 'Customer'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

/**
 * Select random item from array
 */
export function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

/**
 * Calculate percentile from sorted array
 */
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * (p / 100)) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Sleep with jitter for realistic behavior
 */
export function sleepWithJitter(base: number, jitter: number = 0.2): number {
  const min = base * (1 - jitter);
  const max = base * (1 + jitter);
  return min + Math.random() * (max - min);
}

/**
 * Retry logic with exponential backoff
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export function calculateBackoffDelay(
  attemptNumber: number,
  config: RetryConfig
): number {
  const delay = Math.min(
    config.initialDelay * Math.pow(config.backoffMultiplier, attemptNumber),
    config.maxDelay
  );
  return delay;
}

/**
 * Common search terms for e-commerce
 */
export const commonSearchTerms = [
  'tshirt',
  'dress',
  'jeans',
  'shirt',
  'top',
  'pants',
  'shoes',
  'jacket',
  'sweater',
  'shorts',
  'skirt',
  'saree',
  'blue',
  'red',
  'black',
  'white',
  'men',
  'women',
  'kids',
  'casual',
  'formal',
  'fancy',
  'cotton',
];

/**
 * Product categories
 */
export const categories = [
  'Women',
  'Men',
  'Kids',
  'Dress',
  'Tops',
  'Saree',
  'Tshirt',
  'Jeans',
];
