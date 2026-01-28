import { apiTest, expect } from '../../fixtures/api-fixtures';
import { Logger } from '../../src/utils/Logger';
import { PerformanceMetrics } from '../../src/utils/PerformanceMetrics';

/**
 * TC-API07: API Performance SLOs
 *
 * Validates API performance against Service Level Objectives
 * Tracks P50, P95, P99 percentiles for regression detection
 * Ensures consistent performance under normal load
 *
 * @category API Testing
 * @priority Critical
 */

apiTest.describe('TC-API07: Performance SLOs @api @performance @critical @audit', () => {
  let logger: Logger;

  apiTest.beforeEach(() => {
    logger = Logger.getInstance('TC-API07_PerformanceSLOs');
  });

  apiTest('should meet ProductsList endpoint SLOs @api @performance', async ({ apiClient }) => {
    const metrics = new PerformanceMetrics();
    const sampleSize = 20; // Reasonable for CI environment

    await apiTest.step(`Collect ${sampleSize} performance samples`, async () => {
      logger.info(`🔄 Running ${sampleSize} requests to establish baseline...`);

      for (let i = 0; i < sampleSize; i++) {
        const startTime = Date.now();
        const response = await apiClient.getProductsList();
        const duration = Date.now() - startTime;

        expect(response.status).toBe(200);
        metrics.record(duration);

        if ((i + 1) % 5 === 0) {
          logger.info(`  ✓ Completed ${i + 1}/${sampleSize} requests`);
        }
      }
    });

    await apiTest.step('Validate SLO thresholds', async () => {
      const slo = {
        p50: 800, // Median response time < 800ms
        p95: 1500, // 95th percentile < 1500ms
        p99: 2500, // 99th percentile < 2500ms
        mean: 1000, // Average < 1000ms
      };

      const validation = metrics.validateSLO(slo);

      logger.info('\n📊 Performance Metrics:\n' + metrics.format());

      if (!validation.passed) {
        logger.error('\n❌ SLO Violations:');
        validation.violations.forEach((violation) => logger.error(`  • ${violation}`));
      } else {
        logger.info('\n✅ All SLOs met!');
      }

      expect(
        validation.passed,
        `SLO violations detected:\n${validation.violations.join('\n')}`,
      ).toBe(true);
    });

    await apiTest.step('Verify consistent performance', async () => {
      const snapshot = metrics.snapshot();
      const variability = (snapshot.max - snapshot.min) / snapshot.mean;

      // Ensure low variability (max 300% of mean indicates stability)
      expect(variability).toBeLessThan(3.0);

      logger.info(`📈 Performance variability: ${(variability * 100).toFixed(1)}%`);
    });
  });

  apiTest('should meet BrandsList endpoint SLOs @api @performance', async ({ apiClient }) => {
    const metrics = new PerformanceMetrics();
    const sampleSize = 15;

    await apiTest.step(`Collect ${sampleSize} performance samples`, async () => {
      for (let i = 0; i < sampleSize; i++) {
        const startTime = Date.now();
        const response = await apiClient.getBrandsList();
        const duration = Date.now() - startTime;

        expect(response.status).toBe(200);
        metrics.record(duration);
      }
    });

    await apiTest.step('Validate SLO thresholds', async () => {
      const slo = {
        p50: 600, // Faster than products (smaller dataset)
        p95: 1200,
        p99: 2000,
      };

      const validation = metrics.validateSLO(slo);
      logger.info('\n📊 BrandsList Metrics:\n' + metrics.format());

      expect(validation.passed).toBe(true);
    });
  });

  apiTest('should meet SearchProducts endpoint SLOs @api @performance', async ({ apiClient }) => {
    const metrics = new PerformanceMetrics();
    const sampleSize = 15;
    const searchTerms = ['shirt', 'jeans', 'dress', 'top', 'shoes'];

    await apiTest.step(`Collect ${sampleSize} search performance samples`, async () => {
      for (let i = 0; i < sampleSize; i++) {
        const searchTerm = searchTerms[i % searchTerms.length];
        const startTime = Date.now();
        const response = await apiClient.searchProducts({ search_product: searchTerm });
        const duration = Date.now() - startTime;

        expect(response.status).toBe(200);
        metrics.record(duration);
      }
    });

    await apiTest.step('Validate SLO thresholds', async () => {
      const slo = {
        p50: 1000, // Search typically slower (filtering)
        p95: 2000,
        p99: 3000,
        mean: 1500,
      };

      const validation = metrics.validateSLO(slo);
      logger.info('\n📊 SearchProducts Metrics:\n' + metrics.format());

      if (!validation.passed) {
        logger.warn('⚠️  Search performance degraded, consider indexing optimization');
      }

      expect(validation.passed).toBe(true);
    });
  });

  apiTest(
    'should detect performance regression over time @api @performance',
    async ({ apiClient }) => {
      await apiTest.step('Establish baseline performance', async () => {
        const baseline = new PerformanceMetrics();
        const current = new PerformanceMetrics();

        // Warm-up phase: discard first 3 requests (connection pool, DNS, TLS)
        logger.info('🔥 Warming up connection pool...');
        for (let i = 0; i < 3; i++) {
          await apiClient.getProductsList();
        }

        // Collect baseline with larger sample size for statistical validity
        logger.info('📊 Collecting baseline performance data (n=20)...');
        for (let i = 0; i < 20; i++) {
          const startTime = Date.now();
          await apiClient.getProductsList();
          baseline.record(Date.now() - startTime);
        }

        const baselineSnapshot = baseline.snapshot();
        logger.info(
          `📈 Baseline established: P50=${baselineSnapshot.p50}ms, P95=${baselineSnapshot.p95}ms, P99=${baselineSnapshot.p99}ms`,
        );

        await apiTest.step('Simulate load and verify no degradation', async () => {
          // Small delay to simulate real-world gap between baseline and current measurements
          await new Promise((resolve) => setTimeout(resolve, 1000));

          logger.info('📊 Collecting current performance data (n=20)...');
          for (let i = 0; i < 20; i++) {
            const startTime = Date.now();
            await apiClient.getProductsList();
            current.record(Date.now() - startTime);
          }

          const currentSnapshot = current.snapshot();
          logger.info(
            `📈 Current metrics: P50=${currentSnapshot.p50}ms, P95=${currentSnapshot.p95}ms, P99=${currentSnapshot.p99}ms`,
          );

          // Use P50 (median) for regression - more stable than P95
          // Allow 100% variance due to external factors (network, server load)
          const regressionP50 =
            (currentSnapshot.p50 - baselineSnapshot.p50) / baselineSnapshot.p50;
          const regressionP95 =
            (currentSnapshot.p95 - baselineSnapshot.p95) / baselineSnapshot.p95;

          logger.info(`📊 Regression Analysis:`);
          logger.info(`   P50 change: ${(regressionP50 * 100).toFixed(1)}%`);
          logger.info(`   P95 change: ${(regressionP95 * 100).toFixed(1)}%`);

          // Soft check: P50 degradation > 100% indicates significant issue
          // This is lenient for demo purposes; production should use 30-50%
          if (regressionP50 > 1.0) {
            logger.warn(
              `⚠️  Performance degraded by ${(regressionP50 * 100).toFixed(1)}% (P50) - investigate if consistent`,
            );
          }

          // For portfolio: document that we're aware of variance in test environments
          // In production, this would compare against stored historical baselines
          expect(
            regressionP50,
            `P50 regression (${(regressionP50 * 100).toFixed(1)}%) exceeds threshold. ` +
              `Baseline: ${baselineSnapshot.p50}ms, Current: ${currentSnapshot.p50}ms. ` +
              `Note: High threshold (100%) used due to test environment variance.`,
          ).toBeLessThan(1.0);

          logger.info('✅ Performance regression check passed');
        });
      });
    },
  );

  apiTest(
    'should handle concurrent requests efficiently @api @performance',
    async ({ apiClient }) => {
      await apiTest.step('Execute concurrent requests', async () => {
        const concurrency = 5;
        const metrics = new PerformanceMetrics();

        const requests = Array.from({ length: concurrency }, async () => {
          const startTime = Date.now();
          const response = await apiClient.getProductsList();
          const duration = Date.now() - startTime;

          expect(response.status).toBe(200);
          return duration;
        });

        const durations = await Promise.all(requests);
        durations.forEach((d) => metrics.record(d));

        const snapshot = metrics.snapshot();

        // Concurrent requests shouldn't be significantly slower
        expect(snapshot.p95).toBeLessThan(2000);

        logger.info(`📊 Concurrent performance (${concurrency} parallel):\n` + metrics.format());
      });
    },
  );
});
