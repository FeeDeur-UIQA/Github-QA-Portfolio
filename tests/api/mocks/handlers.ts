/**
 * Mock API Handlers
 *
 * Provides Mock Service Worker (MSW) handlers for fast, offline API testing
 * Enables predictable test data and edge case simulation without network calls
 *
 * Usage:
 *   import { mockServer } from './mocks/server';
 *   mockServer.listen();
 */

import { http, HttpResponse } from 'msw';

// Mock data fixtures
const mockProducts = [
  {
    id: 1,
    name: 'Mock Blue Top',
    price: 'Rs. 500',
    brand: 'Polo',
    category: {
      usertype: { usertype: 'Women' },
      category: 'Tops',
    },
  },
  {
    id: 2,
    name: 'Mock Men Tshirt',
    price: 'Rs. 400',
    brand: 'H&M',
    category: {
      usertype: { usertype: 'Men' },
      category: 'Tshirts',
    },
  },
  {
    id: 3,
    name: 'Mock Dress',
    price: 'Rs. 999',
    brand: 'Madame',
    category: {
      usertype: { usertype: 'Women' },
      category: 'Dress',
    },
  },
];

const mockBrands = [
  { id: 1, brand: 'Polo' },
  { id: 2, brand: 'H&M' },
  { id: 3, brand: 'Madame' },
  { id: 4, brand: 'Mast & Harbour' },
];

/**
 * API Mock Handlers
 * Intercepts requests to /api/* and returns mock responses
 */
export const handlers = [
  // GET /api/productsList
  http.get('*/api/productsList', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page');
    const limit = url.searchParams.get('limit');

    console.log(`[MSW] Mocked GET /api/productsList (page: ${page}, limit: ${limit})`);

    return HttpResponse.json({
      responseCode: 200,
      products: mockProducts,
    });
  }),

  // GET /api/brandsList
  http.get('*/api/brandsList', () => {
    console.log('[MSW] Mocked GET /api/brandsList');

    return HttpResponse.json({
      responseCode: 200,
      brands: mockBrands,
    });
  }),

  // POST /api/searchProduct
  http.post('*/api/searchProduct', async ({ request }) => {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const searchTerm = params.get('search_product') || '';

    console.log(`[MSW] Mocked POST /api/searchProduct (search: "${searchTerm}")`);

    // Filter products by search term
    const filtered = mockProducts.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return HttpResponse.json({
      responseCode: 200,
      products: filtered,
    });
  }),

  // GET /api/nonexistent (404 simulation)
  http.get('*/api/nonexistent', () => {
    console.log('[MSW] Mocked GET /api/nonexistent (404)');

    return HttpResponse.json(
      {
        responseCode: 404,
        message: 'Not Found',
      },
      { status: 404 },
    );
  }),
];

/**
 * Error Scenario Handlers
 * Used for testing error handling and retry logic
 */
export const errorHandlers = {
  // Simulate 500 Internal Server Error
  serverError: http.get('*/api/productsList', () => {
    console.log('[MSW] Mocked 500 Server Error');
    return HttpResponse.json(
      { responseCode: 500, message: 'Internal Server Error' },
      { status: 500 },
    );
  }),

  // Simulate 429 Rate Limit
  rateLimit: http.get('*/api/productsList', () => {
    console.log('[MSW] Mocked 429 Rate Limit');
    return HttpResponse.json(
      { responseCode: 429, message: 'Too Many Requests' },
      {
        status: 429,
        headers: { 'Retry-After': '5' },
      },
    );
  }),

  // Simulate timeout (delayed response)
  timeout: http.get('*/api/productsList', async () => {
    console.log('[MSW] Mocked Timeout (10s delay)');
    await new Promise((resolve) => setTimeout(resolve, 10000));
    return HttpResponse.json({ responseCode: 200, products: mockProducts });
  }),

  // Simulate network error
  networkError: http.get('*/api/productsList', () => {
    console.log('[MSW] Mocked Network Error');
    return HttpResponse.error();
  }),
};
