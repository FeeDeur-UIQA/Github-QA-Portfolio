/**
 * SMOKE TEST DASHBOARD GENERATOR
 * Generates HTML dashboard with performance metrics and trends
 * Version: 2025.1.17 - Phase 3 Advanced Observability
 */

import * as fs from 'fs';
import * as path from 'path';

import { SmokeMetrics } from './smoke.utils';

export interface DashboardData {
  runId: string;
  timestamp: Date;
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: string;
    avgDuration: string;
    totalDuration: number;
  };
  byFeature: {
    [key: string]: {
      total: number;
      passed: number;
      avgDuration: string;
      budgetUtilization?: string;
    } | null;
  };
  tests: SmokeMetrics[];
  budgetViolations: Array<{
    testName: string;
    duration: number;
    budget: number;
    utilization: number;
  }>;
}

export class SmokeDashboardGenerator {
  private static readonly OUTPUT_DIR = 'smoke-dashboard';
  private static readonly BUDGETS = {
    health: 8000,
    auth: 18000,
    cart: 12000,
    search: 8000,
    discovery: 8000,
  };

  /**
   * Generate complete dashboard with data and HTML
   */
  static async generateDashboard(metrics: SmokeMetrics[], runId?: string): Promise<void> {
    const data = this.prepareData(metrics, runId);

    // Ensure output directory exists
    if (!fs.existsSync(this.OUTPUT_DIR)) {
      fs.mkdirSync(this.OUTPUT_DIR, { recursive: true });
    }

    // Write data JSON
    const dataPath = path.join(this.OUTPUT_DIR, 'data.json');
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

    // Generate and write HTML
    const html = this.generateHTML(data);
    const htmlPath = path.join(this.OUTPUT_DIR, 'index.html');
    fs.writeFileSync(htmlPath, html);

    console.log(`[INFO] Dashboard generated: ${htmlPath}`);
  }

  /**
   * Prepare dashboard data from metrics
   */
  private static prepareData(metrics: SmokeMetrics[], runId?: string): DashboardData {
    const total = metrics.length;
    const passed = metrics.filter((m) => m.status === 'passed').length;
    const failed = metrics.filter((m) => m.status === 'failed').length;
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const avgDuration = total > 0 ? totalDuration / total : 0;

    // Calculate by feature
    const byFeature: DashboardData['byFeature'] = {};
    for (const feature of ['health', 'auth', 'cart', 'search', 'discovery']) {
      const featureMetrics = metrics.filter((m) => m.feature === feature);
      if (featureMetrics.length > 0) {
        const featurePassed = featureMetrics.filter((m) => m.status === 'passed').length;
        const featureAvg =
          featureMetrics.reduce((sum, m) => sum + m.duration, 0) / featureMetrics.length;
        const budget = this.BUDGETS[feature as keyof typeof this.BUDGETS] || 15000;
        const utilization = (featureAvg / budget) * 100;

        byFeature[feature] = {
          total: featureMetrics.length,
          passed: featurePassed,
          avgDuration: `${featureAvg.toFixed(0)}ms`,
          budgetUtilization: `${utilization.toFixed(0)}%`,
        };
      } else {
        byFeature[feature] = null;
      }
    }

    // Find budget violations
    const budgetViolations: DashboardData['budgetViolations'] = [];
    for (const metric of metrics) {
      if (metric.feature) {
        const budget = this.BUDGETS[metric.feature] || 15000;
        const utilization = (metric.duration / budget) * 100;
        if (utilization > 100) {
          budgetViolations.push({
            testName: metric.testName,
            duration: metric.duration,
            budget,
            utilization,
          });
        }
      }
    }

    return {
      runId: runId || `local-${Date.now()}`,
      timestamp: new Date(),
      summary: {
        total,
        passed,
        failed,
        passRate: total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : '0%',
        avgDuration: `${avgDuration.toFixed(0)}ms`,
        totalDuration,
      },
      byFeature,
      tests: metrics,
      budgetViolations,
    };
  }

  /**
   * Generate HTML dashboard
   */
  private static generateHTML(data: DashboardData): string {
    const statusColor = parseFloat(data.summary.passRate) >= 95 ? '#22c55e' : '#ef4444';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smoke Test Dashboard - ${data.runId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 2rem;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #334155;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #f1f5f9;
    }
    .meta {
      color: #94a3b8;
      font-size: 0.875rem;
    }
    
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .kpi-card {
      background: #1e293b;
      border-radius: 0.5rem;
      padding: 1.5rem;
      border: 1px solid #334155;
    }
    .kpi-label {
      color: #94a3b8;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .kpi-value {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }
    .kpi-trend {
      font-size: 0.875rem;
      color: #64748b;
    }
    
    /* Feature Grid */
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .feature-card {
      background: #1e293b;
      border-radius: 0.5rem;
      padding: 1.5rem;
      border-left: 4px solid #3b82f6;
    }
    .feature-card.passed { border-left-color: #22c55e; }
    .feature-card.warning { border-left-color: #f59e0b; }
    .feature-card.failed { border-left-color: #ef4444; }
    .feature-name {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      text-transform: capitalize;
    }
    .feature-metrics {
      display: grid;
      gap: 0.5rem;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
    }
    .metric-label { color: #94a3b8; }
    .metric-value { font-weight: 600; }
    
    /* Violations Alert */
    .violations {
      background: #7f1d1d;
      border: 1px solid #991b1b;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .violations h2 {
      color: #fef2f2;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .violation-item {
      background: #991b1b;
      padding: 0.75rem;
      border-radius: 0.25rem;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }
    
    /* Test List */
    .test-list {
      background: #1e293b;
      border-radius: 0.5rem;
      padding: 1.5rem;
    }
    .test-item {
      padding: 1rem;
      border-bottom: 1px solid #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .test-item:last-child { border-bottom: none; }
    .test-status {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .test-status.passed { background: #166534; color: #86efac; }
    .test-status.failed { background: #7f1d1d; color: #fca5a5; }
    .test-duration { color: #94a3b8; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔥 Smoke Test Dashboard</h1>
      <div class="meta">
        Run ID: ${data.runId} | 
        Generated: ${data.timestamp.toLocaleString()} |
        Duration: ${(data.summary.totalDuration / 1000).toFixed(1)}s
      </div>
    </div>

    <!-- KPI Overview -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Pass Rate</div>
        <div class="kpi-value" style="color: ${statusColor}">
          ${data.summary.passRate}
        </div>
        <div class="kpi-trend">${data.summary.passed}/${data.summary.total} tests passed</div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Avg Duration</div>
        <div class="kpi-value" style="color: #3b82f6">
          ${data.summary.avgDuration}
        </div>
        <div class="kpi-trend">Total: ${(data.summary.totalDuration / 1000).toFixed(1)}s</div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Budget Status</div>
        <div class="kpi-value" style="color: ${data.budgetViolations.length === 0 ? '#22c55e' : '#f59e0b'}">
          ${data.budgetViolations.length === 0 ? '✓' : '⚠'}
        </div>
        <div class="kpi-trend">
          ${data.budgetViolations.length} violation${data.budgetViolations.length !== 1 ? 's' : ''}
        </div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Test Count</div>
        <div class="kpi-value" style="color: #8b5cf6">
          ${data.summary.total}
        </div>
        <div class="kpi-trend">Across ${Object.values(data.byFeature).filter((f) => f !== null).length} features</div>
      </div>
    </div>

    ${
      data.budgetViolations.length > 0
        ? `
    <!-- Budget Violations -->
    <div class="violations">
      <h2>🚨 Performance Budget Violations</h2>
      ${data.budgetViolations
        .map(
          (v) => `
        <div class="violation-item">
          <strong>${v.testName}</strong>: ${v.duration}ms 
          (budget: ${v.budget}ms, ${v.utilization.toFixed(0)}% utilized)
        </div>
      `,
        )
        .join('')}
    </div>
    `
        : ''
    }

    <!-- Feature Breakdown -->
    <h2 style="margin-bottom: 1rem; color: #f1f5f9;">Per-Feature Performance</h2>
    <div class="feature-grid">
      ${Object.entries(data.byFeature)
        .filter(([__, stats]) => stats !== null)
        .map(([name, stats]) => {
          if (!stats) return '';
          const utilization = parseInt(stats.budgetUtilization || '0');
          const cardClass =
            stats.passed === stats.total
              ? 'passed'
              : utilization > 100
                ? 'failed'
                : utilization > 80
                  ? 'warning'
                  : 'passed';

          return `
            <div class="feature-card ${cardClass}">
              <div class="feature-name">${name}</div>
              <div class="feature-metrics">
                <div class="metric-row">
                  <span class="metric-label">Tests</span>
                  <span class="metric-value">${stats.passed}/${stats.total}</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Avg Duration</span>
                  <span class="metric-value">${stats.avgDuration}</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Budget Util</span>
                  <span class="metric-value">${stats.budgetUtilization}</span>
                </div>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>

    <!-- Test Details -->
    <h2 style="margin-bottom: 1rem; color: #f1f5f9;">All Tests</h2>
    <div class="test-list">
      ${data.tests
        .map(
          (test) => `
        <div class="test-item">
          <div>
            <span class="test-status ${test.status}">${test.status}</span>
            <span style="margin-left: 0.75rem; color: #e2e8f0;">${test.testName}</span>
            ${test.feature ? `<span style="margin-left: 0.5rem; color: #64748b; font-size: 0.75rem;">[${test.feature}]</span>` : ''}
          </div>
          <div class="test-duration">${test.duration}ms</div>
        </div>
      `,
        )
        .join('')}
    </div>
  </div>
</body>
</html>`;
  }
}
