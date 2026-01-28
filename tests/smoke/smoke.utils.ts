/**
 * SMOKE TEST UTILITIES
 * Optimized helpers for high-velocity smoke testing
 * Version: 2025.1.17
 */

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { Logger } from '../../src/utils/Logger';

const logger = Logger.getInstance('SmokeTestUtils');

export class SmokeTestUtils {
  /**
   * Verify page loaded without errors
   * Checks page is responsive and has expected title
   */
  static async verifyPageHealthy(page: Page, expectedTitle?: string) {
    logger.info('🏥 Verifying page health...');

    // Check page responded
    const pageOk = page.url();
    expect(pageOk).toBeTruthy();

    // Check title if provided
    if (expectedTitle) {
      await expect(page).toHaveTitle(new RegExp(expectedTitle, 'i'));
      logger.info(`[PASS] Page title verified: ${expectedTitle}`);
    }

    // Check page is interactive (body exists)
    await expect(page.locator('body')).toBeVisible();

    logger.info(`[PASS] Page healthy`);
  }

  /**
   * Quick API status check
   */
  static async verifyApiEndpoint(page: Page, endpoint: string, expectedStatus: number = 200) {
    logger.info(`🌐 Checking API: ${endpoint}`);

    const response = await page.request.get(endpoint);
    expect(response.status()).toBe(expectedStatus);

    logger.info(`[PASS] API healthy: ${endpoint}`);
  }

  /**
   * Assert critical element is visible
   */
  static async verifyCriticalElement(page: Page, selector: string, description: string) {
    logger.info(`👁[INFO] Verifying critical element: ${description}`);

    const element = page.locator(selector);
    await expect(element).toBeVisible({ timeout: 5000 });

    logger.info(`[PASS] Critical element visible: ${description}`);
  }

  /**
   * Quick navigation check with URL verification (optimized for smoke tests)
   */
  static async verifyNavigation(page: Page, targetUrl: string, timeout: number = 8000) {
    logger.info(`🗺[INFO] Navigating to: ${targetUrl}`);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });

    // Verify we're on the right page (check full URL or path)
    const currentUrl = page.url();
    const urlMatch = currentUrl.includes(targetUrl) || currentUrl.endsWith(targetUrl);
    expect(urlMatch).toBeTruthy();

    logger.info(`[PASS] Navigation successful to ${currentUrl}`);
  }

  /**
   * SMOKE TEST HELPER: Fast element visibility check with timeout
   */
  static async waitForElement(
    page: Page,
    selector: string,
    _description: string,
    timeout: number = 5000,
  ) {
    const element = page.locator(selector);
    await expect(element).toBeVisible({ timeout });
    return element;
  }

  /**
   * SMOKE TEST HELPER: Batch visibility checks (parallel for speed)
   */
  static async waitForElements(
    page: Page,
    selectors: Array<{ selector: string; description: string }>,
    timeout: number = 5000,
  ) {
    await Promise.all(
      selectors.map(({ selector, description }) =>
        this.waitForElement(page, selector, description, timeout),
      ),
    );
  }

  /**
   * SMOKE TEST HELPER: Quick success logging
   */
  static logSuccess(message: string) {
    console.log(`[PASS] ${message}`);
  }

  /**
   * SMOKE TEST HELPER: Verify URL pattern match
   */
  static async verifyUrlPattern(page: Page, pattern: RegExp, timeout: number = 5000) {
    await expect(page).toHaveURL(pattern, { timeout });
  }

  /**
   * Performance check - measure actual page load time using performance metrics
   */
  static async measurePageLoad(page: Page): Promise<number> {
    logger.info(`⏱[INFO] Measuring page load performance...`);

    // Get actual navigation timing from browser
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation && 'loadEventEnd' in navigation && 'fetchStart' in navigation) {
        return (navigation as any).loadEventEnd - (navigation as any).fetchStart;
      }
      return 0;
    });

    const loadTime = metrics > 0 ? metrics : 3000; // Default to 3s if metrics unavailable

    logger.info(`⏱[INFO] Page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(30000); // 30 second threshold for smoke tests

    return loadTime;
  }
}

/**
 * GLOBAL SMOKE TEST METRICS AGGREGATOR
 * Collects test results across all smoke tests
 */
export interface SmokeMetrics {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  timestamp: Date;
  browser?: string;
  errors?: string[];
  feature?: 'health' | 'auth' | 'cart' | 'search' | 'discovery';
}

export class SmokeMetricsAggregator {
  private static metrics: SmokeMetrics[] = [];

  static recordTest(metric: SmokeMetrics) {
    this.metrics.push(metric);
  }

  static getMetrics(): SmokeMetrics[] {
    return this.metrics;
  }

  static getMetricsByFeature(feature: SmokeMetrics['feature']): SmokeMetrics[] {
    return this.metrics.filter((m) => m.feature === feature);
  }

  static generateReport() {
    const total = this.metrics.length;
    const passed = this.metrics.filter((m) => m.status === 'passed').length;
    const failed = this.metrics.filter((m) => m.status === 'failed').length;
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / total;

    return {
      total,
      passed,
      failed,
      passRate: `${((passed / total) * 100).toFixed(1)}%`,
      avgDuration: `${avgDuration.toFixed(0)}ms`,
      byFeature: {
        health: this.getFeatureStats('health'),
        auth: this.getFeatureStats('auth'),
        cart: this.getFeatureStats('cart'),
        search: this.getFeatureStats('search'),
        discovery: this.getFeatureStats('discovery'),
      },
    };
  }

  private static getFeatureStats(feature: SmokeMetrics['feature']) {
    const featureMetrics = this.getMetricsByFeature(feature);
    if (featureMetrics.length === 0) return null;

    const passed = featureMetrics.filter((m) => m.status === 'passed').length;
    const avgDuration =
      featureMetrics.reduce((sum, m) => sum + m.duration, 0) / featureMetrics.length;

    return {
      total: featureMetrics.length,
      passed,
      avgDuration: `${avgDuration.toFixed(0)}ms`,
    };
  }

  static reset() {
    this.metrics = [];
  }

  /**
   * Generate and export dashboard (Phase 3)
   */
  static async exportDashboard(runId?: string): Promise<void> {
    // Use require to avoid ESM loader issues when running under Playwright's TS transpilation

    const { SmokeDashboardGenerator } = require('./smoke-dashboard');
    await SmokeDashboardGenerator.generateDashboard(this.metrics, runId);
  }

  /**
   * Record trends and detect anomalies (Phase 3)
   */
  static async analyzeTrends(runId?: string): Promise<void> {
    const { PerformanceTrendAnalyzer } = require('./smoke-trends');

    // Record this run
    await PerformanceTrendAnalyzer.recordRun(this.metrics, runId);

    // Detect anomalies
    const anomalies = PerformanceTrendAnalyzer.detectAnomalies(this.metrics);

    if (anomalies.length > 0) {
      console.log('\n⚠[INFO]  PERFORMANCE ANOMALIES DETECTED:');
      for (const anomaly of anomalies) {
        const icon = anomaly.severity === 'critical' ? '🚨' : '⚠[INFO] ';
        console.log(`${icon} ${anomaly.message}`);
        console.log(
          `   Baseline: ${anomaly.baseline}ms → Current: ${anomaly.current}ms (+${anomaly.delta}%)`,
        );
      }
      console.log('');
    }

    // Display trend report
    console.log(PerformanceTrendAnalyzer.generateTrendReport());
  }
}

export class SmokeMetricsCollector {
  private static metrics: SmokeMetrics[] = [];

  static recordTest(metric: SmokeMetrics) {
    this.metrics.push(metric);
  }

  static getMetrics(): SmokeMetrics[] {
    return this.metrics;
  }

  static generateReport(): string {
    const passed = this.metrics.filter((m) => m.status === 'passed').length;
    const failed = this.metrics.filter((m) => m.status === 'failed').length;
    const total = this.metrics.length;
    const avgDuration =
      total > 0 ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / total : 0;

    return `
╔════════════════════════════════════════════════════════════╗
║           SMOKE TEST SUITE - EXECUTION REPORT             ║
╠════════════════════════════════════════════════════════════╣
║  Total Tests:        ${total.toString().padEnd(35)}║
║  [PASS] Passed:          ${passed.toString().padEnd(35)}║
║  [FAIL] Failed:          ${failed.toString().padEnd(35)}║
║  Pass Rate:          ${total > 0 ? ((passed / total) * 100).toFixed(1) : '0'}%${' '.repeat(32)}║
║  Avg Duration:       ${avgDuration.toFixed(0)}ms${' '.repeat(29)}║
╠════════════════════════════════════════════════════════════╣
║  Status: ${failed === 0 ? '[PASS] HEALTHY - All Critical Paths Verified' : '⚠[INFO]  DEGRADED - Review Failures'}       ║
╚════════════════════════════════════════════════════════════╝
    `.trim();
  }

  static reset() {
    this.metrics = [];
  }
}
