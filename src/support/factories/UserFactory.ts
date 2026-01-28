import { faker } from '@faker-js/faker';

/**
 * USER ACCOUNT MODEL: 1:1 Mapping with Automation Exercise Registration Schema.
 */
export interface UserAccount {
  id?: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  title: 'Mr' | 'Mrs';
  day: string;
  month: string;
  year: string;
  subscribe: boolean;
  specialOffers: boolean;
  company?: string;
  address1: string;
  address2?: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  mobile: string;
  role: 'GUEST' | 'USER' | 'ADMIN' | 'BLOCKED';
}

/**
 * USER FACTORY: Anti-collision test data generation with nanosecond precision
 * Generates unique users with timestamps, process IDs, and nanosecond suffixes to prevent collisions in parallel execution.
 */
export class UserFactory {
  private static lastGeneratedUser: UserAccount | null = null;

  /**
   * Generates a unique UserAccount with collision-resistant email
   * @param role - User role type (default: 'USER')
   * @param persist - Whether to store as lastGeneratedUser (default: true)
   * @returns Complete UserAccount object with randomized data
   * @example
   * ```typescript
   * const user = UserFactory.createAccount();
   * const admin = UserFactory.createAccount('ADMIN');
   * const guest = UserFactory.createAccount('GUEST', false); // Don't persist
   * ```
   */
  static createAccount(role: UserAccount['role'] = 'USER', persist: boolean = true): UserAccount {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const isMale = faker.datatype.boolean();

    // Nanosecond precision + process ID ensures zero collisions
    const timestamp = Date.now();
    const processId = process.pid;
    const nanoSuffix = process.hrtime.bigint().toString().slice(-6);

    const user: UserAccount = {
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email: `qa_${role.toLowerCase()}_${timestamp}_${processId}_${nanoSuffix}@automation.test`,
      password: faker.internet.password({ length: 14 }),
      title: isMale ? 'Mr' : 'Mrs',
      day: faker.number.int({ min: 1, max: 28 }).toString(),
      month: faker.number.int({ min: 1, max: 12 }).toString(),
      year: faker.number.int({ min: 1970, max: 2005 }).toString(),
      subscribe: true,
      specialOffers: true,
      company: faker.company.name(),
      address1: faker.location.streetAddress(),
      address2: faker.location.secondaryAddress(),
      country: 'United States',
      state: faker.location.state(),
      city: faker.location.city(),
      zipcode: faker.location.zipCode(),
      mobile: faker.phone.number(),
      role: role,
    };

    if (persist) this.lastGeneratedUser = user;
    return user;
  }

  static getLastUser(): UserAccount {
    if (!this.lastGeneratedUser) return this.createAccount();
    return this.lastGeneratedUser;
  }

  static createInternationalUser(overrides: Partial<UserAccount> = {}): UserAccount {
    return {
      ...this.createAccount('USER', false),
      ...overrides,
    };
  }

  static getCleanupPayload(user: UserAccount) {
    return {
      url: '/api/deleteAccount',
      method: 'DELETE',
      params: { email: user.email, password: user.password },
    };
  }

  static validateSchema(user: UserAccount): boolean {
    const mandatoryFields: (keyof UserAccount)[] = [
      'email',
      'password',
      'firstName',
      'lastName',
      'name',
      'address1',
      'mobile',
    ];
    const missing = mandatoryFields.filter((field) => !user[field]);

    if (missing.length > 0) {
      throw new Error(`🚨 Schema Sync Failure: Missing fields [${missing.join(', ')}]`);
    }
    return true;
  }
}
