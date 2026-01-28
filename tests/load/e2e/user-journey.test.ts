import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { SLOMetrics, buildThresholds, formatSLOReport } from '../utils/slo-metrics';

/**
 * TC-LOAD-E2E01: Complete User Journey Load Test
 *
 * Simulates realistic user behavior:
 * 1. Homepage visit
 * 2. Product browsing
 * 3. Product search
 * 4. View product details
 * 5. Add to cart
 */

// SLO tracking for end-to-end journey with longer timeouts
const journeyMetrics = new SLOMetrics('journey', {
  p50: 5000, // 5s for full journey P50
  p95: 10000, // 10s for full journey P95
  p99: 15000, // 15s for full journey P99
  errorRate: 0.05,
});

// Additional counters for journey tracking
const journeyCompletions = new Counter('journey_completions');
const journeyFailures = new Counter('journey_failures');

console.log(formatSLOReport('End-to-End User Journey', journeyMetrics.getSLOs()));

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Warm up
    { duration: '3m', target: 30 }, // Normal load
    { duration: '2m', target: 50 }, // Peak load
    { duration: '1m', target: 0 }, // Cool down
  ],
  thresholds: buildThresholds(journeyMetrics),
};

const BASE_URL = __ENV.BASE_URL || 'https://automationexercise.com';

export default function () {
  const startTime = Date.now();
  let journeySuccess = true;

  // Step 1: Visit Homepage
  group('Homepage Visit', function () {
    const homepage = http.get(BASE_URL, {
      tags: { name: 'Homepage' },
    });

    const homeCheck = check(homepage, {
      'homepage loaded': (r) => r.status === 200,
      'homepage has content': (r) => r.body.includes('Automation Exercise'),
    });

    if (!homeCheck) {
      journeySuccess = false;
      console.error('Homepage load failed');
    }

    sleep(1 + Math.random()); // User reads homepage
  });

  // Step 2: Browse Products Page
  group('Browse Products', function () {
    const productsPage = http.get(`${BASE_URL}/products`, {
      tags: { name: 'ProductsPage' },
    });

    check(productsPage, {
      'products page loaded': (r) => r.status === 200,
      'products displayed': (r) => r.body.includes('All Products'),
    });

    sleep(2 + Math.random() * 2); // User browses products
  });

  // Step 3: API - Get Products List
  group('API - Get Products', function () {
    const apiProducts = http.get(`${BASE_URL}/api/productsList`, {
      tags: { name: 'API_GetProducts' },
    });

    const apiCheck = check(apiProducts, {
      'API products returned': (r) => r.status === 200,
      'API has valid JSON': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.responseCode === 200;
        } catch {
          return false;
        }
      },
    });

    if (!apiCheck) journeySuccess = false;
  });

  // Step 4: Search for Product
  group('Search Products', function () {
    const searchTerms = ['tshirt', 'dress', 'jeans', 'top', 'shirt'];
    const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const searchResponse = http.post(
      `${BASE_URL}/api/searchProduct`,
      { search_product: searchTerm },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        tags: { name: 'API_SearchProducts' },
      },
    );

    const searchCheck = check(searchResponse, {
      'search successful': (r) => r.status === 200,
      'search has results': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.responseCode === 200;
        } catch {
          return false;
        }
      },
    });

    if (!searchCheck) journeySuccess = false;

    sleep(1.5 + Math.random()); // User reviews results
  });

  // Step 5: View Product Detail
  group('View Product Detail', function () {
    // Random product ID between 1-34
    const productId = Math.floor(Math.random() * 34) + 1;

    const productDetail = http.get(`${BASE_URL}/product_details/${productId}`, {
      tags: { name: 'ProductDetail' },
    });

    check(productDetail, {
      'product detail loaded': (r) => r.status === 200,
      'product info displayed': (r) =>
        r.body.includes('Product Details') || r.body.includes('product'),
    });

    sleep(2 + Math.random() * 3); // User reads product details
  });

  // Step 6: Add to Cart (simulation - requires auth)
  group('Add to Cart Attempt', function () {
    const cartResponse = http.get(`${BASE_URL}/view_cart`, {
      tags: { name: 'ViewCart' },
    });

    const cartCheck = check(cartResponse, {
      'cart page accessible': (r) => r.status === 200,
    });

    if (!cartCheck) journeySuccess = false;

    sleep(1); // User views cart
  });

  // Record journey metrics
  const journeyDuration = Date.now() - startTime;

  if (journeySuccess) {
    journeyMetrics.recordSuccess(journeyDuration);
    journeyCompletions.add(1);
  } else {
    journeyMetrics.recordFailure(journeyDuration);
    journeyFailures.add(1);
  }

  // End of journey think time
  sleep(2 + Math.random() * 3);
}

interface SummaryData {
  metrics: Record<string, any>;
}

export function handleSummary(data: SummaryData) {
  return {
    'tests/load/results/user-journey-summary.json': JSON.stringify(data, null, 2),
    stdout: createTextSummary(data),
  };
}

function createTextSummary(data: SummaryData) {
  const metrics = data.metrics;
  const slos = journeyMetrics.getSLOs();

  let summary = '\n  E2E User Journey Load Test Results\n';
  summary += '  ' + '='.repeat(60) + '\n\n';

  summary += '  SLO Performance:\n';
  summary += `    P50: ${(metrics.journey_duration?.values['p(50)'] || 0).toFixed(0)}ms (target: <${slos.p50}ms)\n`;
  summary += `    P95: ${(metrics.journey_duration?.values['p(95)'] || 0).toFixed(0)}ms (target: <${slos.p95}ms)\n`;
  summary += `    P99: ${(metrics.journey_duration?.values['p(99)'] || 0).toFixed(0)}ms (target: <${slos.p99}ms)\n`;
  summary += `    Error Rate: ${((metrics.journey_errors?.values.rate || 0) * 100).toFixed(2)}% (target: <${slos.errorRate * 100}%)\n\n`;

  summary += '  Journey Statistics:\n';
  summary += `    Completed: ${metrics.journey_completions?.values.count || 0}\n`;
  summary += `    Failed: ${metrics.journey_failures?.values.count || 0}\n`;
  summary += `    Success Rate: ${(((metrics.journey_completions?.values.count || 0) / ((metrics.journey_completions?.values.count || 0) + (metrics.journey_failures?.values.count || 1))) * 100).toFixed(2)}%\n\n`;

  summary += '  Journey Times:\n';
  summary += `    Average: ${(metrics.journey_duration?.values.avg || 0).toFixed(0)}ms\n`;
  summary += `    Min: ${(metrics.journey_duration?.values.min || 0).toFixed(0)}ms\n`;
  summary += `    Max: ${(metrics.journey_duration?.values.max || 0).toFixed(0)}ms\n\n`;

  summary += '  HTTP Performance:\n';
  summary += `    Total Requests: ${metrics.http_reqs?.values.count || 0}\n`;
  summary += `    Avg Response: ${(metrics.http_req_duration?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `    P95 Response: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms\n\n`;

  return summary;
}
