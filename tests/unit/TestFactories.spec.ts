import { test, expect } from '@playwright/test';

import { TestDataFactory } from '../../src/support/factories/TestDataFactory';
import { TestUserFactory } from '../../src/support/factories/TestUserFactory';

/**
 * Unit Tests for Test Data Factories
 *
 * Validates user and data generation utilities
 * Increases coverage for factories at 0%
 */

test.describe('TestUserFactory Unit Tests @fast @unit', () => {
  test('should generate unique emails', () => {
    const user1 = TestUserFactory.createUser({ namePrefix: 'test' });
    const user2 = TestUserFactory.createUser({ namePrefix: 'test' });

    expect(user1.email).not.toBe(user2.email);
  });

  test('should use custom name prefix', () => {
    const user = TestUserFactory.createUser({ namePrefix: 'custom' });

    expect(user.name).toContain('custom');
  });

  test('should use custom test name', () => {
    const user = TestUserFactory.createUser({
      testName: 'TC-01_Login',
      namePrefix: 'user',
    });

    expect(user.testName).toBe('TC-01_Login');
  });

  test('should generate valid password', () => {
    const user = TestUserFactory.createUser({ namePrefix: 'test' });

    expect(user.password).toBeDefined();
    expect(user.password.length).toBeGreaterThan(0);
  });

  test('should create unique users on multiple calls', () => {
    const users = Array.from({ length: 5 }, () =>
      TestUserFactory.createUser({ namePrefix: 'batch' }),
    );

    const emails = users.map((u) => u.email);
    const uniqueEmails = new Set(emails);

    expect(uniqueEmails.size).toBe(5);
  });
});

test.describe('TestDataFactory Unit Tests @fast @unit', () => {
  test('should generate product', () => {
    const product = TestDataFactory.createProduct();

    expect(product).toBeDefined();
    expect(product.id).toBeDefined();
    expect(product.name).toBeDefined();
    expect(product.price).toBeGreaterThan(0);
  });

  test('should generate address', () => {
    const address = TestDataFactory.createAddress();

    expect(address.firstName).toBeDefined();
    expect(address.lastName).toBeDefined();
    expect(address.city).toBeDefined();
    expect(address.state).toBeDefined();
    expect(address.zipcode).toBeDefined();
  });

  test('should generate credit card', () => {
    const card = TestDataFactory.createCreditCard();

    expect(card.number).toBe('4111111111111111'); // Test card
    expect(card.cvc).toBeDefined();
    expect(card.expiryMonth).toBeDefined();
    expect(card.expiryYear).toBeDefined();
  });

  test('should generate multiple products', () => {
    const products = TestDataFactory.createProducts(5);

    expect(products.length).toBe(5);
    const ids = products.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });

  test('should generate search query', () => {
    const query = TestDataFactory.createSearchQuery();

    expect(query.term).toBeDefined();
    expect(typeof query.term).toBe('string');
    expect(query.term.length).toBeGreaterThan(0);
  });

  test('should allow address overrides', () => {
    const address = TestDataFactory.createAddress({
      country: 'Canada',
      state: 'Ontario',
    });

    expect(address.country).toBe('Canada');
    expect(address.state).toBe('Ontario');
  });

  test('should allow product overrides', () => {
    const product = TestDataFactory.createProduct({
      category: 'Electronics',
      brand: 'TestBrand',
    });

    expect(product.category).toBe('Electronics');
    expect(product.brand).toBe('TestBrand');
  });

  test('should allow credit card overrides', () => {
    const card = TestDataFactory.createCreditCard({
      nameOnCard: 'John Doe',
    });

    expect(card.nameOnCard).toBe('John Doe');
  });

  test('should allow search query overrides', () => {
    const query = TestDataFactory.createSearchQuery({
      term: 'custom search',
      expectedResults: 10,
    });

    expect(query.term).toBe('custom search');
    expect(query.expectedResults).toBe(10);
  });
});
