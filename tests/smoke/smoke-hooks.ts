/**
 * SMOKE TEST GLOBAL HOOKS
 * Automatically generate dashboard and trends after smoke test runs
 * Version: 2025.1.17 - Phase 3
 */

import { expect, test as base } from '../../src/support/page-fixtures';

import { SmokeMetricsAggregator } from './smoke.utils';

// Track registered files and emit once after the last smoke file finishes
let pendingAfterAll = 0;
let hooksInitialized = false;

/**
 * Register per-file smoke hooks. Call at the top of each smoke spec.
 * Dashboard/trend emission runs only once, after the final smoke file.
 */
export function registerSmokeHooks() {
  pendingAfterAll += 1;

  // Prevent multiple hook registrations per file reload
  if (hooksInitialized) return;
  hooksInitialized = true;

  base.afterAll(async () => {
    pendingAfterAll -= 1;
    const metrics = SmokeMetricsAggregator.getMetrics();

    console.log(
      `\n[smoke-hooks] afterAll invoked. Metrics collected: ${metrics.length}. Pending files: ${pendingAfterAll}\n`,
    );

    // Only emit once the last smoke file completes
    // Emit only once per suite and only from worker 0 to avoid duplicates in sharded/parallel runs
    const isPrimaryWorker =
      process.env.PLAYWRIGHT_WORKER_INDEX === '0' ||
      process.env.PLAYWRIGHT_WORKER_INDEX === undefined;
    if (pendingAfterAll > 0 || !isPrimaryWorker) return;

    if (metrics.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('[INFO] SMOKE TEST SUITE COMPLETE - Generating Reports...');
      console.log('='.repeat(60) + '\n');

      // Generate summary report
      const report = SmokeMetricsAggregator.generateReport();
      console.log('SUMMARY:');
      console.log(`  Total: ${report.total}`);
      console.log(`  Passed: ${report.passed}`);
      console.log(`  Failed: ${report.failed}`);
      console.log(`  Pass Rate: ${report.passRate}`);
      console.log(`  Avg Duration: ${report.avgDuration}\n`);

      // Generate dashboard (Phase 3)
      try {
        const runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
        await SmokeMetricsAggregator.exportDashboard(runId);
        await SmokeMetricsAggregator.analyzeTrends(runId);
      } catch (_error) {
        console.log('Note: Dashboard generation skipped in test mode');
      }

      console.log('='.repeat(60) + '\n');
    }
  });
}

// Re-export test and expect so smoke specs keep the same ergonomics
export { base as test, expect };
