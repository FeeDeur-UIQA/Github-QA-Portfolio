/**
 * SMOKE METRICS REPORTER
 * Custom Playwright reporter that captures smoke test metrics across ALL workers.
 * Solves the parallel worker isolation problem by writing to a shared JSONL file.
 *
 * Architecture: Each worker appends metrics to smoke-metrics.jsonl
 * Dashboard generation reads all metrics after test run completes.
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

import { SmokeDashboardGenerator } from '../../tests/smoke/smoke-dashboard';
import type { SmokeMetrics } from '../../tests/smoke/smoke.utils';

export interface SmokeMetricEntry {
  testName: string;
  testId: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  duration: number;
  timestamp: string;
  browser: string;
  feature: 'health' | 'auth' | 'cart' | 'search' | 'discovery' | 'unknown';
  errors: string[];
  file: string;
  workerIndex: number;
  retryCount: number;
}

/**
 * Maps smoke test file names to feature categories
 */
function detectFeature(filePath: string): SmokeMetricEntry['feature'] {
  const fileName = path.basename(filePath).toLowerCase();

  if (fileName.includes('system-health') || fileName.includes('01-')) return 'health';
  if (fileName.includes('auth') || fileName.includes('02-')) return 'auth';
  if (fileName.includes('cart') || fileName.includes('04-')) return 'cart';
  if (fileName.includes('search') || fileName.includes('discovery') || fileName.includes('05-'))
    return 'search';

  return 'unknown';
}

class SmokeMetricsReporter implements Reporter {
  private metricsFile: string;
  private isSmokeSuite: boolean = false;

  constructor() {
    this.metricsFile = path.join(process.cwd(), 'smoke-metrics.jsonl');
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    // Detect if this run includes smoke tests
    const allTests = this.collectTests(suite);
    this.isSmokeSuite = allTests.some((t) => t.location.file.includes('.smoke.'));

    if (this.isSmokeSuite) {
      // Clear previous metrics file at start (only from first worker)
      const workerIndex = parseInt(process.env.PLAYWRIGHT_WORKER_INDEX || '0', 10);
      if (workerIndex === 0 && fs.existsSync(this.metricsFile)) {
        fs.unlinkSync(this.metricsFile);
      }
    }
  }

  private collectTests(suite: Suite): TestCase[] {
    const tests: TestCase[] = [];
    for (const child of suite.suites) {
      tests.push(...this.collectTests(child));
    }
    tests.push(...suite.tests);
    return tests;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Only track smoke tests
    if (!test.location.file.includes('.smoke.')) return;

    const metric: SmokeMetricEntry = {
      testName: test.title,
      testId: test.id,
      status: result.status,
      duration: result.duration,
      timestamp: new Date().toISOString(),
      browser: test.parent?.project()?.name || 'unknown',
      feature: detectFeature(test.location.file),
      errors: result.errors.map((e) => e.message || String(e)).slice(0, 3),
      file: path.basename(test.location.file),
      workerIndex: result.workerIndex,
      retryCount: result.retry,
    };

    // Append to JSONL file (atomic write per line)
    try {
      fs.appendFileSync(this.metricsFile, JSON.stringify(metric) + '\n');
    } catch (err) {
      console.error('[SmokeMetricsReporter] Failed to write metric:', err);
    }
  }

  onEnd(_result: FullResult): void {
    if (!this.isSmokeSuite) return;

    // Only generate dashboard from worker 0 after all tests complete
    const workerIndex = parseInt(process.env.PLAYWRIGHT_WORKER_INDEX || '0', 10);
    if (workerIndex !== 0) return;

    try {
      if (!fs.existsSync(this.metricsFile)) {
        console.log('[SmokeMetricsReporter] No smoke metrics collected.');
        return;
      }

      const lines = fs.readFileSync(this.metricsFile, 'utf-8').trim().split('\n');
      const rawMetrics = lines
        .filter((l) => l)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter((m): m is SmokeMetricEntry => m !== null && 'testId' in m);

      // Deduplicate by testId + browser (keep last attempt)
      const uniqueMetrics = new Map<string, SmokeMetricEntry>();
      for (const m of rawMetrics) {
        const key = `${m.testId}-${m.browser}`;
        uniqueMetrics.set(key, m); // Later entries (retries) overwrite earlier
      }

      const finalMetrics = Array.from(uniqueMetrics.values());
      const browsers = Array.from(new Set(finalMetrics.map((m) => m.browser)));

      console.log('\n' + '='.repeat(60));
      console.log('[SmokeMetricsReporter] SMOKE TEST SUMMARY');
      console.log('='.repeat(60));
      console.log(`  Total Tests: ${finalMetrics.length}`);
      console.log(`  Passed: ${finalMetrics.filter((m) => m.status === 'passed').length}`);
      console.log(`  Failed: ${finalMetrics.filter((m) => m.status === 'failed').length}`);
      console.log(`  Browsers: ${browsers.join(', ')}`);
      console.log('='.repeat(60) + '\n');

      // Convert to SmokeMetrics format for dashboard generator
      const smokeMetrics: SmokeMetrics[] = finalMetrics.map((m) => ({
        testName: m.testName,
        status: m.status === 'passed' ? 'passed' : m.status === 'failed' ? 'failed' : 'skipped',
        duration: m.duration,
        timestamp: new Date(m.timestamp),
        browser: m.browser,
        feature: m.feature === 'unknown' ? undefined : m.feature,
        errors: m.errors && m.errors.length > 0 ? m.errors : undefined,
      }));

      // Use existing dashboard generator for consistent HTML output
      const runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
      SmokeDashboardGenerator.generateDashboard(smokeMetrics, runId);

      console.log(`[SmokeMetricsReporter] Dashboard generated with ${finalMetrics.length} tests`);
    } catch (err) {
      console.error('[SmokeMetricsReporter] Dashboard generation failed:', err);
    }
  }
}

export default SmokeMetricsReporter;
