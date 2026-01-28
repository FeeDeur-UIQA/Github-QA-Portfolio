/**
 * Test Data Factory
 * 
 * Centralized factory for generating realistic test data.
 * Ensures consistency and reduces duplication across tests.
 * 
 * @usage
 * const product = TestDataFactory.createProduct();
 * const address = TestDataFactory.createAddress();
 */

import { faker } from '@faker-js/faker';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  brand: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  mobileNumber: string;
}

export interface CreditCard {
  number: string;
  cvc: string;
  expiryMonth: string;
  expiryYear: string;
  nameOnCard: string;
}

export interface SearchQuery {
  term: string;
  category?: string;
  expectedResults: number;
}

/**
 * Factory for generating test data
 */
export class TestDataFactory {
  /**
   * Create a mock product
   */
  static createProduct(overrides: Partial<Product> = {}): Product {
    return {
      id: faker.string.numeric(5),
      name: faker.commerce.productName(),
      price: parseFloat(faker.commerce.price()),
      category: faker.commerce.department(),
      brand: faker.company.name(),
      ...overrides,
    };
  }

  /**
   * Create multiple products
   */
  static createProducts(count: number): Product[] {
    return Array.from({ length: count }, () => this.createProduct());
  }

  /**
   * Create a valid address
   */
  static createAddress(overrides: Partial<Address> = {}): Address {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      address1: faker.location.streetAddress(),
      address2: faker.location.secondaryAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zipcode: faker.location.zipCode(),
      country: 'United States',
      mobileNumber: faker.phone.number(),
      ...overrides,
    };
  }

  /**
   * Create a valid credit card (test data)
   */
  static createCreditCard(overrides: Partial<CreditCard> = {}): CreditCard {
    const currentYear = new Date().getFullYear();
    
    return {
      number: '4111111111111111', // Test Visa card
      cvc: faker.string.numeric(3),
      expiryMonth: faker.string.numeric(2),
      expiryYear: (currentYear + 2).toString(),
      nameOnCard: faker.person.fullName(),
      ...overrides,
    };
  }

  /**
   * Create a search query with expected behavior
   */
  static createSearchQuery(overrides: Partial<SearchQuery> = {}): SearchQuery {
    const terms = [
      'blue top',
      'jeans',
      'dress',
      'tshirt',
      'polo',
      'men',
      'women',
      'kids',
    ];

    return {
      term: faker.helpers.arrayElement(terms),
      expectedResults: faker.number.int({ min: 0, max: 50 }),
      ...overrides,
    };
  }

  /**
   * Create invalid data for negative testing
   */
  static createInvalidEmail(): string {
    return faker.helpers.arrayElement([
      'invalid.email',
      'missing@domain',
      '@nodomain.com',
      'spaces in@email.com',
      'double@@domain.com',
    ]);
  }

  /**
   * Create SQL injection payloads for security testing
   */
  static createSQLInjectionPayload(): string {
    return faker.helpers.arrayElement([
      "' OR '1'='1",
      "admin'--",
      "' OR '1'='1' --",
      "1' UNION SELECT NULL--",
      "' OR 1=1--",
    ]);
  }

  /**
   * Create XSS payloads for security testing
   */
  static createXSSPayload(): string {
    return faker.helpers.arrayElement([
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')">',
    ]);
  }

  /**
   * Create boundary test values
   */
  static createBoundaryValues(type: 'number' | 'string'): {
    min: string | number;
    max: string | number;
    justBelowMin: string | number;
    justAboveMax: string | number;
  } {
    if (type === 'number') {
      return {
        min: 0,
        max: 999999,
        justBelowMin: -1,
        justAboveMax: 1000000,
      };
    }

    return {
      min: 'a',
      max: 'z'.repeat(255),
      justBelowMin: '',
      justAboveMax: 'a'.repeat(256),
    };
  }

  /**
   * Create performance test data (large datasets)
   */
  static createLargeDataset<T>(
    factory: () => T,
    size: number = 1000
  ): T[] {
    return Array.from({ length: size }, factory);
  }

  /**
   * Create realistic user profile
   */
  static createUserProfile(overrides: Partial<{
    name: string;
    email: string;
    phone: string;
    dateOfBirth: Date;
    gender: 'male' | 'female';
  }> = {}) {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
      gender: faker.helpers.arrayElement(['male', 'female'] as const),
      ...overrides,
    };
  }

  /**
   * Reset any stateful data (if needed)
   */
  static reset(): void {
    faker.seed(); // Reset faker seed for reproducibility if needed
  }
}
