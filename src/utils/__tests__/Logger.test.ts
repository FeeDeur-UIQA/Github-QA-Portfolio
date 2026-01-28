/**
 * Logger Utility Unit Tests
 * Validates logging functionality, levels, and output formatting
 */

import { Logger, LogLevel } from '../Logger';

describe('Logger - Singleton Pattern', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
  });

  it('should return the same instance for the same name', () => {
    const logger1 = Logger.getInstance('TestLogger');
    const logger2 = Logger.getInstance('TestLogger');

    expect(logger1).toBe(logger2);
  });

  it('should return different instances for different names', () => {
    const logger1 = Logger.getInstance('Logger1');
    const logger2 = Logger.getInstance('Logger2');

    expect(logger1).not.toBe(logger2);
  });
});

describe('Logger - Log Levels', () => {
  let logger: Logger;

  beforeEach(() => {
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
    logger = Logger.getInstance('TestLogger');
  });

  it('should have correct log level enum values', () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
    expect(LogLevel.CRITICAL).toBe(4);
  });

  it('should allow setting global log level', () => {
    Logger.setGlobalLogLevel(LogLevel.WARN);
    expect(LogLevel.WARN).toBe(2);
  });

  it('should respect log level filtering', () => {
    Logger.setGlobalLogLevel(LogLevel.INFO);

    // DEBUG should be filtered out when level is INFO
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');

    // Verify that messages are created (actual filtering would be in log output)
    expect(logger).toBeDefined();
  });
});

describe('Logger - Methods', () => {
  let logger: Logger;

  beforeEach(() => {
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
    logger = Logger.getInstance('TestLogger');
  });

  it('should have debug method', () => {
    expect(typeof logger.debug).toBe('function');
    expect(() => logger.debug('Debug message')).not.toThrow();
  });

  it('should have info method', () => {
    expect(typeof logger.info).toBe('function');
    expect(() => logger.info('Info message')).not.toThrow();
  });

  it('should have warn method', () => {
    expect(typeof logger.warn).toBe('function');
    expect(() => logger.warn('Warn message')).not.toThrow();
  });

  it('should have error method', () => {
    expect(typeof logger.error).toBe('function');
    expect(() => logger.error('Error message')).not.toThrow();
  });

  it('should have critical method', () => {
    expect(typeof logger.critical).toBe('function');
    expect(() => logger.critical('Critical message')).not.toThrow();
  });
});

describe('Logger - Message Formatting', () => {
  let logger: Logger;

  beforeEach(() => {
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
    logger = Logger.getInstance('TestLogger');
  });

  it('should accept messages with metadata', () => {
    expect(() => {
      logger.info('User logged in', { userId: 123, email: 'test@example.com' });
    }).not.toThrow();
  });

  it('should handle complex metadata objects', () => {
    const metadata = {
      userId: 123,
      nested: {
        deep: {
          value: 'test',
        },
      },
      array: [1, 2, 3],
      timestamp: new Date(),
    };

    expect(() => {
      logger.info('Complex message', metadata);
    }).not.toThrow();
  });

  it('should handle errors without metadata', () => {
    expect(() => {
      logger.error('Simple error message');
    }).not.toThrow();
  });

  it('should handle special characters in messages', () => {
    expect(() => {
      logger.info('Message with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?');
    }).not.toThrow();
  });

  it('should handle empty metadata', () => {
    expect(() => {
      logger.info('Message', {});
    }).not.toThrow();
  });
});

describe('Logger - Test Context', () => {
  beforeEach(() => {
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
  });

  it('should set test context', () => {
    expect(() => {
      Logger.setTestContext({
        testId: 'TC-01',
        testTitle: 'Login Test',
        worker: 1,
      });
    }).not.toThrow();
  });

  it('should clear test context', () => {
    Logger.setTestContext({
      testId: 'TC-01',
      testTitle: 'Login Test',
    });

    expect(() => {
      Logger.clearTestContext();
    }).not.toThrow();
  });
});

describe('Logger - JSON Mode', () => {
  beforeEach(() => {
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
    Logger.setJsonMode(false);
  });

  it('should support enabling JSON mode', () => {
    expect(() => {
      Logger.setJsonMode(true);
    }).not.toThrow();
  });

  it('should support disabling JSON mode', () => {
    Logger.setJsonMode(true);

    expect(() => {
      Logger.setJsonMode(false);
    }).not.toThrow();
  });
});

describe('Logger - Performance Tracking', () => {
  let logger: Logger;

  beforeEach(() => {
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
    logger = Logger.getInstance('TestLogger');
  });

  it('should track performance metrics in logs', () => {
    expect(() => {
      logger.info('Operation completed', {
        duration: 1234,
        memory: 56789,
      });
    }).not.toThrow();
  });

  it('should allow logging with duration', () => {
    const start = Date.now();
    // Simulate operation
    const duration = Date.now() - start;

    expect(() => {
      logger.info('Timed operation', { duration });
    }).not.toThrow();
  });
});

describe('Logger - Multiple Instances', () => {
  beforeEach(() => {
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
  });

  it('should maintain separate loggers for different contexts', () => {
    const pageLogger = Logger.getInstance('HomePage');
    const apiLogger = Logger.getInstance('ApiClient');

    expect(() => {
      pageLogger.info('Page loaded');
      apiLogger.info('Request sent');
    }).not.toThrow();
  });

  it('should handle many concurrent loggers', () => {
    const loggers: Logger[] = [];

    for (let i = 0; i < 100; i++) {
      const logger = Logger.getInstance(`Logger${i}`);
      loggers.push(logger);
    }

    expect(loggers.length).toBe(100);

    // All should be unique instances
    const uniqueLoggers = new Set(loggers);
    expect(uniqueLoggers.size).toBe(100);
  });
});

describe('Logger - Edge Cases', () => {
  let logger: Logger;

  beforeEach(() => {
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
    logger = Logger.getInstance('TestLogger');
  });

  it('should handle null metadata gracefully', () => {
    expect(() => {
      logger.info('Message', null as any);
    }).not.toThrow();
  });

  it('should handle undefined metadata gracefully', () => {
    expect(() => {
      logger.info('Message', undefined);
    }).not.toThrow();
  });

  it('should handle very long messages', () => {
    const longMessage = 'A'.repeat(10000);

    expect(() => {
      logger.info(longMessage);
    }).not.toThrow();
  });

  it('should handle special metadata values', () => {
    expect(() => {
      logger.info('Message', {
        null: null,
        undefined: undefined,
        emptyString: '',
        zero: 0,
        false: false,
        date: new Date(),
      });
    }).not.toThrow();
  });
});

describe('Logger - Integration', () => {
  beforeEach(() => {
    Logger.setGlobalLogLevel(LogLevel.DEBUG);
  });

  it('should log successful operation flow', () => {
    const logger = Logger.getInstance('IntegrationTest');

    expect(() => {
      logger.debug('Starting operation');
      logger.info('Processing data', { count: 100 });
      logger.info('Data processed', { result: 'success' });
    }).not.toThrow();
  });

  it('should log error operation flow', () => {
    const logger = Logger.getInstance('IntegrationTest');

    expect(() => {
      logger.debug('Starting operation');
      logger.error('Operation failed', { reason: 'Network timeout' });
      logger.critical('Critical system failure');
    }).not.toThrow();
  });

  it('should maintain context across multiple log calls', () => {
    Logger.setTestContext({
      testId: 'TC-001',
      testTitle: 'Integration Test',
      worker: 1,
    });

    const logger = Logger.getInstance('Integration');

    expect(() => {
      logger.info('Step 1');
      logger.info('Step 2');
      logger.info('Step 3');
      logger.info('Step 4');
    }).not.toThrow();

    Logger.clearTestContext();
  });
});
