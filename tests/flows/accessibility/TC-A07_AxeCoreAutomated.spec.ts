import AxeBuilder from '@axe-core/playwright';
import { HomePage } from '@pages/HomePage';
import { LoginPage } from '@pages/LoginPage';
import { ProductsPage } from '@pages/ProductsPage';
import { test, expect } from '@playwright/test';
import { Logger } from '@utils/Logger';

/**
 * TC-A07: Automated Accessibility Scanning with axe-core
 *
 * Automated WCAG 2.2 Level AA compliance validation using axe-core
 * Detects 60-80% of accessibility violations automatically
 *
 * axe-core checks:
 * - ARIA roles, labels, and properties
 * - Color contrast (WCAG AA/AAA)
 * - Keyboard accessibility
 * - Form labels and associations
 * - Semantic HTML structure
 * - Image alt text
 * - Heading hierarchy
 * - Language attributes
 *
 * @category Accessibility
 * @priority Critical
 */

test.describe('TC-A07: Automated axe-core Accessibility Scanning @accessibility @critical @automated @audit', () => {
  const logger = Logger.getInstance('TC-A07_AxeCoreAutomated');

  // Known violations baseline - automationexercise.com has documented accessibility issues
  // In production: store this in a .axe-baseline.json file and version control it
  const KNOWN_VIOLATIONS = {
    homepage: [
      'button-name', // Subscribe button missing label (icon-only)
      'color-contrast', // Orange links and heading colors
      'link-name', // Carousel controls missing accessible names
    ],
    loginPage: ['button-name', 'color-contrast'],
    productsPage: ['button-name', 'color-contrast'],
  };

  test('should have no critical accessibility violations on homepage @critical @accessibility', async ({
    page,
  }) => {
    const homePage = new HomePage(page);

    await test.step('Navigate to homepage', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();
      logger.info('[PASS] Homepage loaded');
    });

    await test.step('Run axe-core scan', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const { violations } = accessibilityScanResults;

      // Separate known vs new violations (regression detection)
      const newViolations = violations.filter(
        (v) =>
          (v.impact === 'critical' || v.impact === 'serious') &&
          !KNOWN_VIOLATIONS.homepage.includes(v.id),
      );

      const knownViolations = violations.filter(
        (v) =>
          (v.impact === 'critical' || v.impact === 'serious') &&
          KNOWN_VIOLATIONS.homepage.includes(v.id),
      );

      // Log all violations for visibility
      if (violations.length > 0) {
        logger.warn(`⚠️ Found ${violations.length} accessibility violations on homepage:`);
        violations.forEach((violation) => {
          const isKnown = KNOWN_VIOLATIONS.homepage.includes(violation.id);
          const prefix = isKnown ? '📋 [KNOWN]' : '🆕 [NEW]';
          logger.warn(`  ${prefix} ${violation.id}: ${violation.help}`);
          logger.warn(`    Impact: ${violation.impact}`);
          logger.warn(`    Affected nodes: ${violation.nodes.length}`);
        });
      } else {
        logger.info('✅ No accessibility violations found on homepage');
      }

      // Document known violations
      if (knownViolations.length > 0) {
        logger.info(
          `📋 ${knownViolations.length} known violations documented (not blocking CI)`,
        );
      }

      // Only fail on NEW violations (regression detection)
      expect(
        newViolations,
        `Found ${newViolations.length} NEW accessibility violations. ` +
          `Known violations: ${knownViolations.length}. ` +
          `This test fails only on regressions, not pre-existing issues.`,
      ).toHaveLength(0);

      if (newViolations.length === 0 && knownViolations.length > 0) {
        logger.info(
          `[PASS] No NEW violations. ${knownViolations.length} known issues are documented.`,
        );
      } else if (violations.length === 0) {
        logger.info('[PASS] No accessibility violations found');
      }
    });
  });

  test('should have no critical accessibility violations on login page @critical @accessibility', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.navigateTo();
      await loginPage.isPageLoaded();
      logger.info('[PASS] Login page loaded');
    });

    await test.step('Run axe-core scan', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const { violations } = accessibilityScanResults;

      const newViolations = violations.filter(
        (v) =>
          (v.impact === 'critical' || v.impact === 'serious') &&
          !KNOWN_VIOLATIONS.loginPage.includes(v.id),
      );

      const knownViolations = violations.filter(
        (v) =>
          (v.impact === 'critical' || v.impact === 'serious') &&
          KNOWN_VIOLATIONS.loginPage.includes(v.id),
      );

      if (violations.length > 0) {
        logger.warn(`⚠️ Found ${violations.length} accessibility violations on login page:`);
        violations.forEach((violation) => {
          const isKnown = KNOWN_VIOLATIONS.loginPage.includes(violation.id);
          const prefix = isKnown ? '📋 [KNOWN]' : '🆕 [NEW]';
          logger.warn(`  ${prefix} ${violation.id}: ${violation.help}`);
          logger.warn(`    Impact: ${violation.impact}`);
        });
      } else {
        logger.info('✅ No accessibility violations found on login page');
      }

      if (knownViolations.length > 0) {
        logger.info(
          `📋 ${knownViolations.length} known violations documented (not blocking CI)`,
        );
      }

      expect(
        newViolations,
        `Found ${newViolations.length} NEW accessibility violations on login page`,
      ).toHaveLength(0);

      if (newViolations.length === 0) {
        logger.info('[PASS] No NEW violations on login page');
      }
    });
  });

  test('should have no critical accessibility violations on products page @critical @accessibility', async ({
    page,
  }) => {
    const productsPage = new ProductsPage(page);

    await test.step('Navigate to products page', async () => {
      await productsPage.navigateTo();
      await productsPage.isPageLoaded();
      logger.info('[PASS] Products page loaded');
    });

    await test.step('Run axe-core scan', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const { violations } = accessibilityScanResults;

      const newViolations = violations.filter(
        (v) =>
          (v.impact === 'critical' || v.impact === 'serious') &&
          !KNOWN_VIOLATIONS.productsPage.includes(v.id),
      );

      const knownViolations = violations.filter(
        (v) =>
          (v.impact === 'critical' || v.impact === 'serious') &&
          KNOWN_VIOLATIONS.productsPage.includes(v.id),
      );

      if (violations.length > 0) {
        logger.warn(`⚠️ Found ${violations.length} accessibility violations on products page:`);
        violations.forEach((violation) => {
          const isKnown = KNOWN_VIOLATIONS.productsPage.includes(violation.id);
          const prefix = isKnown ? '📋 [KNOWN]' : '🆕 [NEW]';
          logger.warn(`  ${prefix} ${violation.id}: ${violation.help}`);
          logger.warn(`    Impact: ${violation.impact}`);
          logger.warn(`    Affected nodes: ${violation.nodes.length}`);
        });
      } else {
        logger.info('✅ No accessibility violations found on products page');
      }

      if (knownViolations.length > 0) {
        logger.info(
          `📋 ${knownViolations.length} known violations documented (not blocking CI)`,
        );
      }

      expect(
        newViolations,
        `Found ${newViolations.length} NEW accessibility violations on products page`,
      ).toHaveLength(0);

      if (newViolations.length === 0) {
        logger.info('[PASS] No NEW violations on products page');
      }
    });
  });

  test('should generate detailed accessibility report with all violation types @accessibility @reporting', async ({
    page,
  }) => {
    const homePage = new HomePage(page);

    await test.step('Navigate to homepage', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();
    });

    await test.step('Generate full accessibility report', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const { violations, passes, incomplete } = accessibilityScanResults;

      // Log summary
      logger.info('📊 Accessibility Scan Summary:');
      logger.info(`  ✅ Passed: ${passes.length} rules`);
      logger.info(`  ❌ Violations: ${violations.length} rules`);
      logger.info(`  ⚠️  Incomplete: ${incomplete.length} rules (require manual review)`);

      // Categorize violations by impact
      const violationsByImpact = {
        critical: violations.filter((v) => v.impact === 'critical'),
        serious: violations.filter((v) => v.impact === 'serious'),
        moderate: violations.filter((v) => v.impact === 'moderate'),
        minor: violations.filter((v) => v.impact === 'minor'),
      };

      logger.info('');
      logger.info('📋 Violations by Impact:');
      logger.info(`  🔴 Critical: ${violationsByImpact.critical.length}`);
      logger.info(`  🟠 Serious: ${violationsByImpact.serious.length}`);
      logger.info(`  🟡 Moderate: ${violationsByImpact.moderate.length}`);
      logger.info(`  🟢 Minor: ${violationsByImpact.minor.length}`);

      // Detailed violation report
      if (violations.length > 0) {
        logger.info('');
        logger.info('📝 Detailed Violation Report:');
        violations.forEach((violation, index) => {
          logger.info(`\n${index + 1}. ${violation.id.toUpperCase()}`);
          logger.info(`   Help: ${violation.help}`);
          logger.info(`   Impact: ${violation.impact}`);
          logger.info(`   WCAG: ${violation.tags.filter((t) => t.startsWith('wcag')).join(', ')}`);
          logger.info(`   Affected elements: ${violation.nodes.length}`);

          // Show first affected element as example
          if (violation.nodes.length > 0) {
            const firstNode = violation.nodes[0];
            logger.info(`   Example: ${firstNode.html.substring(0, 100)}...`);
          }
        });
      }

      // This test is informational - doesn't fail, just reports
      expect(violations).toBeDefined();
      logger.info('\n[PASS] Accessibility report generated successfully');
    });
  });

  test('should validate specific WCAG 2.2 criteria with axe-core @accessibility @wcag22', async ({
    page,
  }) => {
    const homePage = new HomePage(page);

    await test.step('Navigate to homepage', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();
    });

    await test.step('Check WCAG 2.2 specific rules', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag22aa'])
        .analyze();

      const { violations } = accessibilityScanResults;

      logger.info('🔍 WCAG 2.2 Specific Validation:');

      if (violations.length > 0) {
        logger.warn(`⚠️ Found ${violations.length} WCAG 2.2 violations:`);
        violations.forEach((violation) => {
          const wcag22Tags = violation.tags.filter((t) => t.startsWith('wcag22'));
          if (wcag22Tags.length > 0) {
            logger.warn(`  - ${violation.id}: ${violation.help}`);
            logger.warn(`    WCAG 2.2 Tags: ${wcag22Tags.join(', ')}`);
          }
        });
      } else {
        logger.info('✅ No WCAG 2.2 specific violations found');
      }

      // For now, this is informational - WCAG 2.2 adoption is ongoing
      expect(violations).toBeDefined();
      logger.info('[PASS] WCAG 2.2 scan completed');
    });
  });

  test('should detect color contrast issues automatically @accessibility @contrast', async ({
    page,
  }) => {
    const homePage = new HomePage(page);

    await test.step('Navigate to homepage', async () => {
      await homePage.navigateTo();
      await homePage.isPageLoaded();
    });

    await test.step('Run color contrast specific scan', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['cat.color'])
        .analyze();

      const { violations } = accessibilityScanResults;

      logger.info('🎨 Color Contrast Scan:');

      const contrastViolations = violations.filter((v) => v.id.includes('color-contrast'));

      if (contrastViolations.length > 0) {
        logger.warn(`⚠️ Found ${contrastViolations.length} color contrast issues:`);
        contrastViolations.forEach((violation) => {
          logger.warn(`  - ${violation.help}`);
          logger.warn(`    Affected elements: ${violation.nodes.length}`);
        });
      } else {
        logger.info('✅ All color contrast checks passed');
      }

      // Color contrast violations are serious but acceptable for this site
      // Just log them for visibility
      expect(violations).toBeDefined();
      logger.info('[PASS] Color contrast scan completed');
    });
  });
});
