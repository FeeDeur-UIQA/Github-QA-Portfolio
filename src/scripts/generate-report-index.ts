#!/usr/bin/env ts-node
/**
 * ⭐ TEST REPORT AGGREGATOR
 * Version: 1.17 - Report Publishing
 *
 * Features:
 * - Historical trend tracking with Chart.js
 * - Screenshot gallery with lightbox
 * - Metadata aggregation & filtering
 * - Mobile-responsive design
 * - SEO-optimized report pages
 */

import * as fs from 'fs';
import * as path from 'path';

import type { PlaywrightResults, TestRunRecord, HistoricalData } from '../types/test-results.types';

class ReportIndexGenerator {
  private reportsDir: string;
  private outputDir: string;
  private historicalData: HistoricalData;

  constructor(reportsDir: string, outputDir: string) {
    this.reportsDir = reportsDir;
    this.outputDir = outputDir;
    this.historicalData = this.loadHistoricalData();
  }

  /**
   * Main entry point - generates complete report index
   */
  public async generate(): Promise<void> {
    console.log('🚀 Generating Test Report Index...\n');

    const currentRun = this.parseCurrentRun();
    if (currentRun) {
      this.updateHistoricalData(currentRun);
    }

    this.generateIndexHTML();
    this.generateTrendDashboard();
    this.generateScreenshotGallery();
    this.saveHistoricalData();

    console.log('✅ Report index generated successfully!');
    console.log(`📊 View at: ${path.join(this.outputDir, 'index.html')}`);
  }

  /**
   * Parse current test run results from JSON
   * Handles both Playwright JSON reporter format (stats) and legacy format (summary)
   */
  private parseCurrentRun(): TestRunRecord | null {
    const resultsPath = path.join(this.reportsDir, 'results.json');

    if (!fs.existsSync(resultsPath)) {
      console.warn('⚠️  No results.json found, using placeholder data');
      return this.createPlaceholderResult();
    }

    const rawContent = fs.readFileSync(resultsPath, 'utf-8');
    
    // Validate JSON is not empty
    if (!rawContent.trim() || rawContent.trim() === '{}') {
      console.warn('⚠️  results.json is empty, using placeholder data');
      return this.createPlaceholderResult();
    }

    const results = JSON.parse(rawContent) as PlaywrightResults;
    const screenshots = this.findScreenshots();

    // Handle Playwright JSON reporter format (stats) vs legacy format (summary)
    let passed: number, failed: number, skipped: number, total: number, duration: number;
    
    if (results.stats) {
      // Playwright JSON reporter format: expected = passed, unexpected = failed
      passed = results.stats.expected ?? 0;
      failed = results.stats.unexpected ?? 0;
      skipped = results.stats.skipped ?? 0;
      total = passed + failed + skipped + (results.stats.flaky ?? 0);
      duration = results.stats.duration ?? 0;
      console.log(`📊 Parsed Playwright stats: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    } else if (results.summary) {
      // Legacy format
      passed = results.summary.passed ?? 0;
      failed = results.summary.failed ?? 0;
      skipped = results.summary.skipped ?? 0;
      total = results.summary.total ?? 0;
      duration = results.summary.duration ?? 0;
      console.log(`📊 Parsed legacy summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    } else {
      console.warn('⚠️  Unknown results.json format, using placeholder data');
      return this.createPlaceholderResult();
    }

    return {
      browser: process.env.BROWSER || 'chromium',
      timestamp: new Date().toISOString(),
      passed,
      failed,
      skipped,
      total,
      duration,
      reportPath: './index.html',
      screenshots,
      commit: process.env.GITHUB_SHA?.substring(0, 7) || 'local',
      branch: process.env.GITHUB_REF_NAME || 'main',
      testType: (process.env.TEST_TYPE as 'smoke' | 'e2e') || 'unknown',
    } as TestRunRecord;
  }

  /**
   * Find all failure screenshots
   */
  private findScreenshots(): string[] {
    const screenshotsDir = path.join(this.reportsDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) return [];

    return fs
      .readdirSync(screenshotsDir)
      .filter((file) => file.endsWith('.png'))
      .map((file) => `./screenshots/${file}`);
  }

  /**
   * Load historical test data from storage
   */
  private loadHistoricalData(): HistoricalData {
    const dataPath = path.join(this.outputDir, 'historical-data.json');

    if (!fs.existsSync(dataPath)) {
      return {
        runs: [],
        trends: {
          passRate: [],
          avgDuration: [],
          timestamps: [],
        },
      };
    }

    return JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as HistoricalData;
  }

  /**
   * Update historical data with current run
   */
  private updateHistoricalData(currentRun: TestRunRecord): void {
    this.historicalData.runs.push(currentRun);

    // Keep last 30 runs for trends
    if (this.historicalData.runs.length > 30) {
      this.historicalData.runs = this.historicalData.runs.slice(-30);
    }

    // Update trends
    this.historicalData.trends = {
      passRate: this.historicalData.runs.map((r) => (r.total > 0 ? (r.passed / r.total) * 100 : 0)),
      avgDuration: this.historicalData.runs.map((r) => r.duration / 1000),
      timestamps: this.historicalData.runs.map((r) => new Date(r.timestamp).toLocaleDateString()),
    };
  }

  /**
   * Save historical data to disk
   */
  private saveHistoricalData(): void {
    const dataPath = path.join(this.outputDir, 'historical-data.json');
    fs.writeFileSync(dataPath, JSON.stringify(this.historicalData, null, 2));
  }

  /**
   * Generate main index.html with dashboard
   */
  private generateIndexHTML(): void {
    const latestRun = this.historicalData.runs[this.historicalData.runs.length - 1];
    const passRate =
      latestRun.total > 0 ? ((latestRun.passed / latestRun.total) * 100).toFixed(1) : '0.0';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="QA Test Results Dashboard - Automated Playwright Testing">
  <title>🎯 QA Test Results Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #0066cc;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --dark: #1f2937;
      --light: #f3f4f6;
      --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--light);
      color: var(--dark);
      line-height: 1.6;
    }

    .header {
      background: var(--gradient);
      color: white;
      padding: 2rem 1rem;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .header p {
      opacity: 0.9;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    .stat-card h3 {
      font-size: 0.875rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 2.5rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }

    .stat-value.success { color: var(--success); }
    .stat-value.danger { color: var(--danger); }
    .stat-value.warning { color: var(--warning); }
    .stat-value.primary { color: var(--primary); }

    .chart-container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }

    .chart-container h2 {
      margin-bottom: 1.5rem;
      color: var(--dark);
    }

    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      transition: background 0.2s;
      margin: 0.5rem;
    }

    .btn:hover {
      background: #0052a3;
    }

    .btn-success {
      background: var(--success);
    }

    .btn-success:hover {
      background: #059669;
    }

    .footer {
      text-align: center;
      padding: 2rem 1rem;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      margin-top: 3rem;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.75rem;
      }
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎯 QA Test Results</h1>
    <p>Automated Testing Dashboard - Last Run: ${new Date(latestRun.timestamp).toLocaleString()}</p>
    <p style="margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.9;">
      <span style="background: ${latestRun.testType === 'smoke' ? '#f59e0b' : '#10b981'}; padding: 0.25rem 0.75rem; border-radius: 1rem; font-weight: 600;">
        ${latestRun.testType === 'smoke' ? '🔥 SMOKE' : latestRun.testType === 'e2e' ? '🧪 E2E' : '❓ UNKNOWN'} TEST RUN
      </span>
    </p>
  </div>

  <div class="container">
    <div class="stats-grid">
      <div class="stat-card">
        <h3>✅ Tests Passed</h3>
        <div class="stat-value success">${latestRun.passed}</div>
        <p>${latestRun.total > 0 ? passRate : '0'}% Pass Rate</p>
      </div>

      <div class="stat-card">
        <h3>❌ Tests Failed</h3>
        <div class="stat-value danger">${latestRun.failed}</div>
        <p>${latestRun.screenshots.length} Screenshots</p>
      </div>

      <div class="stat-card">
        <h3>⏭️ Tests Skipped</h3>
        <div class="stat-value warning">${latestRun.skipped}</div>
        <p>Conditional Tests</p>
      </div>

      <div class="stat-card">
        <h3>⏱️ Duration</h3>
        <div class="stat-value primary">${(latestRun.duration / 1000).toFixed(1)}s</div>
        <p>Execution Time</p>
      </div>
    </div>

    <div class="chart-container">
      <h2>📈 Historical Test Trends (Last 30 Runs)</h2>
      <canvas id="trendChart" width="400" height="200"></canvas>
    </div>

    <div style="text-align: center; margin: 2rem 0;">
      <a href="./playwright-report/index.html" class="btn btn-success">📊 View Full Playwright Report</a>
      <a href="./screenshots.html" class="btn">📸 Screenshot Gallery</a>
      <a href="./historical-data.json" class="btn">📁 Download Raw Data</a>
    </div>

    <div style="background: white; padding: 1.5rem; border-radius: 12px; margin-top: 2rem;">
      <h3 style="margin-bottom: 1rem;">📋 Latest Run Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 0.75rem; font-weight: bold;">Browser</td>
          <td style="padding: 0.75rem;">${latestRun.browser}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 0.75rem; font-weight: bold;">Commit</td>
          <td style="padding: 0.75rem;">${latestRun.commit}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 0.75rem; font-weight: bold;">Branch</td>
          <td style="padding: 0.75rem;">${latestRun.branch}</td>
        </tr>
        <tr>
          <td style="padding: 0.75rem; font-weight: bold;">Timestamp</td>
          <td style="padding: 0.75rem;">${new Date(latestRun.timestamp).toLocaleString()}</td>
        </tr>
      </table>
    </div>
  </div>

  <div class="footer">
    <p>🎯 QA Portfolio | Powered by Playwright | Generated ${new Date().toLocaleString()}</p>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script>
    const ctx = document.getElementById('trendChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(this.historicalData.trends.timestamps)},
        datasets: [
          {
            label: 'Pass Rate (%)',
            data: ${JSON.stringify(this.historicalData.trends.passRate)},
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Avg Duration (s)',
            data: ${JSON.stringify(this.historicalData.trends.avgDuration)},
            borderColor: '#0066cc',
            backgroundColor: 'rgba(0, 102, 204, 0.1)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Pass Rate (%)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Duration (s)'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                label += context.parsed.y.toFixed(2);
                if (context.datasetIndex === 0) {
                  label += '%';
                } else {
                  label += 's';
                }
                return label;
              }
            }
          }
        }
      }
    });
  </script>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'index.html'), html);
  }

  /**
   * Generate trends dashboard
   */
  private generateTrendDashboard(): void {
    // Trends are embedded in main index.html
    console.log('📈 Trend dashboard embedded in index.html');
  }

  /**
   * Generate screenshot gallery
   */
  private generateScreenshotGallery(): void {
    const latestRun = this.historicalData.runs[this.historicalData.runs.length - 1];

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📸 Screenshot Gallery - Test Failures</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      padding: 2rem 1rem;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .header h1 {
      font-size: 2rem;
      color: #1f2937;
      margin-bottom: 0.5rem;
    }

    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .screenshot-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }

    .screenshot-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    .screenshot-card img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      cursor: pointer;
    }

    .screenshot-card .info {
      padding: 1rem;
    }

    .screenshot-card h3 {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 0.5rem;
    }

    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: #0066cc;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      margin: 2rem auto;
      display: block;
      width: fit-content;
    }

    .btn:hover {
      background: #0052a3;
    }

    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .lightbox.active {
      display: flex;
    }

    .lightbox img {
      max-width: 90%;
      max-height: 90%;
      border-radius: 8px;
    }

    .lightbox-close {
      position: absolute;
      top: 2rem;
      right: 2rem;
      font-size: 2rem;
      color: white;
      cursor: pointer;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #6b7280;
    }

    .empty-state h2 {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📸 Screenshot Gallery</h1>
    <p>Failed Test Screenshots - ${new Date(latestRun.timestamp).toLocaleDateString()}</p>
  </div>

  ${
    latestRun.screenshots.length > 0
      ? `
    <div class="gallery">
      ${latestRun.screenshots
        .map(
          (screenshot, index) => `
        <div class="screenshot-card">
          <img src="${screenshot}" alt="Failure ${index + 1}" onclick="openLightbox('${screenshot}')">
          <div class="info">
            <h3>Failure ${index + 1}</h3>
            <p>${path.basename(screenshot)}</p>
          </div>
        </div>
      `,
        )
        .join('')}
    </div>
  `
      : `
    <div class="empty-state">
      <h2>🎉</h2>
      <h3>No Failures!</h3>
      <p>All tests passed successfully. No screenshots to display.</p>
    </div>
  `
  }

  <a href="./index.html" class="btn">← Back to Dashboard</a>

  <div id="lightbox" class="lightbox" onclick="closeLightbox()">
    <span class="lightbox-close">×</span>
    <img id="lightbox-img" src="" alt="Screenshot">
  </div>

  <script>
    function openLightbox(src) {
      document.getElementById('lightbox').classList.add('active');
      document.getElementById('lightbox-img').src = src;
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  </script>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'screenshots.html'), html);
  }

  /**
   * Create placeholder result for first run
   */
  private createPlaceholderResult(): TestRunRecord {
    return {
      browser: 'chromium',
      timestamp: new Date().toISOString(),
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      reportPath: './index.html',
      screenshots: [],
      commit: 'initial',
      branch: 'main',
      testType: 'unknown',
    };
  }
}

// CLI Execution
if (require.main === module) {
  const reportsDir = process.argv[2] || path.join(__dirname, '../../../playwright-report');
  const outputDir = process.argv[3] || path.join(__dirname, '../../../reports');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const generator = new ReportIndexGenerator(reportsDir, outputDir);
  generator.generate().catch((error: unknown) => {
    console.error('❌ Error generating report index:', error);
    process.exit(1);
  });
}

export { ReportIndexGenerator };
