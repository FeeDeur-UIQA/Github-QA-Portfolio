/**
 * Visual Regression Reporter for Playwright
 *
 * Aggregates visual regression test failures and generates an HTML dashboard
 * showing baseline, actual, and diff screenshots side-by-side with approval workflow.
 *
 * Features:
 * - Side-by-side baseline/actual/diff comparison
 * - Approve/reject workflow for visual changes
 * - Aggregated metrics (total failures, % difference)
 * - Integration with existing test infrastructure
 * - Automatic screenshot organization
 *
 * @usage Add to playwright.config.ts:
 * reporter: [
 *   ['html'],
 *   ['./src/utils/VisualRegressionReporter.ts']
 * ]
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

interface VisualFailure {
  testId: string;
  testTitle: string;
  testFile: string;
  snapshotName: string;
  browserName: string;
  viewport?: string;
  expected: string; // Path to baseline screenshot
  actual: string; // Path to actual screenshot
  diff: string; // Path to diff screenshot
  diffPixels?: number;
  diffPercentage?: number;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
}

interface VisualTestStats {
  totalTests: number;
  passed: number;
  failed: number;
  visualFailures: number;
  avgDiffPercentage: number;
}

interface VisualReport {
  generatedAt: string;
  stats: VisualTestStats;
  failures: VisualFailure[];
}

export default class VisualRegressionReporter implements Reporter {
  private visualFailures: VisualFailure[] = [];
  private outputDir: string = 'visual-regression-report';
  private stats: VisualTestStats = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    visualFailures: 0,
    avgDiffPercentage: 0,
  };

  constructor() {
    this.ensureOutputDir();
  }

  onBegin(_config: FullConfig, suite: Suite) {
    this.stats.totalTests = suite.allTests().length;
    console.log(`\n🎨 Visual Regression Reporter initialized`);
    console.log(`📁 Report will be saved to: ${path.resolve(this.outputDir)}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'passed') {
      this.stats.passed++;
      return;
    }

    if (result.status === 'failed' || result.status === 'timedOut') {
      this.stats.failed++;
      this.processVisualFailures(test, result);
    }
  }

  async onEnd(_result: FullResult) {
    if (this.visualFailures.length === 0) {
      console.log(`\n✅ No visual regression failures detected`);
      return;
    }

    console.log(`\n🎨 Visual Regression Report`);
    console.log(`==========================================`);
    console.log(`📊 Total Tests: ${this.stats.totalTests}`);
    console.log(`✅ Passed: ${this.stats.passed}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`🖼️  Visual Failures: ${this.stats.visualFailures}`);

    if (this.stats.avgDiffPercentage > 0) {
      console.log(`📈 Avg Diff: ${this.stats.avgDiffPercentage.toFixed(2)}%`);
    }

    // Generate JSON report
    await this.generateJsonReport();

    // Generate HTML dashboard
    await this.generateHtmlDashboard();

    console.log(`\n📁 Visual regression report: ${path.resolve(this.outputDir, 'index.html')}`);
    console.log(`==========================================\n`);
  }

  private processVisualFailures(test: TestCase, result: TestResult) {
    // Check if test has screenshot attachments
    const attachments = result.attachments || [];

    // Look for expected, actual, and diff screenshots
    const screenshotAttachments = attachments.filter(
      (att) =>
        att.name.includes('expected') || att.name.includes('actual') || att.name.includes('diff'),
    );

    if (screenshotAttachments.length === 0) {
      return; // Not a visual regression failure
    }

    // Group attachments by screenshot name
    const screenshotGroups = this.groupScreenshotAttachments(screenshotAttachments);

    for (const [snapshotName, screenshots] of screenshotGroups.entries()) {
      const failure: VisualFailure = {
        testId: test.id,
        testTitle: test.title,
        testFile: test.location.file,
        snapshotName,
        browserName: this.extractBrowserName(test),
        viewport: this.extractViewport(test),
        expected: screenshots.expected || '',
        actual: screenshots.actual || '',
        diff: screenshots.diff || '',
        timestamp: Date.now(),
        status: 'pending',
      };

      // Calculate diff percentage if available
      this.calculateDiffMetrics(failure);

      this.visualFailures.push(failure);
      this.stats.visualFailures++;
    }

    // Calculate average diff percentage
    if (this.visualFailures.length > 0) {
      const totalDiff = this.visualFailures
        .filter((f) => f.diffPercentage !== undefined)
        .reduce((sum, f) => sum + (f.diffPercentage || 0), 0);
      this.stats.avgDiffPercentage = totalDiff / this.visualFailures.length;
    }
  }

  private groupScreenshotAttachments(attachments: any[]): Map<string, any> {
    const groups = new Map<string, any>();

    for (const attachment of attachments) {
      // Extract snapshot name from attachment name
      // e.g., "homepage-chromium-expected.png" -> "homepage-chromium"
      const match = attachment.name.match(/^(.+?)-(expected|actual|diff)$/);
      if (!match) continue;

      const snapshotName = match[1];
      const type = match[2];

      if (!groups.has(snapshotName)) {
        groups.set(snapshotName, {});
      }

      const group = groups.get(snapshotName)!;
      group[type] = attachment.path || attachment.body?.toString('base64');
    }

    return groups;
  }

  private extractBrowserName(test: TestCase): string {
    // Extract browser name from test project
    return test.parent?.project()?.name || 'unknown';
  }

  private extractViewport(test: TestCase): string | undefined {
    // Try to extract viewport from test title or annotations
    const viewportMatch = test.title.match(/(\d+)x(\d+)/);
    if (viewportMatch) {
      return `${viewportMatch[1]}x${viewportMatch[2]}`;
    }
    return undefined;
  }

  private async calculateDiffMetrics(failure: VisualFailure) {
    // Try to parse diff information from Playwright's diff image
    // Playwright creates a diff image with red pixels showing differences
    try {
      if (failure.diff && fs.existsSync(failure.diff)) {
        const diffStats = await this.analyzeDiffImage(failure.diff);
        failure.diffPixels = diffStats.diffPixels;
        failure.diffPercentage = diffStats.diffPercentage;
      }
    } catch (error) {
      // If analysis fails, set to unknown
      failure.diffPixels = 0;
      failure.diffPercentage = 0;
    }
  }

  private async analyzeDiffImage(
    diffPath: string,
  ): Promise<{ diffPixels: number; diffPercentage: number }> {
    // Placeholder for actual image analysis
    // In a real implementation, this would:
    // 1. Load the diff image using a library like 'sharp' or 'jimp'
    // 2. Count red pixels (Playwright marks differences in red)
    // 3. Calculate percentage based on total pixels

    // For now, return estimated values based on file size
    try {
      const stats = await fs.promises.stat(diffPath);
      const fileSizeKB = stats.size / 1024;

      // Rough estimation: larger diff files typically have more differences
      // This is a heuristic and should be replaced with actual pixel analysis
      const estimatedPercentage = Math.min(fileSizeKB / 100, 100);

      return {
        diffPixels: Math.floor(fileSizeKB * 10),
        diffPercentage: parseFloat(estimatedPercentage.toFixed(2)),
      };
    } catch {
      return { diffPixels: 0, diffPercentage: 0 };
    }
  }

  private async generateJsonReport() {
    const report: VisualReport = {
      generatedAt: new Date().toISOString(),
      stats: this.stats,
      failures: this.visualFailures,
    };

    const jsonPath = path.join(this.outputDir, 'visual-report.json');
    await fs.promises.writeFile(jsonPath, JSON.stringify(report, null, 2));
  }

  private async generateHtmlDashboard() {
    const htmlPath = path.join(this.outputDir, 'index.html');
    const templatePath = path.join(__dirname, 'visual-dashboard-template.html');

    let template = await fs.promises.readFile(templatePath, 'utf-8');

    // Replace placeholders with actual data
    template = template.replace('{{TIMESTAMP}}', new Date().toISOString());
    template = template.replace('{{TOTAL_TESTS}}', this.stats.totalTests.toString());
    template = template.replace('{{PASSED}}', this.stats.passed.toString());
    template = template.replace('{{FAILED}}', this.stats.failed.toString());
    template = template.replace('{{VISUAL_FAILURES}}', this.stats.visualFailures.toString());
    template = template.replace('{{AVG_DIFF}}', this.stats.avgDiffPercentage.toFixed(2));

    // Generate failure cards HTML
    const failuresHtml = this.generateFailureCardsHtml();
    template = template.replace('{{FAILURES}}', failuresHtml);

    // Inject failures data as JSON for JavaScript
    template = template.replace('{{FAILURES_JSON}}', JSON.stringify(this.visualFailures));

    await fs.promises.writeFile(htmlPath, template);
  }

  private generateFailureCardsHtml(): string {
    if (this.visualFailures.length === 0) {
      return `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2>No Visual Failures Detected!</h2>
          <p>All visual regression tests passed successfully.</p>
        </div>
      `;
    }

    return this.visualFailures
      .map((failure, index) => this.generateFailureCardHtml(failure, index))
      .join('\n');
  }

  private generateFailureCardHtml(failure: VisualFailure, index: number): string {
    const diffPercentage = failure.diffPercentage?.toFixed(2) || '0.00';
    const statusBadge = `<span class="badge ${failure.status}">${failure.status}</span>`;

    // Convert absolute paths to relative for display
    const expectedImg = this.getRelativeScreenshotPath(failure.expected);
    const actualImg = this.getRelativeScreenshotPath(failure.actual);
    const diffImg = this.getRelativeScreenshotPath(failure.diff);

    return `
      <div class="failure-card" 
           data-browser="${failure.browserName}" 
           data-status="${failure.status}"
           data-title="${failure.testTitle}">
        <div class="failure-header">
          <h3>${failure.testTitle}</h3>
          <div class="failure-meta">
            <span>📁 ${failure.snapshotName}</span>
            <span>🌐 ${failure.browserName}</span>
            ${failure.viewport ? `<span>📱 ${failure.viewport}</span>` : ''}
            <span>📄 ${path.basename(failure.testFile)}</span>
            ${statusBadge}
          </div>
        </div>
        
        <div class="screenshots-grid">
          <div class="screenshot-box">
            <h4>Expected (Baseline)</h4>
            <div class="screenshot-wrapper" onclick="openImage('${expectedImg}')">
              <img src="${expectedImg}" alt="Expected" loading="lazy" />
            </div>
          </div>
          
          <div class="screenshot-box">
            <h4>Actual (Current)</h4>
            <div class="screenshot-wrapper" onclick="openImage('${actualImg}')">
              <img src="${actualImg}" alt="Actual" loading="lazy" />
            </div>
          </div>
          
          <div class="screenshot-box">
            <h4>Difference</h4>
            <div class="screenshot-wrapper" onclick="openImage('${diffImg}')">
              <img src="${diffImg}" alt="Diff" loading="lazy" />
            </div>
            <div class="diff-percentage">${diffPercentage}%</div>
          </div>
        </div>
        
        <div class="actions">
          <button class="btn btn-approve" onclick="approveFailure('failure-${index}')">
            ✓ Approve Change
          </button>
          <button class="btn btn-update-baseline" onclick="updateBaseline('failure-${index}')">
            🔄 Update Baseline
          </button>
          <button class="btn btn-reject" onclick="rejectFailure('failure-${index}')">
            ✗ Mark as Bug
          </button>
        </div>
      </div>
    `;
  }

  private getRelativeScreenshotPath(absolutePath: string): string {
    // Convert absolute path to relative path from the report directory
    // Required for images to load correctly in the HTML report
    if (!absolutePath) return '';

    try {
      const reportDir = path.resolve(this.outputDir);
      const screenshotPath = path.resolve(absolutePath);
      const relativePath = path.relative(reportDir, screenshotPath);
      return relativePath.replace(/\\/g, '/'); // Normalize for web
    } catch {
      return absolutePath;
    }
  }

  private ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
}
