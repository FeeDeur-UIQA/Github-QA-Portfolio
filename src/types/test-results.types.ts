/**
 * Test Results Type Definitions
 * Provides type-safe interfaces for all test report data
 */

/**
 * Test execution summary statistics (legacy format)
 */
export interface TestSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
}

/**
 * Playwright JSON reporter stats structure
 * @see https://playwright.dev/docs/test-reporters#json-reporter
 */
export interface PlaywrightStats {
  startTime: string;
  duration: number;
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
}

/**
 * Playwright JSON report structure (actual format from merge-reports --reporter=json)
 */
export interface PlaywrightResults {
  config?: Record<string, unknown>;
  suites?: unknown[];
  stats: PlaywrightStats;
  // Legacy support - some local runs may use this format
  summary?: TestSummary;
}

/**
 * API response structure for test API calls
 */
export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface APIResponse {
  responseCode: number;
  products: Product[];
}

/**
 * Individual test run record
 */
export interface TestRunRecord {
  browser: string;
  timestamp: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  reportPath: string;
  screenshots: string[];
  commit: string;
  branch: string;
  testType: 'smoke' | 'e2e' | 'unknown';
}

/**
 * Historical trend data
 */
export interface TrendMetrics {
  passRate: number[];
  avgDuration: number[];
  timestamps: string[];
}

/**
 * Complete historical data storage
 */
export interface HistoricalData {
  runs: TestRunRecord[];
  trends: TrendMetrics;
}
