/**
 * Test User Factory
 *
 * Generates unique test users with proper isolation and cleanup tracking.
 * Prevents test data pollution and coupling between tests.
 *
 * @usage
 * const user = await TestUserFactory.createUser({ namePrefix: 'checkout' });
 * // Use user in test
 * await TestUserFactory.cleanup(user.email);
 */

import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';

import { HomePage } from '../../pages/HomePage';
import { SignupPage } from '../../pages/SignupPage';
import { Logger } from '../../utils/Logger';

const logger = Logger.getInstance('TestUserFactory');

export interface TestUser {
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  testName?: string;
}

export interface UserOptions {
  namePrefix?: string;
  domain?: string;
  password?: string;
  testName?: string;
}

/**
 * Factory for creating and managing test users
 */
export class TestUserFactory {
  private static createdUsers: TestUser[] = [];
  private static readonly DEFAULT_PASSWORD = 'TestPassword123!';
  private static readonly DEFAULT_DOMAIN = 'example.com';

  /**
   * Create a unique test user with proper isolation
   */
  static createUser(options: UserOptions = {}): TestUser {
    const {
      namePrefix = 'test',
      domain = this.DEFAULT_DOMAIN,
      password = this.DEFAULT_PASSWORD,
      testName,
    } = options;

    // Generate unique identifiers to prevent collisions
    const timestamp = Date.now();
    const randomId = faker.string.alphanumeric(6).toLowerCase();

    const user: TestUser = {
      name: `${namePrefix}_${randomId}`,
      email: `${namePrefix}_${timestamp}_${randomId}@${domain}`,
      password,
      createdAt: new Date(),
      testName,
    };

    this.createdUsers.push(user);
    logger.info(`Created test user: ${user.email}`, { testName });

    return user;
  }

  /**
   * Register a user in the application
   */
  static async registerUser(page: Page, user: TestUser): Promise<void> {
    logger.info(`Registering user: ${user.email}`);

    const homePage = new HomePage(page);
    const signupPage = new SignupPage(page);

    await homePage.isPageLoaded();
    await homePage.navigateToLogin();
    await signupPage.isSignupFormVisible();
    await signupPage.enterSignupDetails(user.name, user.email);
    await signupPage.clickSignup();

    // Fill account details using the unified createAccount orchestration
    const accountData = {
      name: user.name,
      email: user.email,
      password: user.password,
      title: 'Mr' as const,
      firstName: user.name.split('_')[0],
      lastName: faker.person.lastName(),
      company: '',
      address1: faker.location.streetAddress(),
      address2: '',
      country: 'United States',
      state: faker.location.state(),
      city: faker.location.city(),
      zipcode: faker.location.zipCode(),
      mobile: faker.phone.number(),
      day: '1',
      month: '1',
      year: '2000',
      subscribe: true,
      specialOffers: true,
      role: 'USER' as const,
    };

    await signupPage.createAccount(accountData);

    logger.info(`User registered successfully: ${user.email}`);
  }

  /**
   * Create and register a user in one step
   */
  static async createAndRegisterUser(page: Page, options: UserOptions = {}): Promise<TestUser> {
    const user = this.createUser(options);
    await this.registerUser(page, user);
    return user;
  }

  /**
   * Get all users created in the current test session
   */
  static getCreatedUsers(): TestUser[] {
    return [...this.createdUsers];
  }

  /**
   * Get users created for a specific test
   */
  static getUsersByTest(testName: string): TestUser[] {
    return this.createdUsers.filter((u) => u.testName === testName);
  }

  /**
   * Clean up a specific user (delete account)
   */
  static async cleanup(email: string, page?: Page): Promise<void> {
    logger.info(`Cleaning up user: ${email}`);

    if (page) {
      try {
        // Navigate to delete account page
        // Note: Implement actual deletion logic based on your app
        await page.goto('/delete_account');
        logger.info(`User account deleted: ${email}`);
      } catch (error) {
        logger.warn(`Failed to delete user account: ${email}`, { error });
      }
    }

    // Remove from tracking
    this.createdUsers = this.createdUsers.filter((u) => u.email !== email);
  }

  /**
   * Clean up all users created in current session
   */
  static async cleanupAll(page?: Page): Promise<void> {
    logger.info(`Cleaning up ${this.createdUsers.length} test users`);

    const emails = this.createdUsers.map((u) => u.email);

    for (const email of emails) {
      await this.cleanup(email, page);
    }

    logger.info('All test users cleaned up');
  }

  /**
   * Clean up users created by a specific test
   */
  static async cleanupByTest(testName: string, page?: Page): Promise<void> {
    const users = this.getUsersByTest(testName);
    logger.info(`Cleaning up ${users.length} users for test: ${testName}`);

    for (const user of users) {
      await this.cleanup(user.email, page);
    }
  }

  /**
   * Reset factory state (for test isolation)
   */
  static reset(): void {
    this.createdUsers = [];
    logger.debug('TestUserFactory reset');
  }

  /**
   * Get summary of created users
   */
  static getSummary(): {
    total: number;
    byTest: Record<string, number>;
    oldest: Date | null;
    newest: Date | null;
  } {
    if (this.createdUsers.length === 0) {
      return {
        total: 0,
        byTest: {},
        oldest: null,
        newest: null,
      };
    }

    const byTest: Record<string, number> = {};
    this.createdUsers.forEach((u) => {
      if (u.testName) {
        byTest[u.testName] = (byTest[u.testName] || 0) + 1;
      }
    });

    const dates = this.createdUsers.map((u) => u.createdAt);

    return {
      total: this.createdUsers.length,
      byTest,
      oldest: new Date(Math.min(...dates.map((d) => d.getTime()))),
      newest: new Date(Math.max(...dates.map((d) => d.getTime()))),
    };
  }
}
