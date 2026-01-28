import { test, expect } from '@playwright/test';

import { ApiError } from '../../src/support/clients/BaseApiClient';

/**
 * Unit Tests for BaseApiClient
 *
 * Tests error handling and ApiError class structure
 * Increases coverage for src/support/clients/BaseApiClient.ts
 */

test.describe('BaseApiClient Unit Tests @fast @unit', () => {
  test.describe('ApiError Class', () => {
    test('should create ApiError with all properties', () => {
      const error = new ApiError(404, 'Not Found', '/api/test', '2025-01-21T10:00:00Z');

      expect(error.status).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.endpoint).toBe('/api/test');
      expect(error.timestamp).toBe('2025-01-21T10:00:00Z');
      expect(error.name).toBe('ApiError');
      expect(error instanceof Error).toBe(true);
    });

    test('should create ApiError with 500 status', () => {
      const error = new ApiError(
        500,
        'Internal Server Error',
        '/api/products',
        '2025-01-21T10:05:00Z',
      );

      expect(error.status).toBe(500);
      expect(error.message).toBe('Internal Server Error');
    });

    test('should create ApiError with 429 rate limit', () => {
      const error = new ApiError(429, 'Too Many Requests', '/api/search', '2025-01-21T10:10:00Z');

      expect(error.status).toBe(429);
      expect(error.message).toBe('Too Many Requests');
    });

    test('should be throwable and catchable', () => {
      const error = new ApiError(403, 'Forbidden', '/api/secure', '2025-01-21T10:15:00Z');

      expect(() => {
        throw error;
      }).toThrow('Forbidden');
    });

    test('should work with instanceof checks', () => {
      const error = new ApiError(400, 'Bad Request', '/api/invalid', '2025-01-21T10:20:00Z');

      expect(error instanceof ApiError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    test('should have correct error name', () => {
      const error = new ApiError(503, 'Service Unavailable', '/api/down', '2025-01-21T10:25:00Z');

      expect(error.name).toBe('ApiError');
      expect(error.constructor.name).toBe('ApiError');
    });

    test('should preserve endpoint information', () => {
      const endpoint = '/api/products/search?q=test';
      const error = new ApiError(404, 'Not Found', endpoint, '2025-01-21T10:30:00Z');

      expect(error.endpoint).toBe(endpoint);
    });

    test('should preserve timestamp information', () => {
      const timestamp = '2025-01-21T10:35:00.123Z';
      const error = new ApiError(401, 'Unauthorized', '/api/auth', timestamp);

      expect(error.timestamp).toBe(timestamp);
    });

    test('should have message property for error handling', () => {
      const message = 'Custom error message for testing';
      const error = new ApiError(422, message, '/api/validation', '2025-01-21T10:40:00Z');

      expect(error.message).toBe(message);
      expect(String(error)).toContain(message);
    });

    test('should support different HTTP error codes', () => {
      const codes = [400, 401, 403, 404, 422, 429, 500, 502, 503, 504];

      codes.forEach((code) => {
        const error = new ApiError(code, `Error ${code}`, '/api/test', new Date().toISOString());
        expect(error.status).toBe(code);
      });
    });

    test('should create unique error instances', () => {
      const error1 = new ApiError(404, 'Not Found', '/api/test1', '2025-01-21T10:45:00Z');
      const error2 = new ApiError(404, 'Not Found', '/api/test2', '2025-01-21T10:50:00Z');

      expect(error1).not.toBe(error2);
      expect(error1.endpoint).not.toBe(error2.endpoint);
    });

    test('should handle empty messages', () => {
      const error = new ApiError(500, '', '/api/test', '2025-01-21T10:55:00Z');

      expect(error.message).toBe('');
      expect(error.status).toBe(500);
    });

    test('should handle long messages', () => {
      const longMessage = 'This is a very long error message '.repeat(10);
      const error = new ApiError(400, longMessage, '/api/test', '2025-01-21T11:00:00Z');

      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBeGreaterThan(100);
    });

    test('should handle complex endpoint paths', () => {
      const complexEndpoint = '/api/v1/products/123/reviews?page=2&sort=desc#section1';
      const error = new ApiError(404, 'Not Found', complexEndpoint, '2025-01-21T11:05:00Z');

      expect(error.endpoint).toBe(complexEndpoint);
    });

    test('should work in try-catch blocks', () => {
      let caughtError: ApiError | null = null;

      try {
        throw new ApiError(500, 'Server Error', '/api/fail', '2025-01-21T11:10:00Z');
      } catch (e) {
        caughtError = e as ApiError;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.status).toBe(500);
    });
  });
});
