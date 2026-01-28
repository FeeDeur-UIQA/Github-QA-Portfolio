/**
 * PERFORMANCE TREND ANALYZER
 * Tracks smoke test performance over time and detects anomalies
 * Version: 2025.1.17 - Phase 3 Advanced Observability
 */

import * as fs from 'fs';

import { SmokeMetrics } from './smoke.utils';

export interface TrendDataPoint {
  runId: string;
  timestamp: string;
  commitSha?: string;
  branch?: string;
  metrics: {
    [feature: string]: {
      duration: number;
      status: 'passed' | 'failed';
    };
  };
}

export interface PerformanceAnomaly {
  feature: string;
  severity: 'warning' | 'critical';
  message: string;
  baseline: number;
  current: number;
  delta: number;
}

export class PerformanceTrendAnalyzer {
  private static readonly METRICS_FILE = 'smoke-metrics.jsonl';
  private static readonly MAX_HISTORY = 30;

  /**
   * Append current run to historical log
   */
  static async recordRun(metrics: SmokeMetrics[], runId?: string): Promise<void> {
    const dataPoint: TrendDataPoint = {
      runId: runId || `local-${Date.now()}`,
      timestamp: new Date().toISOString(),
      commitSha: process.env.GITHUB_SHA || undefined,
      branch: process.env.GITHUB_REF_NAME || 'local',
      metrics: {},
    };

    // Aggregate by feature
    const features = ['health', 'auth', 'cart', 'search', 'discovery'];
    for (const feature of features) {
      const featureMetrics = metrics.filter((m) => m.feature === feature);
      if (featureMetrics.length > 0) {
        const avgDuration =
          featureMetrics.reduce((sum, m) => sum + m.duration, 0) / featureMetrics.length;
        const allPassed = featureMetrics.every((m) => m.status === 'passed');

        dataPoint.metrics[feature] = {
          duration: Math.round(avgDuration),
          status: allPassed ? 'passed' : 'failed',
        };
      }
    }

    // Append to JSONL file
    const line = JSON.stringify(dataPoint) + '\n';
    fs.appendFileSync(this.METRICS_FILE, line);

    console.log(`[INFO] Trend data recorded: ${this.METRICS_FILE}`);
  }

  /**
   * Load historical trend data
   */
  private static loadHistory(): TrendDataPoint[] {
    if (!fs.existsSync(this.METRICS_FILE)) {
      return [];
    }

    const content = fs.readFileSync(this.METRICS_FILE, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line);

    // Parse each line and take last N runs
    const allRuns = lines.map((line) => JSON.parse(line) as TrendDataPoint);
    return allRuns.slice(-this.MAX_HISTORY);
  }

  /**
   * Calculate baseline (average of last 30 runs)
   */
  static calculateBaseline(): { [feature: string]: number } {
    const history = this.loadHistory();
    if (history.length === 0) return {};

    const baseline: { [feature: string]: number } = {};
    const features = ['health', 'auth', 'cart', 'search', 'discovery'];

    for (const feature of features) {
      const durations = history
        .map((run) => run.metrics[feature]?.duration)
        .filter((d): d is number => d !== undefined);

      if (durations.length > 0) {
        baseline[feature] = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      }
    }

    return baseline;
  }

  /**
   * Detect performance anomalies
   */
  static detectAnomalies(currentMetrics: SmokeMetrics[]): PerformanceAnomaly[] {
    const baseline = this.calculateBaseline();
    const anomalies: PerformanceAnomaly[] = [];

    // Group current metrics by feature
    const features = ['health', 'auth', 'cart', 'search', 'discovery'];
    for (const feature of features) {
      const featureMetrics = currentMetrics.filter((m) => m.feature === feature);
      if (featureMetrics.length === 0 || !baseline[feature]) continue;

      const currentAvg =
        featureMetrics.reduce((sum, m) => sum + m.duration, 0) / featureMetrics.length;
      const baselineAvg = baseline[feature];
      const delta = ((currentAvg - baselineAvg) / baselineAvg) * 100;

      // Anomaly thresholds
      if (delta > 50) {
        anomalies.push({
          feature,
          severity: 'critical',
          message: `${feature} degraded ${delta.toFixed(0)}% vs 30-run baseline`,
          baseline: Math.round(baselineAvg),
          current: Math.round(currentAvg),
          delta: Math.round(delta),
        });
      } else if (delta > 20) {
        anomalies.push({
          feature,
          severity: 'warning',
          message: `${feature} slower ${delta.toFixed(0)}% vs baseline`,
          baseline: Math.round(baselineAvg),
          current: Math.round(currentAvg),
          delta: Math.round(delta),
        });
      }
    }

    return anomalies;
  }

  /**
   * Generate trend report
   */
  static generateTrendReport(): string {
    const history = this.loadHistory();
    if (history.length === 0) {
      return 'No historical data available. Run more tests to generate trends.';
    }

    const baseline = this.calculateBaseline();
    const latest = history[history.length - 1];

    let report = `
╔════════════════════════════════════════════════════════════╗
║         PERFORMANCE TREND ANALYSIS (${history.length} runs)              ║
╠════════════════════════════════════════════════════════════╣
`;

    const features = ['health', 'auth', 'cart', 'search', 'discovery'];
    for (const feature of features) {
      if (!baseline[feature]) continue;

      const currentDuration = latest.metrics[feature]?.duration || 0;
      const baselineDuration = baseline[feature];
      const delta = ((currentDuration - baselineDuration) / baselineDuration) * 100;
      const trend = delta > 5 ? '[INFO] ↑' : delta < -5 ? '[INFO] ↓' : '[INFO][INFO]  ';
      const status = Math.abs(delta) > 20 ? '⚠[INFO] ' : delta > 10 ? '[INFO]' : '[PASS]';

      report += `║  ${status} ${feature.toUpperCase().padEnd(12)} ${trend}                              ║
║     Baseline:  ${baselineDuration.toFixed(0).padEnd(5)}ms  |  Current: ${currentDuration.toFixed(0).padEnd(5)}ms     ║
║     Delta:     ${delta > 0 ? '+' : ''}${delta.toFixed(1).padEnd(6)}%                              ║
║                                                            ║
`;
    }

    report += `╚════════════════════════════════════════════════════════════╝`;

    return report;
  }

  /**
   * Analyze flakiness (tests that frequently need retries)
   */
  static analyzeFlakyTests(): { testName: string; failureRate: number }[] {
    const history = this.loadHistory();
    if (history.length < 5) return [];

    // This would need retry data from actual test runs
    // Placeholder for future implementation when retry tracking is added
    return [];
  }

  /**
   * Display trend visualization (ASCII chart)
   */
  static visualizeTrend(feature: string): string {
    const history = this.loadHistory();
    if (history.length < 2) return 'Not enough data for visualization';

    const durations = history
      .map((run) => run.metrics[feature]?.duration)
      .filter((d): d is number => d !== undefined);

    if (durations.length < 2) return `No data for ${feature}`;

    const max = Math.max(...durations);
    const min = Math.min(...durations);
    const range = max - min;

    const height = 10;
    const width = Math.min(durations.length, 50);

    let chart = `\n${feature.toUpperCase()} - Last ${durations.length} runs\n`;
    chart += `${max.toFixed(0)}ms ┤\n`;

    // Simple ASCII chart
    for (let i = 0; i < height; i++) {
      const threshold = max - (range * i) / height;
      chart += `       ├`;
      for (let j = 0; j < width; j++) {
        const idx = Math.floor((j / width) * durations.length);
        const value = durations[idx];
        chart += value >= threshold ? '█' : ' ';
      }
      chart += '\n';
    }

    chart += `${min.toFixed(0)}ms └${'─'.repeat(width)}\n`;

    return chart;
  }
}
