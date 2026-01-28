 
/**
 * Structured Logging Reporter for Playwright
 *
 * This custom reporter provides:
 * - Aggregated log output per test
 * - JSON export for CI/CD parsing
 * - Performance metrics tracking
 * - Error correlation with test failures
 * - Summary statistics
 *
 * @usage Add to playwright.config.ts:
 * reporter: [
 *   ['html'],
 *   ['./src/utils/LogReporter.ts']
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

interface TestStats {
  title: string;
  duration: number;
}

interface LogStats {
  totalLogs: number;
  errorLogs: number;
  warnLogs: number;
  infoLogs: number;
  debugLogs: number;
}

interface TestSummary {
  passed: number;
  failed: number;
  skipped: number;
  timedOut: number;
  totalTests: number;
  totalDuration: number;
  avgDuration: number;
  slowestTests: TestStats[];
  logStats: LogStats;
}

interface TestLog {
  testId: string;
  testTitle: string;
  file: string;
  duration: number;
  status: string;
  errors: string[];
  logs: LogEntry[];
  performance: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export default class LogReporter implements Reporter {
  private testLogs: TestLog[] = [];
  private outputDir: string = 'test-results/logs';
  private startTime: number = 0;

  constructor() {
    // Ensure output directory exists
    this.ensureOutputDir();
  }

  onBegin(config: FullConfig, _suite: Suite) {
    this.startTime = Date.now();

    console.log(`\n📊 Structured Logging Reporter initialized`);
    console.log(`📁 Logs will be saved to: ${path.resolve(this.outputDir)}`);
    console.log(`🧪 Running ${_suite.allTests().length} tests across ${config.workers} workers\n`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const testLog: TestLog = {
      testId: test.id,
      testTitle: test.title,
      file: test.location.file,
      duration: result.duration,
      status: result.status,
      errors: result.errors.map((e) => {
        if (e.message) return e.message;
        if (e instanceof Error) return e.toString();
        return 'Unknown error';
      }),
      logs: this.extractLogsFromStdout(result),
      performance: {
        startTime: result.startTime.getTime(),
        endTime: result.startTime.getTime() + result.duration,
        duration: result.duration,
      },
    };

    this.testLogs.push(testLog);
  }

  onEnd(result: FullResult) {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    // Generate summary
    const summary = this.generateSummary(result, totalDuration);

    // Write individual test logs
    this.writeTestLogs();

    // Write summary report
    this.writeSummary(summary);

    // Print summary to console
    this.printSummary(summary);
  }

  /**
   * Extract structured logs from test stdout
   */
  private extractLogsFromStdout(result: TestResult): LogEntry[] {
    const logs: LogEntry[] = [];

    for (const output of result.stdout) {
      const lines = output.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          // Try parsing as JSON (structured log)
          const logEntry = JSON.parse(line) as LogEntry;
          if (logEntry.timestamp && logEntry.level && logEntry.message) {
            logs.push(logEntry);
          }
        } catch {
          // Not JSON, might be human-readable log - skip or parse differently
          // Could implement regex parsing here for non-JSON logs
        }
      }
    }

    return logs;
  }

  /**
   * Generate test run summary
   */
  private generateSummary(result: FullResult, totalDuration: number) {
    const passed = this.testLogs.filter((t) => t.status === 'passed').length;
    const failed = this.testLogs.filter((t) => t.status === 'failed').length;
    const skipped = this.testLogs.filter((t) => t.status === 'skipped').length;
    const timedOut = this.testLogs.filter((t) => t.status === 'timedOut').length;

    const avgDuration =
      this.testLogs.length > 0
        ? this.testLogs.reduce((sum, t) => sum + t.duration, 0) / this.testLogs.length
        : 0;

    const slowestTests = [...this.testLogs].sort((a, b) => b.duration - a.duration).slice(0, 5);

    const testsWithErrors = this.testLogs.filter((t) => t.errors.length > 0);

    return {
      timestamp: new Date().toISOString(),
      status: result.status,
      totalTests: this.testLogs.length,
      passed,
      failed,
      skipped,
      timedOut,
      totalDuration,
      avgDuration: Math.round(avgDuration),
      slowestTests: slowestTests.map((t) => ({
        title: t.testTitle,
        duration: t.duration,
        file: t.file,
      })),
      testsWithErrors: testsWithErrors.map((t) => ({
        title: t.testTitle,
        errors: t.errors,
        file: t.file,
      })),
      logStats: {
        totalLogs: this.testLogs.reduce((sum, t) => sum + t.logs.length, 0),
        errorLogs: this.countLogsByLevel('ERROR'),
        warnLogs: this.countLogsByLevel('WARN'),
        infoLogs: this.countLogsByLevel('INFO'),
        debugLogs: this.countLogsByLevel('DEBUG'),
      },
    };
  }

  /**
   * Count logs by level across all tests
   */
  private countLogsByLevel(level: string): number {
    return this.testLogs.reduce((count, test) => {
      return count + test.logs.filter((log) => log.level === level).length;
    }, 0);
  }

  /**
   * Write individual test log files
   */
  private writeTestLogs() {
    for (const testLog of this.testLogs) {
      const fileName = this.sanitizeFileName(testLog.testTitle);
      const filePath = path.join(this.outputDir, `${fileName}.json`);
      this.ensureParentDir(filePath);

      fs.writeFileSync(filePath, JSON.stringify(testLog, null, 2));
    }
  }

  /**
   * Write summary report
   */
  private writeSummary(summary: unknown) {
    const filePath = path.join(this.outputDir, 'summary.json');
    this.ensureParentDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
  }

  private ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private ensureParentDir(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Print summary to console
   */
  private printSummary(summary: TestSummary) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 STRUCTURED LOGGING SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Passed:  ${summary.passed}/${summary.totalTests}`);
    console.log(`❌ Failed:  ${summary.failed}/${summary.totalTests}`);
    console.log(`⏭️  Skipped: ${summary.skipped}/${summary.totalTests}`);
    console.log(`⏱️  Timed Out: ${summary.timedOut}/${summary.totalTests}`);
    console.log(`\n⏱️  Total Duration: ${this.formatDuration(summary.totalDuration)}`);
    console.log(`📊 Avg Test Duration: ${this.formatDuration(summary.avgDuration)}`);

    if (summary.slowestTests.length > 0) {
      console.log(`\n🐌 Slowest Tests:`);
      summary.slowestTests.forEach((test: TestStats, i: number) => {
        console.log(`   ${i + 1}. ${test.title} (${this.formatDuration(test.duration)})`);
      });
    }

    console.log(`\n📝 Log Statistics:`);
    console.log(`   Total Logs: ${summary.logStats.totalLogs}`);
    console.log(`   ERROR: ${summary.logStats.errorLogs}`);
    console.log(`   WARN:  ${summary.logStats.warnLogs}`);
    console.log(`   INFO:  ${summary.logStats.infoLogs}`);
    console.log(`   DEBUG: ${summary.logStats.debugLogs}`);

    console.log(`\n📁 Detailed logs: ${path.resolve(this.outputDir)}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Sanitize test title for file name
   */
  private sanitizeFileName(title: string): string {
    return title
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .slice(0, 100);
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }

  printsToStdio(): boolean {
    return true;
  }
}
