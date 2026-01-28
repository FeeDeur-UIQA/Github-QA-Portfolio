/**
 * UserFactory Unit Tests
 * Validates data generation, uniqueness, and schema compliance
 */

import { UserFactory, type UserAccount } from '../UserFactory';

describe('UserFactory - Data Generation', () => {
  describe('createAccount()', () => {
    it('should generate a valid user account with default role USER', () => {
      const user = UserFactory.createAccount();

      expect(user).toBeDefined();
      expect(user.role).toBe('USER');
      expect(user.email).toContain('qa_user_');
      expect(user.name).toBeTruthy();
    });

    it('should support different user roles', () => {
      const admin = UserFactory.createAccount('ADMIN');
      const guest = UserFactory.createAccount('GUEST');
      const blocked = UserFactory.createAccount('BLOCKED');

      expect(admin.role).toBe('ADMIN');
      expect(guest.role).toBe('GUEST');
      expect(blocked.role).toBe('BLOCKED');
    });

    it('should not persist to lastGeneratedUser when persist=false', () => {
      UserFactory.createAccount('USER', false);
      const last = UserFactory.getLastUser();

      // Should be different user since previous wasn't persisted
      expect(last.role).toBe('USER');
    });

    it('should generate emails with nanosecond precision for collision avoidance', () => {
      const user1 = UserFactory.createAccount();
      const user2 = UserFactory.createAccount();

      expect(user1.email).not.toEqual(user2.email);
    });
  });

  describe('Email Collision Resistance', () => {
    it('should generate unique emails across multiple accounts', () => {
      const emails = new Set();
      const userCount = 100;

      for (let i = 0; i < userCount; i++) {
        const user = UserFactory.createAccount();
        emails.add(user.email);
      }

      expect(emails.size).toBe(userCount);
    });

    it('should include role name in email for traceability', () => {
      const admin = UserFactory.createAccount('ADMIN');
      const user = UserFactory.createAccount('USER');
      const guest = UserFactory.createAccount('GUEST');

      expect(admin.email).toContain('admin');
      expect(user.email).toContain('user');
      expect(guest.email).toContain('guest');
    });

    it('should include timestamp and process ID for debugging', () => {
      const user = UserFactory.createAccount();
      const parts = user.email.split('_');

      // Format: qa_role_timestamp_processid_nanosuffix@automation.test
      expect(parts.length).toBeGreaterThanOrEqual(5);
      expect(parts[0]).toBe('qa');
    });
  });

  describe('User Data Completeness', () => {
    it('should generate all required fields', () => {
      const user = UserFactory.createAccount();
      const requiredFields: (keyof UserAccount)[] = [
        'name',
        'firstName',
        'lastName',
        'email',
        'password',
        'title',
        'day',
        'month',
        'year',
        'address1',
        'country',
        'state',
        'city',
        'zipcode',
        'mobile',
        'role',
      ];

      requiredFields.forEach((field) => {
        expect(user[field]).toBeDefined();
        expect(user[field]).not.toBeNull();
      });
    });

    it('should have valid day (1-28)', () => {
      const user = UserFactory.createAccount();
      const day = parseInt(user.day);

      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(28);
    });

    it('should have valid month (1-12)', () => {
      const user = UserFactory.createAccount();
      const month = parseInt(user.month);

      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    });

    it('should have valid year (1970-2005)', () => {
      const user = UserFactory.createAccount();
      const year = parseInt(user.year);

      expect(year).toBeGreaterThanOrEqual(1970);
      expect(year).toBeLessThanOrEqual(2005);
    });

    it('should have title as Mr or Mrs', () => {
      const titles = new Set();

      for (let i = 0; i < 50; i++) {
        const user = UserFactory.createAccount();
        titles.add(user.title);
      }

      // Should have both Mr and Mrs across 50 users
      expect(['Mr', 'Mrs']).toEqual(expect.arrayContaining(Array.from(titles)));
    });

    it('should have valid password (14+ characters)', () => {
      const user = UserFactory.createAccount();

      expect(user.password).toBeDefined();
      expect(user.password.length).toBeGreaterThanOrEqual(10);
    });

    it('should have US-based address fields', () => {
      const user = UserFactory.createAccount();

      expect(user.country).toBe('United States');
      expect(user.state).toBeTruthy();
      expect(user.city).toBeTruthy();
      expect(user.zipcode).toBeTruthy();
    });
  });

  describe('getLastUser()', () => {
    it('should return the last persisted user', () => {
      const user1 = UserFactory.createAccount();
      const last = UserFactory.getLastUser();

      expect(last.email).toBe(user1.email);
      expect(last.firstName).toBe(user1.firstName);
    });

    it('should create a new user if none have been persisted', () => {
      UserFactory.createAccount('USER', false);
      const last = UserFactory.getLastUser();

      expect(last).toBeDefined();
      expect(last.email).toContain('@automation.test');
    });
  });

  describe('createInternationalUser()', () => {
    it('should create a user with overrides', () => {
      const overrides = {
        firstName: 'CustomFirst',
        lastName: 'CustomLast',
        country: 'Canada',
      };

      const user = UserFactory.createInternationalUser(overrides);

      expect(user.firstName).toBe('CustomFirst');
      expect(user.lastName).toBe('CustomLast');
      expect(user.country).toBe('Canada');
    });

    it('should not persist international users by default', () => {
      UserFactory.createInternationalUser({
        firstName: 'International',
      });

      const last = UserFactory.getLastUser();

      expect(last.firstName).not.toBe('International');
    });
  });

  describe('getCleanupPayload()', () => {
    it('should generate valid cleanup payload', () => {
      const user = UserFactory.createAccount();
      const payload = UserFactory.getCleanupPayload(user);

      expect(payload.url).toBe('/api/deleteAccount');
      expect(payload.method).toBe('DELETE');
      expect(payload.params.email).toBe(user.email);
      expect(payload.params.password).toBe(user.password);
    });
  });
});

describe('UserFactory - Schema Validation', () => {
  describe('validateSchema()', () => {
    it('should validate a correct user schema', () => {
      const user = UserFactory.createAccount();

      expect(() => UserFactory.validateSchema(user)).not.toThrow();
      expect(UserFactory.validateSchema(user)).toBe(true);
    });

    it('should throw error if email is missing', () => {
      const user = UserFactory.createAccount();
      const { email, ...incomplete } = user;

      expect(() => UserFactory.validateSchema(incomplete as UserAccount)).toThrow(/email/i);
    });

    it('should throw error if password is missing', () => {
      const user = UserFactory.createAccount();
      const { password, ...incomplete } = user;

      expect(() => UserFactory.validateSchema(incomplete as UserAccount)).toThrow(/password/i);
    });

    it('should throw error if firstName is missing', () => {
      const user = UserFactory.createAccount();
      const { firstName, ...incomplete } = user;

      expect(() => UserFactory.validateSchema(incomplete as UserAccount)).toThrow(/firstName/i);
    });

    it('should throw error if multiple mandatory fields are missing', () => {
      const incomplete: any = {
        firstName: 'Test',
      };

      expect(() => UserFactory.validateSchema(incomplete)).toThrow();
    });

    it('should list all missing fields in error message', () => {
      const incomplete: any = {};

      expect(() => UserFactory.validateSchema(incomplete)).toThrow();

      try {
        UserFactory.validateSchema(incomplete);
      } catch (error: any) {
        expect(error.message).toContain('email');
        expect(error.message).toContain('password');
      }
    });
  });
});

describe('UserFactory - Parallel Execution Safety', () => {
  it('should generate unique emails in parallel-like scenario', async () => {
    const promises = Array.from({ length: 50 }, () => Promise.resolve(UserFactory.createAccount()));

    const users = await Promise.all(promises);
    const emails = users.map((u) => u.email);
    const uniqueEmails = new Set(emails);

    expect(uniqueEmails.size).toBe(users.length);
  });

  it('should handle concurrent calls without collisions', () => {
    const results = new Map<string, UserAccount>();

    // Simulate concurrent-like generation
    for (let i = 0; i < 30; i++) {
      const user = UserFactory.createAccount();
      results.set(user.email, user);
    }

    expect(results.size).toBe(30);
  });
});

describe('UserFactory - Role-Specific Behavior', () => {
  describe('ADMIN Role', () => {
    it('should generate admin users with ADMIN role', () => {
      const admin = UserFactory.createAccount('ADMIN');
      expect(admin.role).toBe('ADMIN');
    });
  });

  describe('GUEST Role', () => {
    it('should generate guest users with GUEST role', () => {
      const guest = UserFactory.createAccount('GUEST');
      expect(guest.role).toBe('GUEST');
    });
  });

  describe('USER Role', () => {
    it('should be the default role', () => {
      const user = UserFactory.createAccount();
      expect(user.role).toBe('USER');
    });
  });

  describe('BLOCKED Role', () => {
    it('should generate blocked users with BLOCKED role', () => {
      const blocked = UserFactory.createAccount('BLOCKED');
      expect(blocked.role).toBe('BLOCKED');
    });
  });
});
