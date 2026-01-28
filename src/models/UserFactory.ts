import type { UserAccount } from '../support/factories/UserFactory';

// DEPRECATED: This file is kept for backwards compatibility only.
// Use ../support/factories/UserFactory instead.

export class UserFactory {
  static createDefaultUser(overrides?: Partial<UserAccount>): UserAccount {
    return {
      name: 'Test User',
      firstName: 'Test',
      lastName: 'Architect',
      email: `test_${Date.now()}@example.com`,
      password: 'Password123!',
      title: 'Mr',
      day: '1',
      month: '1',
      year: '1990',
      subscribe: true,
      specialOffers: false,
      address1: '123 Test St',
      country: 'United States',
      state: 'California',
      city: 'San Francisco',
      zipcode: '94102',
      mobile: '+1234567890',
      role: 'USER',
      ...overrides,
    };
  }
}
