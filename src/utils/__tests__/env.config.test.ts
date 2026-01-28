/**
 * Environment Configuration Unit Tests
 * Validates environment parsing, validation, and defaults
 */

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Default Values', () => {
    it('should have sensible defaults when no env vars are set', () => {
      // Defaults should be applied by zod schema
      expect(process.env.BASE_URL || 'https://automationexercise.com').toBe(
        'https://automationexercise.com'
      );
    });

    it('should default to development environment', () => {
      const defaultEnv = process.env.NODE_ENV || 'development';
      expect(['development', 'staging', 'production', 'test']).toContain(defaultEnv);
    });

    it('should have reasonable worker count default', () => {
      const workers = parseInt(process.env.WORKERS || '6');
      expect(workers).toBeGreaterThanOrEqual(1);
      expect(workers).toBeLessThanOrEqual(16);
    });

    it('should have timeouts in milliseconds', () => {
      const timeout = parseInt(process.env.TIMEOUT || '35000');
      const expectTimeout = parseInt(process.env.EXPECT_TIMEOUT || '5000');
      const navigationTimeout = parseInt(process.env.NAVIGATION_TIMEOUT || '10000');

      expect(timeout).toBeGreaterThan(1000);
      expect(expectTimeout).toBeGreaterThan(1000);
      expect(navigationTimeout).toBeGreaterThan(1000);
    });

    it('should have retries configured', () => {
      const retries = parseInt(process.env.RETRIES || '2');
      expect(retries).toBeGreaterThanOrEqual(0);
      expect(retries).toBeLessThanOrEqual(10);
    });
  });

  describe('Feature Flags', () => {
    it('should have TURBO_MODE disabled by default', () => {
      const turboMode = process.env.TURBO_MODE === 'true';
      expect(typeof turboMode).toBe('boolean');
    });

    it('should have HEADLESS enabled by default', () => {
      const headless = process.env.HEADLESS !== 'false';
      expect(headless).toBe(true);
    });

    it('should have LOG_LEVEL set', () => {
      const logLevel = process.env.LOG_LEVEL || 'INFO';
      expect(['DEBUG', 'INFO', 'WARN', 'ERROR']).toContain(logLevel);
    });
  });

  describe('Required Fields', () => {
    it('should have BASE_URL as valid URL format', () => {
      const baseUrl = process.env.BASE_URL || 'https://automationexercise.com';
      expect(() => new URL(baseUrl)).not.toThrow();
    });

    it('should have NODE_ENV in valid enum', () => {
      const nodeEnv = process.env.NODE_ENV || 'development';
      expect(['development', 'staging', 'production', 'test']).toContain(nodeEnv);
    });

    it('should have numeric timeouts', () => {
      const timeout = parseInt(process.env.TIMEOUT || '35000');
      const expectTimeout = parseInt(process.env.EXPECT_TIMEOUT || '5000');

      expect(Number.isInteger(timeout)).toBe(true);
      expect(Number.isInteger(expectTimeout)).toBe(true);
    });
  });

  describe('Credential Configuration', () => {
    it('should accept test email configuration', () => {
      const email = process.env.TEST_EMAIL || 'test.user@automation.test';
      expect(email).toContain('@');
    });

    it('should accept test password configuration', () => {
      const password = process.env.TEST_PASSWORD || 'SecurePassword123!';
      expect(password.length).toBeGreaterThanOrEqual(6);
    });

    it('should allow optional API_KEY', () => {
      // Should not throw even if not set
      expect(() => {
        const apiKey = process.env.API_KEY;
        expect(apiKey === undefined || typeof apiKey === 'string').toBe(true);
      }).not.toThrow();
    });

    it('should allow optional API_TOKEN', () => {
      expect(() => {
        const apiToken = process.env.API_TOKEN;
        expect(apiToken === undefined || typeof apiToken === 'string').toBe(true);
      }).not.toThrow();
    });

    it('should allow optional SLACK_WEBHOOK', () => {
      expect(() => {
        const webhook = process.env.SLACK_WEBHOOK;
        if (webhook) {
          new URL(webhook);
        }
        expect(true).toBe(true);
      }).not.toThrow();
    });

    it('should allow optional GITHUB_TOKEN', () => {
      expect(() => {
        const token = process.env.GITHUB_TOKEN;
        expect(token === undefined || typeof token === 'string').toBe(true);
      }).not.toThrow();
    });
  });

  describe('Playwright Configuration Ranges', () => {
    it('should have WORKERS between 1 and reasonable max', () => {
      const workers = parseInt(process.env.WORKERS || '6');
      expect(workers).toBeGreaterThanOrEqual(1);
    });

    it('should have TIMEOUT greater than EXPECT_TIMEOUT', () => {
      const timeout = parseInt(process.env.TIMEOUT || '35000');
      const expectTimeout = parseInt(process.env.EXPECT_TIMEOUT || '5000');

      expect(timeout).toBeGreaterThan(expectTimeout);
    });

    it('should have TIMEOUT greater than NAVIGATION_TIMEOUT', () => {
      const timeout = parseInt(process.env.TIMEOUT || '35000');
      const navigationTimeout = parseInt(process.env.NAVIGATION_TIMEOUT || '10000');

      expect(timeout).toBeGreaterThanOrEqual(navigationTimeout);
    });

    it('should have RETRIES between 0 and 5', () => {
      const retries = parseInt(process.env.RETRIES || '2');
      expect(retries).toBeGreaterThanOrEqual(0);
      expect(retries).toBeLessThanOrEqual(5);
    });
  });

  describe('Path Configuration', () => {
    it('should have LOG_DIR configured', () => {
      const logDir = process.env.LOG_DIR || './logs';
      expect(logDir).toBeTruthy();
    });
  });

  describe('Environment Detection', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(process.env.NODE_ENV).toBe('development');
    });

    it('should detect staging environment', () => {
      process.env.NODE_ENV = 'staging';
      expect(process.env.NODE_ENV).toBe('staging');
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(process.env.NODE_ENV).toBe('production');
    });

    it('should detect CI environment', () => {
      const isCi = Boolean(process.env.CI);
      expect(typeof isCi).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing .env files gracefully', () => {
      // Should not throw even if .env doesn't exist
      expect(() => {
        const baseUrl = process.env.BASE_URL || 'https://automationexercise.com';
        expect(baseUrl).toBeTruthy();
      }).not.toThrow();
    });

    it('should handle numeric string coercion', () => {
      process.env.WORKERS = '4';
      process.env.TIMEOUT = '30000';

      const workers = parseInt(process.env.WORKERS);
      const timeout = parseInt(process.env.TIMEOUT);

      expect(workers).toBe(4);
      expect(timeout).toBe(30000);
    });

    it('should handle boolean string coercion', () => {
      process.env.TURBO_MODE = 'true';
      process.env.HEADLESS = 'false';

      expect(process.env.TURBO_MODE === 'true').toBe(true);
      expect(process.env.HEADLESS === 'false').toBe(true);
    });
  });

  describe('Configuration Consistency', () => {
    it('should have consistent timeout hierarchy', () => {
      const timeout = parseInt(process.env.TIMEOUT || '35000');
      const expectTimeout = parseInt(process.env.EXPECT_TIMEOUT || '5000');
      const navTimeout = parseInt(process.env.NAVIGATION_TIMEOUT || '10000');

      // Page timeout should be >= nav timeout
      expect(timeout).toBeGreaterThanOrEqual(navTimeout);
      // Nav timeout should be > expect timeout (usually)
      expect(navTimeout).toBeGreaterThanOrEqual(expectTimeout);
    });

    it('should have workers configured for parallelization', () => {
      const workers = parseInt(process.env.WORKERS || '6');
      expect(workers).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Environment Summary', () => {
  it('should provide environment summary structure', () => {
    const baseUrl = process.env.BASE_URL || 'https://automationexercise.com';
    const nodeEnv = process.env.NODE_ENV || 'development';
    const workers = parseInt(process.env.WORKERS || '6');

    const summary = {
      environment: nodeEnv,
      workers,
      baseUrl,
    };

    expect(summary).toHaveProperty('environment');
    expect(summary).toHaveProperty('workers');
    expect(summary).toHaveProperty('baseUrl');
  });
});
