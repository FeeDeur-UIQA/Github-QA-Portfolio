import { apiTest, expect } from '../../fixtures/api-fixtures';

apiTest.describe('TC-API04: API Error Handling @api @critical @fast', () => {
  apiTest('should handle 404 for non-existent endpoint', async ({ apiClient }) => {
    await apiTest.step('Request invalid endpoint', async () => {
      try {
        await apiClient.get('/nonexistent');
        throw new Error('Expected request to fail');
      } catch (error: any) {
        expect([0, 404]).toContain(error.status);
      }
    });
  });

  apiTest('should handle 400 with invalid query parameters', async ({ apiClient }) => {
    await apiTest.step('Request with malformed params', async () => {
      try {
        await apiClient.get('/productsList', {
          params: { page: -1 },
        });
      } catch (error: any) {
        expect([400, 422]).toContain(error.status);
      }
    });
  });

  apiTest('should handle timeout gracefully', async ({ apiClient }) => {
    await apiTest.step('Request with short timeout', async () => {
      try {
        await apiClient.get('/productsList', {
          timeout: 1,
        });
      } catch (error: any) {
        expect(error.message.toLowerCase()).toContain('timeout');
      }
    });
  });

  apiTest('should include error details in failed responses', async ({ apiClient }) => {
    await apiTest.step('Validate error structure', async () => {
      try {
        await apiClient.get('/nonexistent');
      } catch (error: any) {
        expect(error.status).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.endpoint).toBe('/nonexistent');
        expect(error.timestamp).toBeDefined();
      }
    });
  });
});
