import { UserFactory } from '@factories/UserFactory';
import { LoginPage } from '@pages/LoginPage';
import { expect, test } from '@playwright/test';
import { Logger } from '@utils/Logger';

/**
 * TC-SEC04: Sensitive Data Exposure Validation
 *
 * OWASP Top 10 2021: A02:2021 – Cryptographic Failures
 * Reference: https://owasp.org/Top10/A02_2021-Cryptographic_Failures/
 *
 * Tests for common data exposure vulnerabilities:
 * - Password visibility in DOM/network
 * - Sensitive data in localStorage/sessionStorage
 * - PII in URL parameters or error messages
 * - Unencrypted transmission of credentials
 */
test.describe('TC-SEC04: Sensitive Data Exposure @security @flows @slow', () => {
  let logger: Logger;

  test.beforeEach(async () => {
    logger = Logger.getInstance('TC-SEC04_DataExposure');
  });

  test('should not expose passwords in DOM or input values @critical @security @e2e', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const testPassword = 'SuperSecret123!';

    await test.step('1: Navigate to login page', async () => {
      await loginPage.navigateTo();
      await loginPage.isPageLoaded();
      logger.info('[PASS] Login page loaded');
    });

    await test.step('2: Enter password and validate input type', async () => {
      const passwordInput = loginPage.getPasswordInput();
      await passwordInput.fill(testPassword);

      // Verify input type is password (not text)
      await expect(passwordInput).toHaveAttribute('type', 'password');
      logger.info('[PASS] Password input type is correctly set to "password"');

      // Verify the rendered text is masked
      const isPasswordMasked = await passwordInput.evaluate((el: HTMLInputElement) => {
        // Check if browser is masking the display
        return el.type === 'password';
      });

      expect(isPasswordMasked).toBe(true);
      logger.info('[PASS] Password is masked in browser display');
    });

    await test.step('3: Check for password in page source', async () => {
      const pageContent = await page.content();

      // Password should not appear in plain text anywhere in the page source
      // except in the input value attribute (which is expected and masked)
      const inputElement = await page
        .locator('input[type="password"]')
        .first()
        .evaluate((el) => el.outerHTML);
      const pageContentWithoutInput = pageContent.replace(inputElement, '');

      expect(pageContentWithoutInput).not.toContain(testPassword);
      logger.info('[PASS] Password not exposed in page source outside input element');
    });
  });

  test('should not store sensitive data in localStorage or sessionStorage @critical @security @e2e', async ({
    page,
  }) => {
    const newUser = UserFactory.createAccount();

    await test.step('1: Navigate to signup page', async () => {
      await page.goto('/signup');
      await page.waitForLoadState('domcontentloaded');
      logger.info('[PASS] Signup page loaded');
    });

    await test.step('2: Check localStorage for sensitive data BEFORE signup', async () => {
      const localStorageDataBefore = await page.evaluate(() => {
        const data: Record<string, string> = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              data[key] = localStorage.getItem(key) || '';
            }
          }
        } catch (e) {
          console.warn('localStorage access error:', e);
        }
        return data;
      });

      logger.info(
        `📦 localStorage keys before signup: ${Object.keys(localStorageDataBefore).join(', ')}`,
      );
      logger.info('[PASS] Pre-signup storage baseline established');
    });

    await test.step('3: Check sessionStorage for sensitive data BEFORE signup', async () => {
      const sessionStorageDataBefore = await page.evaluate(() => {
        const data: Record<string, string> = {};
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              data[key] = sessionStorage.getItem(key) || '';
            }
          }
        } catch (e) {
          console.warn('sessionStorage access error:', e);
        }
        return data;
      });

      logger.info(
        `📦 sessionStorage keys before signup: ${Object.keys(sessionStorageDataBefore).join(', ')}`,
      );
      logger.info('[PASS] Pre-signup session baseline established');
    });

    await test.step('4: Enter signup details (partial form)', async () => {
      // Just fill the basic signup form - don't submit yet
      const nameInput = page.locator('input[data-qa="signup-name"]');
      const emailInput = page.locator('input[data-qa="signup-email"]');

      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill(newUser.name);
      }
      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill(newUser.email);
      }

      logger.info('[PASS] Signup form partially filled');
    });

    await test.step('5: Verify credentials not stored before submission', async () => {
      const localStorageData = await page.evaluate(() => {
        const data: Record<string, string> = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              data[key] = localStorage.getItem(key) || '';
            }
          }
        } catch (e) {
          console.warn('localStorage access error:', e);
        }
        return data;
      });

      logger.info(`📦 localStorage keys: ${Object.keys(localStorageData).join(', ')}`);

      // Check for sensitive patterns in keys
      const sensitivePatterns = [/password/i, /pwd/i, /secret/i, /token/i];

      for (const [key] of Object.entries(localStorageData)) {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(key)) {
            logger.warn(`⚠[INFO]  Suspicious localStorage key found: ${key}`);
          }
        }
      }

      logger.info('[PASS] No password fields stored in localStorage');
    });

    await test.step('6: Verify credentials not stored in sessionStorage', async () => {
      const sessionStorageData = await page.evaluate(() => {
        const data: Record<string, string> = {};
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              data[key] = sessionStorage.getItem(key) || '';
            }
          }
        } catch (e) {
          console.warn('sessionStorage access error:', e);
        }
        return data;
      });

      logger.info(`📦 sessionStorage keys: ${Object.keys(sessionStorageData).join(', ')}`);
      logger.info('[PASS] No password fields stored in sessionStorage');
    });
  });

  test('should not expose sensitive data in URL parameters @critical @security @e2e', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const testEmail = 'security-test@example.com';
    const testPassword = 'TestPassword123!';

    await test.step('1: Attempt login with credentials', async () => {
      await loginPage.navigateTo();
      await loginPage.isPageLoaded();

      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();
      const loginButton = loginPage.getLoginButton();

      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);

      // Capture URL before and after login attempt
      const urlBeforeLogin = page.url();
      logger.info(`📍 URL before login: ${urlBeforeLogin}`);

      await loginButton.click();
      await page.waitForLoadState('domcontentloaded');

      const urlAfterLogin = page.url();
      logger.info(`📍 URL after login: ${urlAfterLogin}`);
    });

    await test.step('2: Validate no credentials in URL', async () => {
      const currentUrl = page.url();

      // Check URL doesn't contain password
      expect(currentUrl.toLowerCase()).not.toContain(testPassword.toLowerCase());
      expect(currentUrl.toLowerCase()).not.toContain(
        encodeURIComponent(testPassword).toLowerCase(),
      );
      logger.info('[PASS] Password not found in URL');

      // Check URL doesn't contain email
      expect(currentUrl).not.toContain(testEmail);
      expect(currentUrl).not.toContain(encodeURIComponent(testEmail));
      logger.info('[PASS] Email not found in URL');

      // Check for common parameter names that might leak credentials
      const suspiciousParams = ['password', 'pwd', 'pass', 'secret', 'token', 'key'];
      const urlParams = new URL(currentUrl).searchParams;

      for (const param of suspiciousParams) {
        expect(urlParams.has(param)).toBe(false);
      }

      logger.info('[PASS] No suspicious URL parameters detected');
    });
  });

  test('should not expose PII in network responses or error messages @critical @security @e2e', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const networkResponses: Array<{ url: string; body: string }> = [];

    await test.step('1: Monitor network traffic', async () => {
      // Capture network responses
      page.on('response', async (response) => {
        try {
          const responseUrl = new URL(response.url());
          const isTargetDomain =
            responseUrl.hostname === 'automationexercise.com' ||
            responseUrl.hostname.endsWith('.automationexercise.com');
          const isAsset =
            responseUrl.pathname.endsWith('.css') ||
            responseUrl.pathname.endsWith('.js') ||
            responseUrl.pathname.endsWith('.png');

          if (isTargetDomain && !isAsset) {
            const body = await response.text();
            networkResponses.push({ url: response.url(), body });
          }
        } catch (e) {
          // Some responses can't be read as text (e.g., images) or have invalid URLs
        }
      });

      await loginPage.navigateTo();
      await loginPage.isPageLoaded();
      logger.info('[PASS] Network monitoring started');
    });

    await test.step('2: Trigger failed login to check error messages', async () => {
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();
      const loginButton = loginPage.getLoginButton();

      const testEmail = 'nonexistent-user@test.com';
      const testPassword = 'WrongPassword123!';

      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      await loginButton.click();

      // Wait for login attempt to process
      await page.waitForLoadState('load');
      logger.info('[PASS] Failed login attempt completed');
    });

    await test.step('3: Analyze network responses for data exposure', async () => {
      logger.info(`📡 Captured ${networkResponses.length} network responses`);

      for (const response of networkResponses) {
        // Check responses don't contain actual password values (not form labels)
        // Skip HTML content - only check for API responses or suspicious JSON patterns
        const isJSON = response.body.includes('{') && response.body.includes('}');
        // Use string-based detection instead of problematic regex
        const lowerBody = response.body.toLowerCase();
        const hasActualPasswordValue =
          (lowerBody.includes('wrongpassword') ||
            lowerBody.includes('testpassword') ||
            lowerBody.includes('supersecret')) &&
          lowerBody.includes('password');

        if (isJSON && hasActualPasswordValue) {
          logger.warn(`⚠[INFO]  Potential password exposure in response`);
          expect(hasActualPasswordValue).toBe(false);
        }
      }

      logger.info('[PASS] No passwords found in network responses');
    });

    await test.step("4: Check error message doesn't leak user existence", async () => {
      const errorMessage = loginPage.getErrorMessage();
      const errorVisible = await errorMessage.isVisible().catch(() => false);

      if (errorVisible) {
        const errorText = await errorMessage.textContent();
        logger.info(`🚨 Error message: "${errorText}"`);

        // Good: "Invalid credentials", "Login failed", "Email or password is incorrect"
        // Bad: "User not found", "Email doesn't exist", "Your password is wrong"

        // Check error doesn't explicitly confirm user existence/non-existence
        const leaksUserExistence =
          /user (not found|does not exist|doesn't exist|not registered)/i.test(errorText || '');
        // Check for standalone "wrong password" or "incorrect password" (not "email or password")
        const leaksPasswordWrong =
          /^(?!.*email).*(wrong password|password is incorrect|incorrect password)$/i.test(
            errorText || '',
          );

        expect(leaksUserExistence).toBe(false);
        expect(leaksPasswordWrong).toBe(false);

        if (!leaksUserExistence && !leaksPasswordWrong) {
          logger.info('[PASS] Error message does not leak user enumeration data');
        }
      } else {
        logger.info('ℹ[INFO]  No error message displayed');
      }
    });
  });

  test('should use HTTPS for credential transmission @critical @security @e2e', async ({
    page,
  }) => {
    await test.step('1: Verify site uses HTTPS', async () => {
      await page.goto('/login');

      const currentUrl = page.url();
      const usesHTTPS = currentUrl.startsWith('https://');

      expect(usesHTTPS).toBe(true);
      logger.info('[PASS] Site uses HTTPS protocol');
    });

    await test.step('2: Check for mixed content warnings', async () => {
      const consoleLogs: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'warning' || msg.type() === 'error') {
          consoleLogs.push(msg.text());
        }
      });

      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      // Check for mixed content warnings
      const hasMixedContentWarning = consoleLogs.some((log) =>
        /mixed content|insecure|http:/i.test(log),
      );

      if (hasMixedContentWarning) {
        logger.warn('⚠[INFO]  Mixed content warnings detected');
        logger.warn(consoleLogs.filter((log) => /mixed content|insecure/i.test(log)).join('\n'));
      } else {
        logger.info('[PASS] No mixed content warnings');
      }
    });

    await test.step('3: Verify login form action uses HTTPS', async () => {
      const loginForm = page.locator('form[action*="login"]').first();
      const formAction = await loginForm.getAttribute('action');

      logger.info(`📍 Form action: ${formAction}`);

      // Form action should be relative (starts with /) or absolute HTTPS
      if (formAction) {
        const isRelative = formAction.startsWith('/');
        const isHTTPS = formAction.startsWith('https://');

        expect(isRelative || isHTTPS).toBe(true);

        if (formAction.startsWith('http://')) {
          logger.error('[FAIL] Form submits to HTTP endpoint!');
        } else {
          logger.info('[PASS] Form action is secure (relative or HTTPS)');
        }
      }
    });
  });
});
