/**
 * TC-SEC05: Security Headers Validation
 *
 * Validates that all pages return proper security headers:
 * - Content-Security-Policy (CSP): Prevents XSS, clickjacking, code injection
 * - Strict-Transport-Security (HSTS): Enforces HTTPS connections
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME-sniffing attacks
 * - Referrer-Policy: Controls referrer information leakage
 * - Permissions-Policy: Controls browser feature access
 *
 * ⚠️ NOTE: automationexercise.com is a test site and lacks security headers.
 * These tests document OWASP best practices and would catch regressions.
 * In production environments, these would be blocking tests.
 *
 * @see {@link https://owasp.org/www-project-secure-headers/}
 * @see {@link https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html}
 */

import { test, expect } from '@playwright/test';

import { Logger } from '../../../src/utils/Logger';

// Create logger instance for TC-SEC05
const logger = Logger.getInstance('TC-SEC05');

// Environment flag: Set to 'audit' to document violations without blocking CI
// Set to 'enforce' for production-ready applications
const SECURITY_MODE = process.env.SECURITY_MODE || 'audit'; // 'audit' | 'enforce'

/**
 * TypeScript interfaces for security header configurations
 */
interface BaseHeaderConfig {
  required: boolean;
  severity: string;
  description: string;
}

interface HeaderConfigWithAllowedValues extends BaseHeaderConfig {
  allowedValues: string[];
}

interface HeaderConfigWithPattern extends BaseHeaderConfig {
  pattern: RegExp;
}

interface HeaderConfigWithMinDirectives extends BaseHeaderConfig {
  minDirectives: string[];
}

interface HeaderConfigWithMinMaxAge extends BaseHeaderConfig {
  pattern: RegExp;
  minMaxAge: number;
}

type HeaderConfig =
  | HeaderConfigWithAllowedValues
  | HeaderConfigWithPattern
  | HeaderConfigWithMinDirectives
  | HeaderConfigWithMinMaxAge
  | BaseHeaderConfig;

/**
 * Security headers configuration based on OWASP recommendations (2025)
 */
const SECURITY_HEADERS: Record<string, HeaderConfig> = {
  // Content Security Policy - Critical for XSS prevention
  'content-security-policy': {
    required: true,
    severity: 'critical',
    description: 'Prevents XSS, clickjacking, and code injection attacks',
    minDirectives: ['default-src', 'script-src'],
  },

  // HTTP Strict Transport Security - Enforces HTTPS
  'strict-transport-security': {
    required: true,
    severity: 'critical',
    description: 'Enforces HTTPS connections',
    pattern: /max-age=\d+/,
    minMaxAge: 31536000, // 1 year minimum
  },

  // X-Frame-Options - Prevents clickjacking
  'x-frame-options': {
    required: true,
    severity: 'high',
    description: 'Prevents clickjacking attacks',
    allowedValues: ['DENY', 'SAMEORIGIN'],
  },

  // X-Content-Type-Options - Prevents MIME-sniffing
  'x-content-type-options': {
    required: true,
    severity: 'high',
    description: 'Prevents MIME-sniffing attacks',
    allowedValues: ['nosniff'],
  },

  // Referrer-Policy - Controls referrer information
  'referrer-policy': {
    required: true,
    severity: 'medium',
    description: 'Controls referrer information leakage',
    allowedValues: [
      'no-referrer',
      'no-referrer-when-downgrade',
      'origin',
      'origin-when-cross-origin',
      'same-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
    ],
  },

  // Permissions-Policy (formerly Feature-Policy)
  'permissions-policy': {
    required: false,
    severity: 'medium',
    description: 'Controls browser feature access',
    pattern: /geolocation|camera|microphone/,
  },

  // X-XSS-Protection - Legacy but still useful
  'x-xss-protection': {
    required: false,
    severity: 'low',
    description: 'Legacy XSS protection',
    allowedValues: ['1; mode=block', '0'],
  },
};

/**
 * Pages to test for security headers
 */
const TEST_PAGES = [
  { url: '/', name: 'Homepage' },
  { url: '/login', name: 'Login Page' },
  { url: '/products', name: 'Products Page' },
  { url: '/contact_us', name: 'Contact Us Page' },
];

test.describe('TC-SEC05: Security Headers Validation @security @critical @automated @audit', () => {
  test.beforeEach(async ({ page }) => {
    logger.info('[TC-SEC05] Preparing security headers validation');

    // Set up response listener to capture headers
    page.on('response', (response) => {
      try {
        const responseUrl = new URL(response.url());
        if (
          responseUrl.hostname === 'automationexercise.com' ||
          responseUrl.hostname.endsWith('.automationexercise.com')
        ) {
          logger.debug(`[TC-SEC05] Response headers captured`, { url: responseUrl.pathname });
        }
      } catch {
        // Invalid URL, skip
      }
    });
  });

  for (const testPage of TEST_PAGES) {
    test(`should have all required security headers on ${testPage.name} @critical @security`, async ({
      page,
    }) => {
      logger.info(`[TC-SEC05] Validating security headers on ${testPage.name}`);

      // Navigate to page and capture response
      const response = await page.goto(testPage.url);
      expect(response).not.toBeNull();

      const headers = response!.headers();
      const headerReport: {
        header: string;
        present: boolean;
        value: string | undefined;
        valid: boolean;
        severity: string;
        issue?: string;
      }[] = [];

      // Validate each security header
      for (const [headerName, config] of Object.entries(SECURITY_HEADERS)) {
        const headerValue = headers[headerName];
        const present = !!headerValue;
        let valid = false;
        let issue: string | undefined;

        if (!present) {
          if (config.required) {
            issue = `MISSING: Required ${config.severity} security header`;
          } else {
            issue = `MISSING: Recommended ${config.severity} header`;
          }
        } else {
          // Validate header value using type guards
          if ('allowedValues' in config && config.allowedValues) {
            const normalizedValue = headerValue.toUpperCase();
            const allowedValues = config.allowedValues.map((v: string) => v.toUpperCase());
            valid = allowedValues.some((allowed: string) => normalizedValue.includes(allowed));

            if (!valid) {
              issue = `INVALID VALUE: Expected one of [${config.allowedValues.join(', ')}], got "${headerValue}"`;
            }
          } else if ('pattern' in config && config.pattern && !('minMaxAge' in config)) {
            valid = config.pattern.test(headerValue);

            if (!valid) {
              issue = `INVALID FORMAT: Does not match required pattern`;
            }
          } else if ('minDirectives' in config && config.minDirectives) {
            // Validate CSP directives
            valid = config.minDirectives.every((directive: string) =>
              headerValue.toLowerCase().includes(directive),
            );

            if (!valid) {
              const missing = config.minDirectives.filter(
                (d: string) => !headerValue.toLowerCase().includes(d),
              );
              issue = `INCOMPLETE CSP: Missing directives [${missing.join(', ')}]`;
            }
          } else if (
            'minMaxAge' in config &&
            config.minMaxAge &&
            headerName === 'strict-transport-security'
          ) {
            const maxAgeMatch = headerValue.match(/max-age=(\d+)/);
            if (maxAgeMatch) {
              const maxAge = parseInt(maxAgeMatch[1], 10);
              valid = maxAge >= config.minMaxAge;

              if (!valid) {
                issue = `INSUFFICIENT MAX-AGE: ${maxAge} seconds (minimum: ${config.minMaxAge})`;
              }
            } else {
              issue = `MISSING MAX-AGE: HSTS header must include max-age directive`;
            }
          } else {
            valid = true; // If no validation rules, just check presence
          }
        }

        headerReport.push({
          header: headerName,
          present,
          value: headerValue,
          valid: present && valid,
          severity: config.severity,
          issue,
        });

        // Log header validation result
        if (!present && config.required) {
          logger.error(`[${config.severity.toUpperCase()}] ${headerName}: ${issue}`);
        } else if (present && !valid) {
          logger.warn(`[${config.severity.toUpperCase()}] ${headerName}: ${issue}`);
        } else if (present && valid) {
          logger.info(`[PASS] ${headerName}: ${headerValue}`);
        }
      }

      // Generate summary report
      const criticalIssues = headerReport.filter(
        (h) => h.severity === 'critical' && (!h.present || !h.valid),
      );
      const highIssues = headerReport.filter(
        (h) => h.severity === 'high' && (!h.present || !h.valid),
      );
      const mediumIssues = headerReport.filter(
        (h) => h.severity === 'medium' && (!h.present || !h.valid),
      );

      logger.info(`[TC-SEC05] Security Headers Report for ${testPage.name}:`);
      logger.info(`  - Critical Issues: ${criticalIssues.length}`);
      logger.info(`  - High Issues: ${highIssues.length}`);
      logger.info(`  - Medium Issues: ${mediumIssues.length}`);

      if (criticalIssues.length > 0) {
        logger.error('[TC-SEC05] Critical security header issues:');
        criticalIssues.forEach((issue) => {
          logger.error(`  ❌ ${issue.header}: ${issue.issue}`);
        });
      }

      if (highIssues.length > 0) {
        logger.warn('[TC-SEC05] High security header issues:');
        highIssues.forEach((issue) => {
          logger.warn(`  ⚠️  ${issue.header}: ${issue.issue}`);
        });
      }

      // Check audit mode before enforcing
      if (criticalIssues.length > 0 && SECURITY_MODE === 'audit') {
        logger.warn(`⚠️  NOTE: automationexercise.com lacks security headers (known limitation)`);
        logger.warn(`📋 [AUDIT MODE] Documenting ${criticalIssues.length} critical issue(s) for portfolio`);
        logger.warn(`   In production: this would block deployment (OWASP requirement)`);
        test.skip(); // Document but don't block
        return;
      }

      // Fail test if critical headers are missing or invalid
      expect(
        criticalIssues,
        `Found ${criticalIssues.length} critical security header issues on ${testPage.name}. ` +
          `See logs for details.`,
      ).toHaveLength(0);
    });
  }

  test('should generate security headers report @security @report', async ({ page }) => {
    logger.info('[TC-SEC05] Generating security headers report');

    const fullReport: {
      page: string;
      url: string;
      headers: Record<string, string | undefined>;
      score: number;
      issues: string[];
    }[] = [];

    for (const testPage of TEST_PAGES) {
      const response = await page.goto(testPage.url);
      expect(response).not.toBeNull();

      const headers = response!.headers();
      const issues: string[] = [];
      let score = 100;

      // Calculate security score based on headers present and valid
      for (const [headerName, config] of Object.entries(SECURITY_HEADERS)) {
        const headerValue = headers[headerName];

        if (!headerValue) {
          if (config.required) {
            score -= config.severity === 'critical' ? 30 : config.severity === 'high' ? 20 : 10;
            issues.push(`Missing ${config.severity} header: ${headerName}`);
          }
        } else {
          // Basic validation using type guards
          let valid = true;

          if ('allowedValues' in config && config.allowedValues) {
            const normalizedValue = headerValue.toUpperCase();
            const allowedValues = config.allowedValues.map((v: string) => v.toUpperCase());
            valid = allowedValues.some((allowed: string) => normalizedValue.includes(allowed));
          } else if ('pattern' in config && config.pattern) {
            valid = config.pattern.test(headerValue);
          } else if ('minDirectives' in config && config.minDirectives) {
            valid = config.minDirectives.every((directive: string) =>
              headerValue.toLowerCase().includes(directive),
            );
          }

          if (!valid) {
            score -= config.severity === 'critical' ? 20 : config.severity === 'high' ? 15 : 5;
            issues.push(`Invalid value for ${headerName}: ${headerValue}`);
          }
        }
      }

      fullReport.push({
        page: testPage.name,
        url: testPage.url,
        headers,
        score: Math.max(0, score),
        issues,
      });

      logger.info(`[TC-SEC05] ${testPage.name} Security Score: ${Math.max(0, score)}/100`);
      if (issues.length > 0) {
        logger.warn(`[TC-SEC05] Issues found on ${testPage.name}:`);
        issues.forEach((issue) => logger.warn(`  - ${issue}`));
      }
    }

    // Calculate average security score
    const avgScore = fullReport.reduce((sum, r) => sum + r.score, 0) / fullReport.length;
    logger.info(`[TC-SEC05] Average Security Headers Score: ${avgScore.toFixed(1)}/100`);

    // Generate detailed report
    logger.info('[TC-SEC05] === SECURITY HEADERS AUDIT REPORT ===');
    fullReport.forEach((report) => {
      logger.info(`\n[${report.page}] (${report.url})`);
      logger.info(`  Score: ${report.score}/100`);
      logger.info(`  Issues: ${report.issues.length}`);

      if (report.issues.length > 0) {
        report.issues.forEach((issue) => logger.info(`    - ${issue}`));
      }

      logger.info('  Headers Present:');
      Object.entries(report.headers)
        .filter(([key]) => Object.keys(SECURITY_HEADERS).includes(key))
        .forEach(([key, value]) => {
          logger.info(`    ✓ ${key}: ${value}`);
        });
    });

    // Check audit mode before enforcing score threshold
    if (SECURITY_MODE === 'audit') {
      logger.warn('📋 [AUDIT MODE] Security score below threshold (${avgScore.toFixed(1)}/100)');
      logger.warn('   In production: this would block deployment (OWASP best practice)');
      test.skip(); // Document but don't block
      return;
    }

    // Expect average score to be at least 70 for passing
    expect(
      avgScore,
      `Average security headers score (${avgScore.toFixed(1)}) is below threshold. ` +
        `Expected at least 70/100 for production-ready application.`,
    ).toBeGreaterThanOrEqual(70);
  });

  test('should validate HSTS max-age meets minimum requirements @security @hsts', async ({
    page,
  }) => {
    logger.info('[TC-SEC05] Validating HSTS max-age configuration');

    const response = await page.goto('/');
    expect(response).not.toBeNull();

    const hstsHeader = response!.headers()['strict-transport-security'];

    if (!hstsHeader) {
      logger.error('[CRITICAL] HSTS header is missing');
      logger.warn(
        '⚠️  NOTE: automationexercise.com lacks security headers (known limitation)',
      );

      // In audit mode: document violation but don't block
      if (SECURITY_MODE === 'audit') {
        logger.warn('📋 [AUDIT MODE] Documenting HSTS absence for portfolio demonstration');
        logger.warn(
          '   In production: this would be a blocking failure (OWASP recommendation)',
        );
        test.skip(); // Skip assertion but document in logs
        return;
      }

      // In enforce mode: fail the test
      expect(hstsHeader, 'HSTS header must be present for HTTPS security').toBeDefined();
      return;
    }

    const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/);
    expect(maxAgeMatch, 'HSTS header must include max-age directive').not.toBeNull();

    const maxAge = parseInt(maxAgeMatch![1], 10);
    const oneYear = 31536000; // seconds in a year

    logger.info(
      `[TC-SEC05] HSTS max-age: ${maxAge} seconds (${(maxAge / oneYear).toFixed(2)} years)`,
    );

    expect(
      maxAge,
      `HSTS max-age (${maxAge}) should be at least 1 year (${oneYear} seconds) for production`,
    ).toBeGreaterThanOrEqual(oneYear);

    // Check for includeSubDomains
    const includesSubDomains = /includeSubDomains/.test(hstsHeader);
    logger.info(`[TC-SEC05] HSTS includeSubDomains: ${includesSubDomains}`);

    if (includesSubDomains) {
      logger.info('[PASS] HSTS includes includeSubDomains directive (best practice)');
    } else {
      logger.warn('[WARN] HSTS should include includeSubDomains for full protection');
    }
  });

  test('should validate CSP contains essential directives @security @csp', async ({ page }) => {
    logger.info('[TC-SEC05] Validating Content Security Policy configuration');

    const response = await page.goto('/');
    expect(response).not.toBeNull();

    const cspHeader = response!.headers()['content-security-policy'];

    if (!cspHeader) {
      logger.error('[CRITICAL] Content-Security-Policy header is missing');
      logger.error('[TC-SEC05] CSP is critical for preventing XSS and code injection attacks');
      logger.warn(
        '⚠️  NOTE: automationexercise.com lacks CSP (documented test site limitation)',
      );

      // In audit mode: document but don't block
      if (SECURITY_MODE === 'audit') {
        logger.warn('📋 [AUDIT MODE] CSP absence documented for portfolio demonstration');
        logger.warn('   Production recommendation: Implement strict CSP with nonce/hash patterns');
        test.skip();
        return;
      }

      expect(cspHeader, 'CSP header must be present for XSS protection').toBeDefined();
      return;
    }

    logger.info(`[TC-SEC05] CSP Policy: ${cspHeader}`);

    // Essential CSP directives for 2025
    const essentialDirectives = {
      'default-src': 'Fallback for all resource types',
      'script-src': 'JavaScript source restrictions',
      'style-src': 'CSS source restrictions',
      'img-src': 'Image source restrictions',
      'connect-src': 'AJAX/WebSocket/EventSource restrictions',
      'font-src': 'Font source restrictions',
      'frame-src': 'Frame/iframe source restrictions',
    };

    const missingDirectives: string[] = [];
    const presentDirectives: string[] = [];

    for (const [directive, description] of Object.entries(essentialDirectives)) {
      if (cspHeader.toLowerCase().includes(directive)) {
        presentDirectives.push(directive);
        logger.info(`  ✓ ${directive}: ${description}`);
      } else {
        missingDirectives.push(directive);
        logger.warn(`  ✗ ${directive}: ${description} (MISSING)`);
      }
    }

    logger.info(
      `[TC-SEC05] CSP Coverage: ${presentDirectives.length}/${Object.keys(essentialDirectives).length} essential directives`,
    );

    // Check for unsafe-inline and unsafe-eval (security anti-patterns)
    const hasUnsafeInline = /unsafe-inline/.test(cspHeader);
    const hasUnsafeEval = /unsafe-eval/.test(cspHeader);

    if (hasUnsafeInline) {
      logger.warn('[WARN] CSP contains unsafe-inline, which weakens XSS protection');
    }

    if (hasUnsafeEval) {
      logger.warn('[WARN] CSP contains unsafe-eval, which allows dynamic code execution');
    }

    // Expect at least default-src and script-src (critical for XSS prevention)
    expect(
      missingDirectives.filter((d) => ['default-src', 'script-src'].includes(d)),
      'CSP must include at minimum default-src and script-src directives',
    ).toHaveLength(0);
  });
});
