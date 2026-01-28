import type { UserAccount } from './UserFactory';

import { UserFactory } from './UserFactory';

/**
 * User Pool for optimized parallel test execution
 * Pre-generates user accounts to reduce runtime overhead
 */
class UserPool {
  private static instance: UserPool;
  private readonly pool: UserAccount[] = [];
  private readonly poolSize = 10;
  private usedUsers = new Set<string>();

  private constructor() {
    this.initializePool();
  }

  static getInstance(): UserPool {
    if (!UserPool.instance) {
      UserPool.instance = new UserPool();
    }
    return UserPool.instance;
  }

  private initializePool(): void {
    // Pre-generate users for parallel tests
    for (let i = 0; i < this.poolSize; i++) {
      const user = UserFactory.createAccount('USER', false);
      this.pool.push(user);
    }
  }

  /**
   * Get an unused user from the pool
   * Creates new user if pool is exhausted
   */
  getUser(): UserAccount {
    // Find first unused user
    const availableUser = this.pool.find((user) => !this.usedUsers.has(user.email));

    if (availableUser) {
      this.usedUsers.add(availableUser.email);
      return availableUser;
    }

    // Pool exhausted, create new user
    const newUser = UserFactory.createAccount('USER', false);
    this.usedUsers.add(newUser.email);
    return newUser;
  }

  /**
   * Release user back to pool (for cleanup tests)
   */
  releaseUser(email: string): void {
    this.usedUsers.delete(email);
  }

  /**
   * Get pool statistics for debugging
   */
  getStats(): { total: number; used: number; available: number } {
    return {
      total: this.pool.length,
      used: this.usedUsers.size,
      available: this.pool.length - this.usedUsers.size,
    };
  }

  /**
   * Clear all used users (for test isolation)
   */
  reset(): void {
    this.usedUsers.clear();
  }
}

export const userPool = UserPool.getInstance();
