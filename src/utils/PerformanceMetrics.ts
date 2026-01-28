/**
 * Performance Metrics Utility
 *
 * Calculates percentile-based metrics for API performance tracking
 * Enables SLO validation and performance regression detection
 *
 * Usage:
 *   const metrics = new PerformanceMetrics();
 *   metrics.record(duration);
 *   const p95 = metrics.percentile(95);
 */

export interface PerformanceSnapshot {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  count: number;
  timestamp: number;
}

export class PerformanceMetrics {
  private samples: number[] = [];

  /**
   * Record a performance sample (duration in milliseconds)
   */
  record(duration: number): void {
    if (duration < 0) {
      throw new Error('Duration must be non-negative');
    }
    this.samples.push(duration);
  }

  /**
   * Calculate percentile value
   * @param percentile - Value between 0 and 100
   * @returns Duration at the specified percentile
   */
  percentile(percentile: number): number {
    if (this.samples.length === 0) {
      throw new Error('No samples recorded');
    }

    if (percentile < 0 || percentile > 100) {
      throw new Error('Percentile must be between 0 and 100');
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate mean (average) duration
   */
  mean(): number {
    if (this.samples.length === 0) {
      throw new Error('No samples recorded');
    }

    const sum = this.samples.reduce((acc, val) => acc + val, 0);
    return sum / this.samples.length;
  }

  /**
   * Get minimum duration
   */
  min(): number {
    if (this.samples.length === 0) {
      throw new Error('No samples recorded');
    }

    return Math.min(...this.samples);
  }

  /**
   * Get maximum duration
   */
  max(): number {
    if (this.samples.length === 0) {
      throw new Error('No samples recorded');
    }

    return Math.max(...this.samples);
  }

  /**
   * Get total sample count
   */
  count(): number {
    return this.samples.length;
  }

  /**
   * Get full snapshot of performance metrics
   */
  snapshot(): PerformanceSnapshot {
    if (this.samples.length === 0) {
      throw new Error('No samples recorded');
    }

    return {
      p50: this.percentile(50),
      p95: this.percentile(95),
      p99: this.percentile(99),
      mean: this.mean(),
      min: this.min(),
      max: this.max(),
      count: this.count(),
      timestamp: Date.now(),
    };
  }

  /**
   * Reset all recorded samples
   */
  reset(): void {
    this.samples = [];
  }

  /**
   * Check if metrics meet SLO thresholds
   * @param slo - Service Level Objective thresholds
   * @returns Object with pass/fail status and details
   */
  validateSLO(slo: { p50?: number; p95?: number; p99?: number; mean?: number }): {
    passed: boolean;
    violations: string[];
    metrics: PerformanceSnapshot;
  } {
    const snapshot = this.snapshot();
    const violations: string[] = [];

    if (slo.p50 !== undefined && snapshot.p50 > slo.p50) {
      violations.push(`P50 ${snapshot.p50.toFixed(2)}ms exceeds SLO ${slo.p50}ms`);
    }

    if (slo.p95 !== undefined && snapshot.p95 > slo.p95) {
      violations.push(`P95 ${snapshot.p95.toFixed(2)}ms exceeds SLO ${slo.p95}ms`);
    }

    if (slo.p99 !== undefined && snapshot.p99 > slo.p99) {
      violations.push(`P99 ${snapshot.p99.toFixed(2)}ms exceeds SLO ${slo.p99}ms`);
    }

    if (slo.mean !== undefined && snapshot.mean > slo.mean) {
      violations.push(`Mean ${snapshot.mean.toFixed(2)}ms exceeds SLO ${slo.mean}ms`);
    }

    return {
      passed: violations.length === 0,
      violations,
      metrics: snapshot,
    };
  }

  /**
   * Format metrics for console output
   */
  format(): string {
    const snapshot = this.snapshot();
    return `
Performance Metrics:
  P50 (median): ${snapshot.p50.toFixed(2)}ms
  P95: ${snapshot.p95.toFixed(2)}ms
  P99: ${snapshot.p99.toFixed(2)}ms
  Mean: ${snapshot.mean.toFixed(2)}ms
  Min: ${snapshot.min.toFixed(2)}ms
  Max: ${snapshot.max.toFixed(2)}ms
  Samples: ${snapshot.count}
    `.trim();
  }
}
