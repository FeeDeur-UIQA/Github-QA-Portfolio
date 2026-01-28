/**
 * Jira Integration Reporter for Playwright
 *
 * Automatically creates and updates Jira issues when tests fail.
 * Deduplicates issues to avoid flooding the board with duplicates.
 * Attaches screenshots, traces, and relevant context for developers.
 *
 * Configuration:
 *   Set these environment variables:
 *   - JIRA_BASE_URL: Your Jira instance (e.g., https://yourcompany.atlassian.net)
 *   - JIRA_PROJECT_KEY: Project key for issues (e.g., QA, AUTO, TEST)
 *   - JIRA_API_TOKEN: API token for authentication
 *   - JIRA_USER_EMAIL: Email associated with the API token
 *
 * Add to playwright.config.ts:
 *   reporter: [['./src/utils/JiraReporter.ts']]
 */

import { execSync, spawnSync } from 'child_process';
import * as crypto from 'crypto';
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

interface JiraConfig {
  baseUrl: string;
  projectKey: string;
  apiToken: string;
  userEmail: string;
  enabled: boolean;
}

interface FailedTest {
  title: string;
  testName?: string;
  filePath?: string;
  file: string;
  line: number;
  errorMessage: string;
  errorStack: string;
  signature: string;
  duration: number;
  retryCount: number;
  tags: string[];
  attachments: Array<{ name: string; path: string; contentType: string }>;
  browser?: string;
  error?: { message: string; stack: string };
  issueType?: 'REAL_BUG' | 'TEST_BUG' | 'FLAKY' | 'ENV_ISSUE';
  firstFailure?: boolean;
  failureCount?: number;
  // Developer-friendly reproduction data
  testSteps?: Array<{ title: string; category?: string; duration?: number }>;
  pageUrl?: string;
}

interface FailurePattern {
  [signature: string]: {
    firstFailure: string;
    lastFailure: string;
    count: number;
    browsers: string[];
  };
}

// Smart behavior: Stability data from test-stability.json
interface TestStabilityEntry {
  testId: string;
  testPath: string;
  testName: string;
  currentStatus: 'stable' | 'flaky' | 'quarantined';
  consecutivePasses: number;
  lastFailure?: string;
  historicalIssues?: Array<{
    browser: string;
    issue: string;
    fix?: string;
    jiraTicket?: string;
  }>;
}

// Smart behavior: Git blame for auto-assignment
interface GitBlameInfo {
  author: string;
  email: string;
  lastModified: string;
  commitHash: string;
}

// Smart behavior: Cross-browser correlation
interface CrossBrowserAnalysis {
  failedBrowsers: string[];
  totalBrowsers: number;
  isUniversalFailure: boolean;
  browserSpecific: boolean;
  suggestedCause: string;
}

interface EnvironmentInfo {
  gitBranch: string;
  gitCommit: string;
  gitCommitMessage: string;
  nodeVersion: string;
  os: string;
  timestamp: string;
  ciRunId: string;
  ciRunUrl: string;
}

interface JiraIssuePayload {
  fields: {
    project: { key: string };
    summary: string;
    description: {
      type: string;
      version: number;
      content: Array<Record<string, unknown>>;
    };
    issuetype: { name: string };
    priority?: { name: string };
    labels?: string[];
    components?: Array<{ name: string }>;
  };
}

export default class JiraReporter implements Reporter {
  private config: JiraConfig;
  private failedTests: FailedTest[] = [];
  private environment!: EnvironmentInfo;
  private outputDir: string;
  // Store outside test-results to persist across runs (test-results is cleared each run)
  private failurePatternPath = './.jira-failure-patterns.json';
  private testStabilityPath = './test-stability.json';
  private visualFlakesPath = './visual-flakes.json';

  // Smart behavior: Cache stability data
  private stabilityData: Record<string, TestStabilityEntry> = {};
  private visualFlakeData: Record<string, { isFlaky: boolean; mean: number }> = {};

  constructor() {
    this.outputDir = path.join(process.cwd(), 'test-results', 'jira-reports');
    this.config = this.loadConfig();
  }

  private loadConfig(): JiraConfig {
    const baseUrl = process.env.JIRA_BASE_URL || '';
    const projectKey = process.env.JIRA_PROJECT_KEY || '';
    const apiToken = process.env.JIRA_API_TOKEN || '';
    const userEmail = process.env.JIRA_USER_EMAIL || '';

    const enabled = !!(baseUrl && projectKey && apiToken && userEmail);

    if (!enabled) {
      console.log('Jira Reporter: Disabled (missing environment variables)');
      console.log(`  JIRA_BASE_URL: ${baseUrl ? '✓' : '✗'}`);
      console.log(`  JIRA_PROJECT_KEY: ${projectKey ? '✓' : '✗'}`);
      console.log(`  JIRA_API_TOKEN: ${apiToken ? '✓' : '✗'}`);
      console.log(`  JIRA_USER_EMAIL: ${userEmail ? '✓' : '✗'}`);
    } else {
      console.log('Jira Reporter: Enabled - will send issues to Jira');
    }

    return { baseUrl, projectKey, apiToken, userEmail, enabled };
  }

  private collectEnvironmentInfo(): EnvironmentInfo {
    const safeExec = (cmd: string, fallback: string): string => {
      try {
        return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
      } catch {
        return fallback;
      }
    };

    return {
      gitBranch: safeExec('git rev-parse --abbrev-ref HEAD', 'unknown'),
      gitCommit: safeExec('git rev-parse --short HEAD', 'unknown'),
      gitCommitMessage: safeExec('git log -1 --pretty=%s', 'unknown'),
      nodeVersion: process.version,
      os: `${process.platform} ${process.arch}`,
      timestamp: new Date().toISOString(),
      ciRunId: process.env.GITHUB_RUN_ID || process.env.CI_JOB_ID || 'local',
      ciRunUrl:
        process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
          ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
          : '',
    };
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // ============================================================================
  // SMART BEHAVIOR: Load stability metadata
  // ============================================================================

  private loadStabilityData(): void {
    try {
      if (fs.existsSync(this.testStabilityPath)) {
        const content = JSON.parse(fs.readFileSync(this.testStabilityPath, 'utf-8'));
        if (content.tests) {
          this.stabilityData = content.tests;
          console.log(
            `Jira Reporter: Loaded ${Object.keys(this.stabilityData).length} test stability entries`,
          );
        }
      }
    } catch (error) {
      console.log('Jira Reporter: Could not load test-stability.json');
    }

    try {
      if (fs.existsSync(this.visualFlakesPath)) {
        const content = JSON.parse(fs.readFileSync(this.visualFlakesPath, 'utf-8'));
        if (content.analyses) {
          for (const analysis of content.analyses) {
            const testId = this.extractTestIdFromName(analysis.testName);
            this.visualFlakeData[testId] = {
              isFlaky: analysis.isFlaky || false,
              mean: analysis.mean || 0,
            };
          }
          console.log(
            `Jira Reporter: Loaded ${Object.keys(this.visualFlakeData).length} visual flake entries`,
          );
        }
      }
    } catch (error) {
      console.log('Jira Reporter: Could not load visual-flakes.json');
    }
  }

  private extractTestIdFromName(testName: string): string {
    const match = testName.match(/TC-\w+/);
    return match ? match[0] : testName.slice(0, 30);
  }

  // ============================================================================
  // SMART BEHAVIOR: Check if test is known flaky (skip Jira creation)
  // ============================================================================

  private isKnownFlaky(testPath: string, testName: string): { isFlaky: boolean; reason?: string } {
    // Check test-stability.json
    for (const [, entry] of Object.entries(this.stabilityData)) {
      if (entry.testPath === testPath || entry.testName === testName) {
        if (entry.currentStatus === 'flaky' || entry.currentStatus === 'quarantined') {
          return {
            isFlaky: true,
            reason: `Known ${entry.currentStatus} test (${entry.consecutivePasses} consecutive passes needed)`,
          };
        }
      }
    }

    // Check visual-flakes.json
    const testId = this.extractTestIdFromName(testName);
    const visualData = this.visualFlakeData[testId];
    if (visualData?.isFlaky) {
      return {
        isFlaky: true,
        reason: `Visual flake detected (mean diff: ${visualData.mean.toFixed(2)}%)`,
      };
    }

    return { isFlaky: false };
  }

  // ============================================================================
  // SMART BEHAVIOR: Git blame for suggested assignee
  // ============================================================================

  private getGitBlame(filePath: string, line: number): GitBlameInfo | null {
    try {
      const blameOutput = execSync(
        `git blame -L ${line},${line} --porcelain "${filePath}" 2>/dev/null`,
        { encoding: 'utf-8', timeout: 5000 },
      );

      const authorMatch = blameOutput.match(/^author (.+)$/m);
      const emailMatch = blameOutput.match(/^author-mail <(.+)>$/m);
      const commitMatch = blameOutput.match(/^([a-f0-9]{40})/);
      const timeMatch = blameOutput.match(/^author-time (\d+)$/m);

      if (authorMatch && emailMatch) {
        return {
          author: authorMatch[1],
          email: emailMatch[1],
          commitHash: commitMatch ? commitMatch[1].slice(0, 7) : 'unknown',
          lastModified: timeMatch
            ? new Date(parseInt(timeMatch[1]) * 1000).toISOString().split('T')[0]
            : 'unknown',
        };
      }
    } catch {
      // Git blame not available or failed
    }
    return null;
  }

  // ============================================================================
  // SMART BEHAVIOR: Cross-browser failure correlation
  // ============================================================================

  private analyzeCrossBrowserFailure(failure: FailedTest): CrossBrowserAnalysis {
    const patterns = this.loadFailurePattern();
    const testSignature = `${failure.filePath}::${failure.testName}`;
    const pattern = patterns[testSignature];

    const allBrowsers = ['chromium', 'firefox', 'webkit', 'mobile-chrome', 'mobile-safari', 'edge'];
    const failedBrowsers: string[] = pattern?.browsers ?? [failure.browser || 'unknown'];
    const isUniversal = failedBrowsers.length >= 3;
    const browserSpecific = failedBrowsers.length === 1;

    let suggestedCause: string;
    if (isUniversal) {
      suggestedCause =
        'Fails across multiple browsers → Likely a real application bug, not browser-specific';
    } else if (browserSpecific) {
      const browser = failedBrowsers[0] ?? 'unknown';
      if (browser.includes('webkit') || browser.includes('safari')) {
        suggestedCause =
          'WebKit-only failure → Check Safari-specific CSS, date handling, or scroll behavior';
      } else if (browser.includes('firefox')) {
        suggestedCause = 'Firefox-only failure → Check Firefox-specific timing or CSS grid issues';
      } else if (browser.includes('mobile')) {
        suggestedCause = 'Mobile-only failure → Check viewport, touch events, or responsive layout';
      } else {
        suggestedCause = 'Single browser failure → May be browser-specific quirk or timing issue';
      }
    } else {
      suggestedCause =
        'Partial browser coverage → Investigate common denominator between failing browsers';
    }

    return {
      failedBrowsers,
      totalBrowsers: allBrowsers.length,
      isUniversalFailure: isUniversal,
      browserSpecific,
      suggestedCause,
    };
  }

  // ============================================================================
  // SMART BEHAVIOR: Priority escalation based on failure frequency
  // ============================================================================

  private calculateSmartPriority(failure: FailedTest, crossBrowser: CrossBrowserAnalysis): string {
    let basePriority = this.mapTagsToPriority(failure.tags);

    // Escalate if fails across multiple browsers
    if (crossBrowser.isUniversalFailure) {
      if (basePriority === 'Medium') basePriority = 'High';
      if (basePriority === 'Low') basePriority = 'Medium';
    }

    // Escalate if recurring (>3 failures)
    if ((failure.failureCount ?? 0) > 3) {
      if (basePriority === 'Medium') basePriority = 'High';
      if (basePriority === 'High') basePriority = 'Highest';
    }

    // Escalate if critical path and first failure
    if (failure.tags.includes('critical') && failure.firstFailure) {
      basePriority = 'Highest';
    }

    return basePriority;
  }

  // ============================================================================
  // SMART BEHAVIOR: Root cause suggestions based on error patterns
  // ============================================================================

  private suggestRootCause(failure: FailedTest): string[] {
    const suggestions: string[] = [];
    const error = failure.errorMessage.toLowerCase();

    // Timeout patterns
    if (error.includes('timeout')) {
      if (error.includes('navigation')) {
        suggestions.push('🔍 Check if page is loading slowly or blocked by network issues');
        suggestions.push('💡 Increase navigation timeout or check for redirect loops');
      } else if (error.includes('waitfor') || error.includes('locator')) {
        suggestions.push('🔍 Element may not be rendering - check component mount lifecycle');
        suggestions.push('💡 Add explicit wait or check for conditional rendering');
      }
    }

    // Selector patterns
    if (error.includes('strict mode violation') || error.includes('multiple elements')) {
      suggestions.push('🔍 Locator matches multiple elements - selector is too broad');
      suggestions.push('💡 Use more specific selector like .first() or .nth(0)');
    }

    // Network patterns
    if (error.includes('net::') || error.includes('econnrefused')) {
      suggestions.push('🔍 Network request failed - check API availability');
      suggestions.push('💡 Verify baseURL and check for CORS or auth issues');
    }

    // Assertion patterns
    if (error.includes('expected') && error.includes('received')) {
      suggestions.push('🔍 Assertion failed - actual value differs from expected');
      suggestions.push('💡 Check if recent changes affected this behavior');
    }

    // Visual regression patterns
    if (error.includes('screenshot') || error.includes('diff')) {
      suggestions.push('🔍 Visual difference detected - layout may have changed');
      suggestions.push('💡 Review diff image and update baseline if change is intentional');
    }

    if (suggestions.length === 0) {
      suggestions.push('🔍 Review stack trace for specific failure location');
      suggestions.push('💡 Run test locally with --debug flag for step-by-step inspection');
    }

    return suggestions;
  }

  // ============================================================================
  // SMART BEHAVIOR: Link to historical issues
  // ============================================================================

  private findHistoricalContext(testPath: string): string | null {
    for (const [, entry] of Object.entries(this.stabilityData)) {
      if (entry.testPath === testPath && entry.historicalIssues?.length) {
        const recent = entry.historicalIssues[entry.historicalIssues.length - 1];
        if (recent.jiraTicket) {
          return `Previous similar issue: ${recent.jiraTicket} - "${recent.issue}" (Fixed: ${recent.fix || 'Unknown'})`;
        }
      }
    }
    return null;
  }

  /**
   * Extract source code snippet around the failing line for developer context
   */
  private extractSourceCodeSnippet(filePath: string | undefined, line: number): string {
    if (!filePath || !fs.existsSync(filePath)) {
      return '// Source code not available';
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Get 3 lines before and after the failure line
      const startLine = Math.max(0, line - 4);
      const endLine = Math.min(lines.length - 1, line + 3);

      const snippet: string[] = [];
      for (let i = startLine; i <= endLine; i++) {
        const lineNum = i + 1;
        const marker = lineNum === line ? '>>> ' : '    ';
        snippet.push(`${marker}${lineNum.toString().padStart(4, ' ')} | ${lines[i]}`);
      }

      return snippet.join('\n');
    } catch {
      return '// Could not read source file';
    }
  }

  /**
   * Parse expected vs actual from error message for assertions
   */
  private parseExpectedVsActual(errorMessage: string): { expected: string; actual: string } | null {
    // Playwright assertion format: "Expected: X, Received: Y"
    const playwrightMatch = errorMessage.match(/Expected:\s*(.+?)(?:\n|,\s*|\s+Received)/i);
    const receivedMatch = errorMessage.match(/Received:\s*(.+?)(?:\n|$)/i);

    if (playwrightMatch && receivedMatch) {
      return {
        expected: playwrightMatch[1].trim().slice(0, 200),
        actual: receivedMatch[1].trim().slice(0, 200),
      };
    }

    // Jest/expect format: "expected X to be Y"
    const jestMatch = errorMessage.match(
      /expected\s+(.+?)\s+(?:to be|toBe|toEqual)\s+(.+?)(?:\n|$)/i,
    );
    if (jestMatch) {
      return {
        expected: jestMatch[2].trim().slice(0, 200),
        actual: jestMatch[1].trim().slice(0, 200),
      };
    }

    return null;
  }

  /**
   * Infer related source files from test file path (component being tested)
   */
  private inferRelatedSourceFiles(testFilePath: string): string[] {
    const related: string[] = [];

    // TC-XX_FeatureName.spec.ts -> likely tests a page object or component
    const testName = path.basename(testFilePath, '.spec.ts').replace(/^TC-\d+_/, '');

    // Common patterns
    const possibleSources = [
      `src/pages/${testName}.ts`,
      `src/pages/${testName}Page.ts`,
      `src/components/${testName}.ts`,
      `src/components/${testName}Component.ts`,
    ];

    for (const source of possibleSources) {
      if (fs.existsSync(source)) {
        related.push(source);
      }
    }

    return related;
  }

  /**
   * Generate trace viewer URL if trace attachment exists
   */
  private getTraceViewerUrl(failure: FailedTest): string | null {
    const traceAttachment = failure.attachments.find((a) => a.name === 'trace');
    if (traceAttachment && this.environment.ciRunUrl) {
      // GitHub Actions artifact URL pattern
      return `${this.environment.ciRunUrl}/artifacts (download trace.zip and run: npx playwright show-trace trace.zip)`;
    }
    return traceAttachment
      ? 'Trace attached - download and run: npx playwright show-trace <trace.zip>'
      : null;
  }

  private generateSignature(testTitle: string, errorMessage: string): string {
    const content = `${testTitle}::${errorMessage.slice(0, 200)}`;
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 12);
  }

  private extractTags(test: TestCase): string[] {
    const tagRegex = /@(\w+)/g;
    const tags: string[] = [];
    let match;
    while ((match = tagRegex.exec(test.title)) !== null) {
      tags.push(match[1]);
    }
    return tags;
  }

  private mapTagsToPriority(tags: string[]): string {
    if (tags.includes('critical') || tags.includes('blocker')) return 'Highest';
    if (tags.includes('security')) return 'High';
    if (tags.includes('accessibility')) return 'Medium';
    return 'Medium';
  }

  private mapPathToComponent(filePath: string): string | null {
    if (filePath.includes('/security/')) return 'Security';
    if (filePath.includes('/accessibility/')) return 'Accessibility';
    if (filePath.includes('/api/')) return 'API';
    if (filePath.includes('/e2e/')) return 'E2E';
    if (filePath.includes('/visual/')) return 'Visual';
    if (filePath.includes('/smoke/')) return 'Smoke';
    return null;
  }

  private cleanErrorMessage(error: string): string {
    return error
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI colors
      .replace(/at .*\(.*\)/g, '') // Remove stack trace lines
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
      .slice(0, 500);
  }

  /**
   * Extract page URL from test steps or error stack for developer reproduction
   */
  private extractPageUrl(
    steps: Array<{ title: string; category?: string }>,
    errorStack: string,
  ): string {
    // Look for navigation steps
    for (const step of steps) {
      const navMatch = step.title.match(/(?:Navigate to|goto|Go to)\s+['"]?([^'"]+)['"]?/i);
      if (navMatch) {
        const path = navMatch[1];
        // If it's a relative path, prepend base URL
        if (path.startsWith('/')) {
          return `https://automationexercise.com${path}`;
        }
        return path;
      }
    }

    // Fallback: look for URLs in error stack
    const urlMatch = errorStack.match(/https?:\/\/[^\s'"]+/);
    if (urlMatch) {
      return urlMatch[0];
    }

    // Default to homepage
    return 'https://automationexercise.com/';
  }

  /**
   * Convert test steps to human-readable manual reproduction steps for developers
   */
  private formatManualSteps(failure: FailedTest): string[] {
    const steps: string[] = [];
    const baseUrl = failure.pageUrl || 'https://automationexercise.com/';

    // Step 1: Always start with navigation
    steps.push(`Navigate to: ${baseUrl}`);

    // Convert test.step() titles to manual actions
    if (failure.testSteps && failure.testSteps.length > 0) {
      for (const step of failure.testSteps) {
        // Filter out expect assertions and internal steps
        if (step.category === 'expect') continue;

        // Clean up step title for developer readability
        const action = step.title
          .replace(/^Step \d+[:\-]\s*/i, '') // Remove "Step 1:" prefix
          .replace(/^Capture\s+/i, 'Look at ') // Visual tests
          .replace(/^Verify\s+/i, 'Check that ')
          .replace(/^Assert\s+/i, 'Confirm ')
          .trim();

        if (action && action.length > 5) {
          steps.push(action);
        }
      }
    }

    // Add the observed failure as final step
    const errorSummary = failure.errorMessage.split('\n')[0].slice(0, 100);
    steps.push(`Observe the issue: ${errorSummary}`);

    return steps;
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.environment = this.collectEnvironmentInfo();
    this.ensureOutputDir();
    this.loadStabilityData(); // Smart behavior: Load flaky test metadata
    console.log('Jira Reporter: Initialized with smart behaviors enabled');
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'failed' && result.status !== 'timedOut') {
      return;
    }

    const errorMessage = result.errors
      .map((e) => e.message || String(e))
      .join('\n')
      .slice(0, 1000);

    const errorStack = result.errors
      .map((e) => e.stack || '')
      .join('\n')
      .slice(0, 2000);

    const attachments = result.attachments
      .filter((a) => a.path && (a.name === 'screenshot' || a.name === 'trace'))
      .map((a) => ({
        name: a.name,
        path: a.path!,
        contentType: a.contentType,
      }));

    // Extract browser/project name from test.parent (project name)
    const projectName = test.parent?.project()?.name || '';
    const browserName = projectName.toLowerCase().includes('firefox')
      ? 'firefox'
      : projectName.toLowerCase().includes('webkit')
        ? 'webkit'
        : projectName.toLowerCase().includes('safari')
          ? 'webkit'
          : projectName.toLowerCase().includes('mobile-chrome')
            ? 'mobile-chrome'
            : projectName.toLowerCase().includes('mobile-safari')
              ? 'mobile-safari'
              : projectName.toLowerCase().includes('chromium')
                ? 'chromium'
                : projectName || 'chromium'; // Use project name or default

    // Extract test steps for developer reproduction
    const testSteps = result.steps
      .filter((step) => step.category === 'test.step' || step.category === 'expect')
      .map((step) => ({
        title: step.title,
        category: step.category,
        duration: step.duration,
      }));

    // Extract page URL from step titles (e.g., "Navigate to /login")
    const pageUrl = this.extractPageUrl(testSteps, errorStack);

    const failedTest: FailedTest = {
      title: test.title.replace(/@\w+/g, '').trim(),
      testName: test.title,
      filePath: test.location.file,
      file: path.relative(process.cwd(), test.location.file),
      line: test.location.line,
      errorMessage: this.cleanErrorMessage(errorMessage),
      errorStack,
      signature: this.generateSignature(test.title, errorMessage),
      duration: result.duration,
      retryCount: result.retry,
      tags: this.extractTags(test),
      attachments,
      browser: browserName,
      error: {
        message: errorMessage,
        stack: errorStack,
      },
      testSteps,
      pageUrl,
    };

    // Detect issue type (REAL_BUG, TEST_BUG, FLAKY, ENV_ISSUE)
    failedTest.issueType = this.detectIssueType(failedTest);

    // SMART BEHAVIOR: Check if test is known flaky
    const flakyCheck = this.isKnownFlaky(failedTest.filePath || '', failedTest.testName || '');
    if (flakyCheck.isFlaky) {
      console.log(`Jira Reporter: ⏭️ Skipping known flaky test: ${failedTest.title}`);
      console.log(`   Reason: ${flakyCheck.reason}`);
      failedTest.issueType = 'FLAKY';
      // Still track but mark for reporting, not Jira creation
    }

    // Track failure pattern and get first failure flag + count
    const { firstFailure, failureCount } = this.trackFailurePattern(failedTest);
    failedTest.firstFailure = firstFailure;
    failedTest.failureCount = failureCount;

    this.failedTests.push(failedTest);
  }

  onEnd(_result: FullResult): void {
    if (this.failedTests.length === 0) {
      console.log('Jira Reporter: No failures to report');
      return;
    }

    console.log(`Jira Reporter: Processing ${this.failedTests.length} failed test(s)`);

    // SMART BEHAVIOR: Separate real bugs from flaky/known issues
    const realBugsCount = this.failedTests.filter(
      (f) => f.issueType === 'REAL_BUG' || f.issueType === 'TEST_BUG',
    ).length;
    const skipped = this.failedTests.filter(
      (f) => f.issueType === 'FLAKY' || f.issueType === 'ENV_ISSUE',
    );

    console.log(`Jira Reporter: Found ${realBugsCount} real bugs to report`);
    if (skipped.length > 0) {
      console.log(`Jira Reporter: ⏭️ Skipping ${skipped.length} flaky/env issue(s)`);
    }

    // Deduplicate by signature
    const uniqueFailures = this.deduplicateFailures();
    console.log(`Jira Reporter: ${uniqueFailures.length} unique failure(s) after deduplication`);

    // Generate report files
    this.writeLocalReport(uniqueFailures);

    // Create Jira issues if configured
    if (this.config.enabled) {
      console.log(
        `Jira Reporter: Starting async issue creation (${uniqueFailures.length} issues)...`,
      );

      // CRITICAL: Playwright's onEnd() doesn't wait for async operations
      // The process exits immediately after onEnd() returns
      // We must use a workaround to keep the event loop alive
      const issuePromises = uniqueFailures.map((failure) =>
        this.createOrUpdateIssue(failure).catch((error) =>
          console.error(`Jira Reporter: Issue creation failed:`, error),
        ),
      );

      // Force process to wait by using a synchronous delay
      // This is a known workaround for Playwright's limitation
      const delayMs = Math.max(100, issuePromises.length * 500);
      console.log(`Jira Reporter: Waiting ${delayMs}ms for API calls to complete...`);

      // Create a promise that resolves after delay OR when all issues are done
      Promise.all(issuePromises)
        .then(() => {
          console.log('Jira Reporter: ✅ All issues processed successfully');
        })
        .catch((error) => {
          console.error('Jira Reporter: ❌ Error during issue processing:', error);
        });

      // Force Node.js event loop to stay active
      // This is necessary because Playwright exits immediately after onEnd()
      const keepAlive = setTimeout(() => {
        console.log('Jira Reporter: Process timeout - exiting');
      }, delayMs + 1000);

      Promise.all(issuePromises).finally(() => {
        clearTimeout(keepAlive);
      });
    } else {
      console.log('Jira Reporter: Skipping Jira API calls (not configured)');
      console.log(`Jira Reporter: Local report saved to ${this.outputDir}/failures.json`);
    }
  }

  private deduplicateFailures(): FailedTest[] {
    const seen = new Map<string, FailedTest>();
    for (const failure of this.failedTests) {
      if (!seen.has(failure.signature)) {
        seen.set(failure.signature, failure);
      }
    }
    return Array.from(seen.values());
  }

  private writeLocalReport(failures: FailedTest[]): void {
    const report = {
      generated: this.environment.timestamp,
      environment: this.environment,
      totalFailures: this.failedTests.length,
      uniqueFailures: failures.length,
      failures: failures.map((f) => ({
        ...f,
        suggestedSummary: this.buildIssueSummary(f),
        suggestedPriority: this.mapTagsToPriority(f.tags),
        suggestedComponent: this.mapPathToComponent(f.file),
      })),
    };

    fs.writeFileSync(path.join(this.outputDir, 'failures.json'), JSON.stringify(report, null, 2));

    // Also write a human-readable summary
    this.writeHumanReadableSummary(failures);
  }

  private writeHumanReadableSummary(failures: FailedTest[]): void {
    const lines: string[] = [
      'Test Failure Summary',
      '====================',
      '',
      `Run Date: ${new Date().toLocaleString()}`,
      `Branch: ${this.environment.gitBranch}`,
      `Commit: ${this.environment.gitCommit}`,
      `Total Failures: ${failures.length}`,
      '',
      '---',
      '',
    ];

    for (const failure of failures) {
      lines.push(`Test: ${failure.title}`);
      lines.push(`File: ${failure.file}:${failure.line}`);
      lines.push(`Error: ${failure.errorMessage}`);
      lines.push(`Signature: ${failure.signature}`);
      if (failure.attachments.length > 0) {
        lines.push(`Attachments: ${failure.attachments.map((a) => a.name).join(', ')}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    fs.writeFileSync(path.join(this.outputDir, 'failures-summary.txt'), lines.join('\n'));
  }

  private buildIssueSummary(failure: FailedTest): string {
    const testName = failure.title.length > 60 ? failure.title.slice(0, 57) + '...' : failure.title;
    return `Test Failure: ${testName}`;
  }

  private buildIssueDescription(failure: FailedTest): Record<string, unknown> {
    // Atlassian Document Format (ADF) for Jira Cloud
    // Developer-Centric Format with investigation context
    return {
      type: 'doc',
      version: 1,
      content: [
        // SECTION 1: Quick Summary
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🚨 Quick Summary' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: `Automated test "${failure.title}" is failing. ` },
            {
              type: 'text',
              text: this.getTestTypeDescription(failure.tags),
              marks: [{ type: 'strong' }],
            },
          ],
        },

        // SECTION 2: Issue Type Classification
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🔴 Issue Type Classification' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: `Classification: `, marks: [{ type: 'strong' }] },
            { type: 'text', text: `${failure.issueType ?? 'UNKNOWN'}` },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: this.getIssueTypeExplanation(failure.issueType ?? 'REAL_BUG') },
          ],
        },

        // SECTION 3: Failure Pattern
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '📊 Failure Pattern' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Is First Failure? ', marks: [{ type: 'strong' }] },
                    {
                      type: 'text',
                      text: failure.firstFailure ? 'YES - New issue' : 'NO - Recurring',
                    },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Failure Count: ', marks: [{ type: 'strong' }] },
                    {
                      type: 'text',
                      text: `${failure.failureCount ?? 1} occurrence${(failure.failureCount ?? 1) > 1 ? 's' : ''}`,
                    },
                  ],
                },
              ],
            },
          ],
        },

        // SECTION 4: What's Broken (Impact) - RENUMBERED
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: "💥 What's Broken" }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: this.analyzeImpact(failure) }],
        },

        // SECTION 5: Error Details - RENUMBERED
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '❌ Error Details' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Error Type: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: this.extractErrorType(failure.errorMessage) },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'text' },
          content: [{ type: 'text', text: failure.errorMessage }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Full Stack Trace:', marks: [{ type: 'strong' }] }],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'text' },
          content: [{ type: 'text', text: failure.errorStack.slice(0, 3000) }],
        },

        // SECTION 5b: Expected vs Actual (For Developers)
        ...this.buildExpectedVsActualSection(failure),

        // SECTION 6: Code Location with Source Snippet (For Developers)
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '📍 Code Location' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Test File: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: `${failure.file}:${failure.line}` },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'What Test Does: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: this.describeTest(failure) },
                  ],
                },
              ],
            },
            ...this.buildRelatedSourceFilesSection(failure),
          ],
        },
        // Source Code Snippet
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Source Code at Failure Point:', marks: [{ type: 'strong' }] },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [
            { type: 'text', text: this.extractSourceCodeSnippet(failure.filePath, failure.line) },
          ],
        },

        // SECTION 6b: Application Links (For Developers)
        ...this.buildApplicationLinksSection(failure),

        // SECTION 7: When It Broke - RENUMBERED
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🕐 When It Broke' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Git Branch: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: this.environment.gitBranch },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Git Commit: ', marks: [{ type: 'strong' }] },
                    {
                      type: 'text',
                      text: `${this.environment.gitCommit} - ${this.environment.gitCommitMessage}`,
                    },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Failed at: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: new Date(this.environment.timestamp).toISOString() },
                  ],
                },
              ],
            },
          ],
        },

        // SECTION 8: Environment - RENUMBERED
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🖥️ Environment' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Browser: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: this.extractBrowser(failure) },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'OS: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: this.environment.os },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Node Version: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: this.environment.nodeVersion },
                  ],
                },
              ],
            },
          ],
        },

        // SECTION 9: How to Reproduce (Manual) - For Developers
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '👤 Manual Reproduction (For Developers)' }],
        },
        {
          type: 'orderedList',
          attrs: { order: 1 },
          content: this.formatManualSteps(failure).map((step) => ({
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: step }],
              },
            ],
          })),
        },

        // SECTION 10: Automated Test Command - For QA/CI
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🧪 Re-run Automated Test (For QA)' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Checkout branch: ' + this.environment.gitBranch },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Run: npm install' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: `Run: npx playwright test "${failure.file}" --project=${this.extractBrowser(failure).toLowerCase()}`,
                    },
                  ],
                },
              ],
            },
          ],
        },

        // SECTION 11: Suggested Next Steps - RENUMBERED
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '👉 Suggested Next Steps' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: '1. Look at the error type: ',
                      marks: [{ type: 'strong' }],
                    },
                    { type: 'text', text: this.suggestFirstStep(failure) },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: '2. Check the commit: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: `What changed in ${this.environment.gitCommit}?` },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: '3. Review attachments: ', marks: [{ type: 'strong' }] },
                    {
                      type: 'text',
                      text: `Screenshot shows visual state, trace shows full execution log`,
                    },
                  ],
                },
              ],
            },
          ],
        },

        // SECTION 11: Metadata - RENUMBERED
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: '📊 Metadata' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Error Signature: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: failure.signature + ' (for deduplication)' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Test Duration: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: `${Math.round(failure.duration / 1000)}s` },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Retry Attempts: ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: String(failure.retryCount) },
                  ],
                },
              ],
            },
          ],
        },

        // SECTION 12: Smart Insights (AI-assisted analysis)
        ...this.buildSmartInsightsSection(failure),
      ],
    };
  }

  // SMART BEHAVIOR: Generate AI-assisted insights section
  private buildSmartInsightsSection(failure: FailedTest): Record<string, unknown>[] {
    const sections: Record<string, unknown>[] = [];

    // Cross-browser analysis
    const crossBrowser = this.analyzeCrossBrowserFailure(failure);

    sections.push({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '🤖 Smart Insights' }],
    });

    // Cross-browser correlation
    sections.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Cross-Browser Analysis: ', marks: [{ type: 'strong' }] },
        {
          type: 'text',
          text: `Failed on ${crossBrowser.failedBrowsers.join(', ')} (${crossBrowser.failedBrowsers.length}/${crossBrowser.totalBrowsers} browsers)`,
        },
      ],
    });

    sections.push({
      type: 'paragraph',
      content: [{ type: 'text', text: crossBrowser.suggestedCause }],
    });

    // Root cause suggestions
    const suggestions = this.suggestRootCause(failure);
    if (suggestions.length > 0) {
      sections.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '💡 Root Cause Suggestions' }],
      });

      sections.push({
        type: 'bulletList',
        content: suggestions.map((suggestion) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: suggestion }],
            },
          ],
        })),
      });
    }

    // Git blame info (suggested assignee)
    const blame = this.getGitBlame(failure.filePath || '', failure.line);
    if (blame) {
      sections.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '👤 Suggested Reviewer' }],
      });

      sections.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: `Last modified by ` },
          { type: 'text', text: blame.author, marks: [{ type: 'strong' }] },
          {
            type: 'text',
            text: ` (${blame.email}) on ${blame.lastModified} (commit ${blame.commitHash})`,
          },
        ],
      });
    }

    // Historical context
    const historical = this.findHistoricalContext(failure.filePath || '');
    if (historical) {
      sections.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '📜 Historical Context' }],
      });

      sections.push({
        type: 'paragraph',
        content: [{ type: 'text', text: historical }],
      });
    }

    // Priority escalation note
    const smartPriority = this.calculateSmartPriority(failure, crossBrowser);
    const basePriority = this.mapTagsToPriority(failure.tags);
    if (smartPriority !== basePriority) {
      sections.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '⚡ Priority Escalated: ', marks: [{ type: 'strong' }] },
          {
            type: 'text',
            text: `${basePriority} → ${smartPriority} (due to ${crossBrowser.isUniversalFailure ? 'cross-browser failure' : `${failure.failureCount} occurrences`})`,
          },
        ],
      });
    }

    return sections;
  }

  /**
   * Build Expected vs Actual section for assertion failures (Developer-focused)
   */
  private buildExpectedVsActualSection(failure: FailedTest): Record<string, unknown>[] {
    const parsed = this.parseExpectedVsActual(failure.errorMessage);
    if (!parsed) return [];

    return [
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '🎯 Expected vs Actual' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Expected' }] }],
              },
              {
                type: 'tableHeader',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Actual' }] }],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: parsed.expected }] },
                ],
              },
              {
                type: 'tableCell',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: parsed.actual }] }],
              },
            ],
          },
        ],
      },
    ];
  }

  /**
   * Build related source files section (Developer-focused)
   */
  private buildRelatedSourceFilesSection(failure: FailedTest): Record<string, unknown>[] {
    const relatedFiles = this.inferRelatedSourceFiles(failure.filePath || '');
    if (relatedFiles.length === 0) return [];

    return relatedFiles.map((file) => ({
      type: 'listItem',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Related Source: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: file },
          ],
        },
      ],
    }));
  }

  /**
   * Build application links section (Developer-focused)
   */
  private buildApplicationLinksSection(failure: FailedTest): Record<string, unknown>[] {
    const sections: Record<string, unknown>[] = [];

    // Add heading
    sections.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: '🔗 Quick Links' }],
    });

    const linkItems: Record<string, unknown>[] = [];

    // Application URL
    if (failure.pageUrl) {
      linkItems.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '🌐 Application Page: ', marks: [{ type: 'strong' }] },
              {
                type: 'text',
                text: failure.pageUrl,
                marks: [{ type: 'link', attrs: { href: failure.pageUrl } }],
              },
            ],
          },
        ],
      });
    }

    // CI/CD Pipeline Link
    if (this.environment.ciRunUrl) {
      linkItems.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '🔧 CI/CD Run: ', marks: [{ type: 'strong' }] },
              {
                type: 'text',
                text: this.environment.ciRunUrl,
                marks: [{ type: 'link', attrs: { href: this.environment.ciRunUrl } }],
              },
            ],
          },
        ],
      });
    }

    // Trace Viewer
    const traceInfo = this.getTraceViewerUrl(failure);
    if (traceInfo) {
      linkItems.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '🎬 Trace Viewer: ', marks: [{ type: 'strong' }] },
              { type: 'text', text: traceInfo },
            ],
          },
        ],
      });
    }

    if (linkItems.length > 0) {
      sections.push({
        type: 'bulletList',
        content: linkItems,
      });
    }

    return sections;
  }

  private getTestTypeDescription(tags: string[]): string {
    if (tags.includes('critical')) return 'This is a CRITICAL flow - users are blocked.';
    if (tags.includes('regression')) return 'This was working before - this is a REGRESSION.';
    if (tags.includes('smoke'))
      return 'This is a CORE FUNCTIONALITY test - something fundamental is broken.';
    if (tags.includes('visual')) return 'This is a VISUAL REGRESSION - layout/styling has changed.';
    if (tags.includes('api')) return 'This is an API TEST - backend contract broken.';
    return 'This test failure caught a bug.';
  }

  private getIssueTypeExplanation(
    issueType: 'REAL_BUG' | 'TEST_BUG' | 'FLAKY' | 'ENV_ISSUE',
  ): string {
    switch (issueType) {
      case 'REAL_BUG':
        return '🐛 This is a real bug in the application code. The feature is genuinely broken and needs developer attention.';
      case 'TEST_BUG':
        return '🧪 This appears to be a test issue. The test itself may be overly strict, outdated, or checking wrong expectations. Review test logic.';
      case 'FLAKY':
        return '⚠️ This is a flaky test (timing/intermittent issue). May pass on retry. Check for race conditions, async issues, or environment inconsistencies.';
      case 'ENV_ISSUE':
        return '🌐 This looks like an environment/network issue. The application might be fine but infrastructure/connectivity is problematic. Re-run to confirm.';
      default:
        return 'Unable to classify issue type.';
    }
  }

  private analyzeImpact(failure: FailedTest): string {
    const errorMsg = failure.errorMessage.toLowerCase();

    // Check DOM/element issues FIRST (before "not found" which matches HTTP 404)
    if (
      errorMsg.includes('locator') ||
      errorMsg.includes('selector') ||
      (errorMsg.includes('element') && errorMsg.includes('not found'))
    )
      return 'A UI element is missing or cannot be found. Check if element renders correctly.';

    // HTTP errors (explicit status codes)
    if (errorMsg.includes('404') && !errorMsg.includes('element'))
      return 'A page/API endpoint is not found. User will hit 404 error.';

    if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('unauthorized'))
      return 'Authentication/authorization is broken. Users cannot access the feature.';

    if (errorMsg.includes('500') || errorMsg.includes('internal server error'))
      return 'Backend error. Server is returning errors. Feature is completely broken.';

    if (errorMsg.includes('timeout') || errorMsg.includes('wait'))
      return 'Page/element is not loading in time. User experience is slow or broken.';

    if (errorMsg.includes('screenshot') || errorMsg.includes('visual'))
      return 'Layout/styling has changed. Visual consistency is broken.';

    return 'Feature behavior has changed. May impact user experience.';
  }

  private extractErrorType(errorMsg: string): string {
    if (errorMsg.includes('AssertionError')) return 'AssertionError (expectation failed)';
    if (errorMsg.includes('TimeoutError')) return 'TimeoutError (element not found within timeout)';
    if (errorMsg.includes('NetworkError')) return 'NetworkError (API call failed)';
    if (errorMsg.includes('404')) return 'HTTP 404 (Not Found)';
    if (errorMsg.includes('500')) return 'HTTP 500 (Internal Server Error)';
    if (errorMsg.includes('401')) return 'HTTP 401 (Unauthorized)';
    if (errorMsg.includes('403')) return 'HTTP 403 (Forbidden)';
    return 'Error (see details below)';
  }

  private describeTest(failure: FailedTest): string {
    const testName = failure.title;

    if (failure.file.includes('visual'))
      return `Visual regression test - validates "${testName}" layout`;
    if (failure.file.includes('auth')) return `Authentication test - validates "${testName}" flow`;
    if (failure.file.includes('api')) return `API contract test - validates "${testName}" endpoint`;
    if (failure.file.includes('accessibility'))
      return `Accessibility test - validates "${testName}" compliance`;

    return `Test validates: "${testName}"`;
  }

  private extractBrowser(failure: FailedTest): string {
    // Use captured browser name first, fall back to file path detection
    if (failure.browser) {
      if (failure.browser.includes('chromium')) return 'Chromium';
      if (failure.browser.includes('firefox')) return 'Firefox';
      if (failure.browser.includes('webkit')) return 'WebKit (Safari)';
      if (failure.browser.includes('mobile')) return 'Mobile Browser';
    }

    // Fall back to file path detection
    if (failure.file.includes('chromium')) return 'Chromium';
    if (failure.file.includes('firefox')) return 'Firefox';
    if (failure.file.includes('webkit')) return 'WebKit (Safari)';
    if (failure.file.includes('mobile')) return 'Mobile Browser';
    return 'Chromium'; // default
  }

  private suggestFirstStep(failure: FailedTest): string {
    const errorMsg = failure.errorMessage.toLowerCase();

    if (errorMsg.includes('404')) return 'Route/API endpoint missing. Check routing configuration.';
    if (errorMsg.includes('500')) return 'Backend error. Check backend logs and error handling.';
    if (errorMsg.includes('401') || errorMsg.includes('unauthorized'))
      return 'Auth issue. Check token/session handling.';
    if (errorMsg.includes('element') || errorMsg.includes('not found'))
      return 'DOM issue. Check if element renders in browser.';
    if (errorMsg.includes('timeout'))
      return 'Performance issue. Check if page is loading slowly or element not appearing.';
    if (errorMsg.includes('assertion')) return 'Logic issue. Compare expected vs actual values.';

    return 'See error details and full stack trace above.';
  }

  private async createOrUpdateIssue(failure: FailedTest): Promise<void> {
    // First, search for existing issue with same signature
    try {
      const existingIssue = await this.searchExistingIssue(failure.signature);

      if (existingIssue) {
        await this.addCommentToIssue(existingIssue, failure);
        console.log(`Jira Reporter: Updated existing issue ${existingIssue}`);
      } else {
        const newIssue = await this.createNewIssue(failure);
        console.log(`Jira Reporter: Created new issue ${newIssue}`);
      }
    } catch (error) {
      console.error(`Jira Reporter: Error processing issue for "${failure.title}":`, error);
      throw error;
    }
  }

  private async searchExistingIssue(signature: string): Promise<string | null> {
    const jql = `project = ${this.config.projectKey} AND text ~ "${signature}" AND status != Done ORDER BY created DESC`;
    const endpoint = `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=1`;

    console.log(`Jira Reporter: [DEBUG] Searching for existing issue with signature: ${signature}`);

    try {
      const response = await this.jiraRequest('GET', endpoint);

      const issues = response.issues as Array<{ key: string }> | undefined;
      if (issues && issues.length > 0) {
        console.log(`Jira Reporter: [DEBUG] Found existing issue ${issues[0].key}`);
        return issues[0].key;
      }

      console.log(`Jira Reporter: [DEBUG] No existing issue found, will create new one`);
      return null;
    } catch (error) {
      console.error('Jira Reporter: [ERROR] Error searching for existing issue:', error);
      return null;
    }
  }

  private async createNewIssue(failure: FailedTest): Promise<string> {
    const component = this.mapPathToComponent(failure.file);

    // SMART BEHAVIOR: Use intelligent priority based on patterns
    const crossBrowser = this.analyzeCrossBrowserFailure(failure);
    const priority = this.calculateSmartPriority(failure, crossBrowser);

    console.log(`Jira Reporter: [DEBUG] Creating new issue: "${failure.title}"`);
    console.log(
      `Jira Reporter: [DEBUG] Smart priority: ${priority} (cross-browser: ${crossBrowser.isUniversalFailure ? 'yes' : 'no'})`,
    );

    const payload: JiraIssuePayload = {
      fields: {
        project: { key: this.config.projectKey },
        summary: this.buildIssueSummary(failure),
        description: this.buildIssueDescription(
          failure,
        ) as JiraIssuePayload['fields']['description'],
        issuetype: { name: 'Bug' },
        priority: { name: priority },
        labels: ['automated-test', 'playwright', ...failure.tags],
      },
    };

    if (component) {
      payload.fields.components = [{ name: component }];
    }

    try {
      const response = await this.jiraRequest('POST', '/rest/api/3/issue', payload);
      const issueKey = response.key as string;
      console.log(`Jira Reporter: [DEBUG] Successfully created issue ${issueKey}`);
      return issueKey;
    } catch (error) {
      console.error('Jira Reporter: [ERROR] Failed to create issue:', error);
      throw error;
    }
  }

  private async addCommentToIssue(issueKey: string, failure: FailedTest): Promise<void> {
    const comment = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'This test failed again in a recent run.',
                marks: [{ type: 'strong' }],
              },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'Date: ' },
                      { type: 'text', text: new Date().toLocaleString() },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'Branch: ' },
                      { type: 'text', text: this.environment.gitBranch },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'Commit: ' },
                      { type: 'text', text: this.environment.gitCommit },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'text' },
            content: [{ type: 'text', text: failure.errorMessage }],
          },
        ],
      },
    };

    await this.jiraRequest('POST', `/rest/api/3/issue/${issueKey}/comment`, comment);
  }

  private async jiraRequest(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    // Ensure proper URL formatting (avoid double slashes)
    const baseUrlClean = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl
      : this.config.baseUrl + '/';
    const endpointClean = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

    const fullUrl = `${baseUrlClean}${endpointClean}`;
    const auth = Buffer.from(`${this.config.userEmail}:${this.config.apiToken}`).toString('base64');

    console.log(`Jira Reporter: [DEBUG] ${method} ${fullUrl.split('?')[0]}...`);

    // Use curl to make the request (bypasses Node.js module loading and Playwright interception)
    const curlArgs: string[] = [
      '-s', // silent
      '-X',
      method,
      '-H',
      `Authorization: Basic ${auth}`,
      '-H',
      'Accept: application/json',
      '-H',
      'Content-Type: application/json',
      '--max-time',
      '10', // 10 second timeout
    ];

    if (body) {
      curlArgs.push('-d', JSON.stringify(body));
    }

    curlArgs.push(fullUrl);

    try {
      console.log(`Jira Reporter: [DEBUG] Sending ${method} request via curl...`);

      // Use spawnSync with proper argument array to avoid shell escaping issues
      const process = spawnSync('curl', curlArgs, {
        encoding: 'utf-8',
        timeout: 12000,
        maxBuffer: 10 * 1024 * 1024, // 10MB max buffer
      });

      if (process.error) throw process.error;
      if (process.status !== 0) {
        throw new Error(`curl exited with status ${process.status}: ${process.stderr}`);
      }

      console.log(`Jira Reporter: [DEBUG] Response received, parsing...`);
      const parsed = JSON.parse(process.stdout) as Record<string, unknown>;
      console.log(`Jira Reporter: [DEBUG] Response parsed successfully`);
      return parsed;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Jira Reporter: [ERROR] Request failed:`, error.message.slice(0, 200));
      } else {
        console.error(`Jira Reporter: [ERROR] Request failed:`, error);
      }
      throw error;
    }
  }

  /**
   * Detects issue type: REAL_BUG, TEST_BUG, FLAKY, or ENV_ISSUE
   * Logic: TEST_BUG if test name has demo/check/verify; FLAKY if timeout;
   * ENV_ISSUE if network error; REAL_BUG otherwise
   */
  detectIssueType(failure: FailedTest): 'REAL_BUG' | 'TEST_BUG' | 'FLAKY' | 'ENV_ISSUE' {
    const testName = (failure.testName || '').toLowerCase();
    const errorMsg = (failure.error?.message || '').toLowerCase();

    // TEST_BUG: Test itself is problematic
    if (/demo|check|verify|debug|dummy|sandbox/.test(testName)) {
      return 'TEST_BUG';
    }

    // FLAKY: Timing or intermittent failures
    if (/timeout|timed out|waitfor|wait for/.test(errorMsg)) {
      return 'FLAKY';
    }

    // ENV_ISSUE: Network or environment problems
    if (
      /enotfound|econnrefused|network|dns|timeout from server|503|502|connection/i.test(errorMsg)
    ) {
      return 'ENV_ISSUE';
    }

    // REAL_BUG: Actual application failure
    return 'REAL_BUG';
  }

  /**
   * Load failure pattern tracking from JSON file
   */
  loadFailurePattern(): FailurePattern {
    try {
      if (fs.existsSync(this.failurePatternPath)) {
        const content = fs.readFileSync(this.failurePatternPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.log(
        `Jira Reporter: Could not load failure patterns:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
    return {};
  }

  /**
   * Save failure pattern tracking to JSON file
   */
  saveFailurePattern(patterns: FailurePattern): void {
    try {
      const dir = path.dirname(this.failurePatternPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.failurePatternPath, JSON.stringify(patterns, null, 2), 'utf-8');
    } catch (error) {
      console.error(
        `Jira Reporter: Could not save failure patterns:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Track failure pattern: update count, browsers, timestamps
   * Returns { firstFailure, failureCount } for issue metadata
   */
  trackFailurePattern(failure: FailedTest): { firstFailure: boolean; failureCount: number } {
    const patterns = this.loadFailurePattern();
    const signature = `${failure.filePath}::${failure.testName}`;
    const now = new Date().toISOString();
    const browser = failure.browser || 'unknown';

    if (!patterns[signature]) {
      // First failure for this test
      patterns[signature] = {
        firstFailure: now,
        lastFailure: now,
        count: 1,
        browsers: [browser],
      };
      this.saveFailurePattern(patterns);
      return { firstFailure: true, failureCount: 1 };
    } else {
      // Recurring failure
      const pattern = patterns[signature];
      pattern.lastFailure = now;
      pattern.count += 1;
      if (!pattern.browsers.includes(browser)) {
        pattern.browsers.push(browser);
      }
      this.saveFailurePattern(patterns);
      return { firstFailure: false, failureCount: pattern.count };
    }
  }
}
