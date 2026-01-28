/**
 * Mock Server Setup
 *
 * Configures MSW for Node.js test environment
 * Enables fast, deterministic API tests without network calls
 */

import { setupServer } from 'msw/node';

import { handlers } from './handlers';

// Setup mock server with default handlers
export const mockServer = setupServer(...handlers);

// Enable request logging in development
if (process.env.DEBUG_MSW) {
  mockServer.events.on('request:start', ({ request }) => {
    console.log('[MSW] %s %s', request.method, request.url);
  });
}
