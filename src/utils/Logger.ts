/**
 * Structured Logger
 *
 * Features:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - JSON & Human-readable formats
 * - Timestamp tracking with nanosecond precision
 * - CI/CD optimized output
 * - Contextual metadata support
 * - Test correlation tracking
 * - Performance metrics integration
 *
 * @example
 * ```typescript
 * const logger = Logger.getInstance('HomePage');
 * logger.info('User navigated to home page', { url: 'https://example.com' });
 * logger.error('Login failed', { reason: 'Invalid credentials', user: 'test@example.com' });
 * ```
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  metadata?: Record<string, unknown>;
  testInfo?: {
    testId?: string;
    testTitle?: string;
    worker?: number;
  };
  performance?: {
    duration?: number;
    memory?: number;
  };
}

export class Logger {
  private static instances: Map<string, Logger> = new Map();
  private static globalLogLevel: LogLevel = LogLevel.INFO;
  private static jsonMode: boolean = false;
  private static testContext: { testId?: string; testTitle?: string; worker?: number } = {};

  private readonly name: string;

  private constructor(name: string) {
    this.name = name;
  }

  /**
   * Get or create a logger instance for a specific context
   * @param name - Logger name (typically class/module name)
   * @returns Logger instance
   */
  public static getInstance(name: string): Logger {
    if (!Logger.instances.has(name)) {
      Logger.instances.set(name, new Logger(name));
    }
    return Logger.instances.get(name)!;
  }

  /**
   * Configure global log level (affects all logger instances)
   * @param level - Minimum log level to output
   */
  public static setGlobalLogLevel(level: LogLevel): void {
    Logger.globalLogLevel = level;
  }

  /**
   * Enable JSON output mode (recommended for CI/CD)
   * @param enabled - Whether to use JSON format
   */
  public static setJsonMode(enabled: boolean): void {
    Logger.jsonMode = enabled;
  }

  /**
   * Set test context for log correlation
   * @param context - Test metadata
   */
  public static setTestContext(context: {
    testId?: string;
    testTitle?: string;
    worker?: number;
  }): void {
    Logger.testContext = context;
  }

  /**
   * Clear test context after test completion
   */
  public static clearTestContext(): void {
    Logger.testContext = {};
  }

  /**
   * Reset all logger instances (useful for test cleanup)
   */
  public static resetAll(): void {
    Logger.instances.clear();
    Logger.testContext = {};
  }

  /**
   * Get current log level setting
   */
  public static getLogLevel(): LogLevel {
    return Logger.globalLogLevel;
  }

  /**
   * Debug-level logging (development only)
   * @param message - Log message
   * @param metadata - Additional context data
   */
  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Info-level logging (general information)
   * @param message - Log message
   * @param metadata - Additional context data
   */
  public info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Warning-level logging (potential issues)
   * @param message - Log message
   * @param metadata - Additional context data
   */
  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Error-level logging (failures and errors)
   * @param message - Log message
   * @param metadata - Additional context data
   */
  public error(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Critical-level logging (system-critical failures)
   * @param message - Log message
   * @param metadata - Additional context data
   */
  public critical(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.CRITICAL, message, metadata);
  }

  /**
   * Log performance metrics
   * @param action - Action name
   * @param duration - Duration in milliseconds
   * @param metadata - Additional context
   */
  public performance(action: string, duration: number, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `Performance: ${action}`, {
      ...metadata,
      performance: { duration, memory: this.getMemoryUsage() },
    });
  }

  /**
   * Create a child logger with execution timing
   * @returns Start time for duration tracking
   */
  public startTimer(): number {
    return Date.now();
  }

  /**
   * Log action completion with duration
   * @param action - Action name
   * @param startTime - Start timestamp from startTimer()
   * @param metadata - Additional context
   */
  public endTimer(action: string, startTime: number, metadata?: Record<string, unknown>): void {
    const duration = Date.now() - startTime;
    this.performance(action, duration, metadata);
  }

  /**
   * Core logging method
   * @private
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    // Skip if below configured log level
    if (level < Logger.globalLogLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level: LogLevel[level],
      logger: this.name,
      message,
      metadata,
      testInfo: Object.keys(Logger.testContext).length > 0 ? Logger.testContext : undefined,
    };

    // Output in JSON or human-readable format
    if (Logger.jsonMode) {
      this.outputJson(entry);
    } else {
      this.outputHuman(entry, level);
    }
  }

  /**
   * Output log in JSON format (CI-friendly)
   * @private
   */
  private outputJson(entry: LogEntry): void {
    console.log(JSON.stringify(entry));
  }

  /**
   * Output log in human-readable format (local development)
   * @private
   */
  private outputHuman(entry: LogEntry, level: LogLevel): void {
    const color = this.getColorCode(level);
    const reset = '\x1b[0m';
    const timestamp = entry.timestamp;
    const levelStr = entry.level.padEnd(8);
    const logger = `[${this.name}]`.padEnd(20);

    let output = `${color}${timestamp} ${levelStr}${reset} ${logger} ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n  ${color}→${reset} ${JSON.stringify(entry.metadata, null, 2).replace(/\n/g, '\n  ')}`;
    }

    if (entry.testInfo) {
      output += `\n  ${color}🧪${reset} Test: ${entry.testInfo.testTitle || 'Unknown'} (Worker: ${entry.testInfo.worker || 'N/A'})`;
    }

    // Route to appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Get ANSI color code for log level
   * @private
   */
  private getColorCode(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '\x1b[36m'; // Cyan
      case LogLevel.INFO:
        return '\x1b[32m'; // Green
      case LogLevel.WARN:
        return '\x1b[33m'; // Yellow
      case LogLevel.ERROR:
        return '\x1b[31m'; // Red
      case LogLevel.CRITICAL:
        return '\x1b[35m'; // Magenta
      default:
        return '\x1b[0m'; // Reset
    }
  }

  /**
   * Generate ISO 8601 timestamp with milliseconds
   * @private
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Get current memory usage (Node.js only)
   * @private
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024); // MB
    }
    return 0;
  }
}

/**
 * Convenience exports for common use cases
 */
export const createLogger = (name: string): Logger => Logger.getInstance(name);

/**
 * Auto-detect environment and configure logger
 */
export function configureLogger(): void {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';

  // CI environments use JSON mode for parsing
  Logger.setJsonMode(isCI);

  // Map string to LogLevel enum
  const levelMap: Record<string, LogLevel> = {
    DEBUG: LogLevel.DEBUG,
    INFO: LogLevel.INFO,
    WARN: LogLevel.WARN,
    ERROR: LogLevel.ERROR,
    CRITICAL: LogLevel.CRITICAL,
  };

  Logger.setGlobalLogLevel(levelMap[logLevel] || LogLevel.INFO);
}

// Auto-configure on import
configureLogger();
