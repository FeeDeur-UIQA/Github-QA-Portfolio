/**
 * SLO (Service Level Objective) Metrics Utilities
 *
 * Provides consistent performance tracking and reporting across load tests.
 * Tracks percentiles, error rates, and throughput to measure against service goals.
 */

import { Trend, Rate, Counter } from 'k6/metrics';

/**
 * Standard SLO thresholds for API performance
 */
export interface SLOThresholds {
  p50: number; // 50th percentile (median)
  p95: number; // 95th percentile
  p99: number; // 99th percentile
  errorRate: number; // Maximum acceptable error rate (0-1)
  minThroughput?: number; // Minimum requests per second
}

/**
 * Default SLO targets for typical web APIs
 */
export const DEFAULT_API_SLOS: SLOThresholds = {
  p50: 200, // 200ms median response
  p95: 500, // 500ms for 95% of requests
  p99: 1000, // 1s for 99% of requests
  errorRate: 0.01, // 1% error rate maximum
};

/**
 * Stricter SLOs for critical user-facing endpoints
 */
export const CRITICAL_API_SLOS: SLOThresholds = {
  p50: 150,
  p95: 300,
  p99: 500,
  errorRate: 0.005, // 0.5% error rate
};

/**
 * More lenient SLOs for heavy operations
 */
export const HEAVY_OPERATION_SLOS: SLOThresholds = {
  p50: 500,
  p95: 2000,
  p99: 3000,
  errorRate: 0.02, // 2% error rate
};

/**
 * SLO Metrics Tracker
 *
 * Tracks response times and errors against defined SLO targets
 */
export class SLOMetrics {
  public duration: Trend;
  public errors: Rate;
  public successful: Counter;
  public failed: Counter;
  private name: string;
  private slos: SLOThresholds;

  constructor(name: string, slos: SLOThresholds = DEFAULT_API_SLOS) {
    this.name = name;
    this.slos = slos;

    // Initialize k6 custom metrics
    this.duration = new Trend(`${name}_duration`);
    this.errors = new Rate(`${name}_errors`);
    this.successful = new Counter(`${name}_successful`);
    this.failed = new Counter(`${name}_failed`);
  }

  /**
   * Record a successful request
   */
  recordSuccess(durationMs: number): void {
    this.duration.add(durationMs);
    this.errors.add(0);
    this.successful.add(1);
  }

  /**
   * Record a failed request
   */
  recordFailure(durationMs?: number): void {
    if (durationMs !== undefined) {
      this.duration.add(durationMs);
    }
    this.errors.add(1);
    this.failed.add(1);
  }

  /**
   * Get k6 threshold configuration based on SLO targets
   */
  getThresholds(): Record<string, string[]> {
    return {
      [`${this.name}_duration`]: [
        `p(50)<${this.slos.p50}`,
        `p(95)<${this.slos.p95}`,
        `p(99)<${this.slos.p99}`,
      ],
      [`${this.name}_errors`]: [`rate<${this.slos.errorRate}`],
    };
  }

  /**
   * Get the SLO configuration
   */
  getSLOs(): SLOThresholds {
    return { ...this.slos };
  }
}

/**
 * Create thresholds object for k6 options from multiple SLO metrics
 */
export function buildThresholds(...metrics: SLOMetrics[]): Record<string, string[]> {
  const thresholds: Record<string, string[]> = {};

  for (const metric of metrics) {
    Object.assign(thresholds, metric.getThresholds());
  }

  // Add global HTTP thresholds
  thresholds['http_req_failed'] = ['rate<0.05']; // 5% global error rate max

  return thresholds;
}

/**
 * Performance bucket classification
 */
export enum PerformanceBucket {
  FAST = 'fast', // Under p50 threshold
  GOOD = 'good', // Between p50 and p95
  SLOW = 'slow', // Between p95 and p99
  CRITICAL = 'critical', // Over p99 threshold
}

/**
 * Classify a response time into performance bucket
 */
export function classifyPerformance(durationMs: number, slos: SLOThresholds): PerformanceBucket {
  if (durationMs < slos.p50) return PerformanceBucket.FAST;
  if (durationMs < slos.p95) return PerformanceBucket.GOOD;
  if (durationMs < slos.p99) return PerformanceBucket.SLOW;
  return PerformanceBucket.CRITICAL;
}

/**
 * Calculate availability percentage from success/failure counts
 */
export function calculateAvailability(successful: number, failed: number): number {
  const total = successful + failed;
  if (total === 0) return 100;
  return (successful / total) * 100;
}

/**
 * Format SLO metrics for logging
 */
export function formatSLOReport(name: string, slos: SLOThresholds): string {
  return [
    `\n=== SLO Targets for ${name} ===`,
    `  P50 (median):  < ${slos.p50}ms`,
    `  P95:          < ${slos.p95}ms`,
    `  P99:          < ${slos.p99}ms`,
    `  Error rate:   < ${(slos.errorRate * 100).toFixed(2)}%`,
    slos.minThroughput ? `  Min throughput: ${slos.minThroughput} req/s` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
