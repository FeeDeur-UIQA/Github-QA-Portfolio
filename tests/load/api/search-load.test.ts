import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { SLOMetrics, buildThresholds, formatSLOReport } from '../utils/slo-metrics';

/**
 * TC-LOAD-API02: Search Products API Load Test
 *
 * Tests search endpoint performance with concurrent users
 * performing various product searches.
 */

// SLO tracking for search operations
const searchMetrics = new SLOMetrics('search', {
  p50: 250,
  p95: 700,
  p99: 1200,
  errorRate: 0.01,
});

const emptyResults = new Counter('empty_search_results');

console.log(formatSLOReport('Product Search API', searchMetrics.getSLOs()));

export const options = {
  stages: [
    { duration: '20s', target: 20 }, // Ramp to 20 users
    { duration: '1m', target: 50 }, // Scale to 50 searches
    { duration: '2m', target: 50 }, // Sustained load
    { duration: '20s', target: 100 }, // Spike test
    { duration: '30s', target: 0 }, // Cool down
  ],
  thresholds: buildThresholds(searchMetrics),
};

const BASE_URL = __ENV.BASE_URL || 'https://automationexercise.com';

// Search terms pool for realistic load
const searchTerms = [
  'tshirt',
  'dress',
  'jeans',
  'shirt',
  'top',
  'saree',
  'blue',
  'men',
  'women',
  'kids',
  'fancy',
  'casual',
];

export default function () {
  // Pick a random search term
  const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];

  const payload = { search_product: searchTerm };

  const searchResponse = http.post(`${BASE_URL}/api/searchProduct`, payload, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    tags: { name: 'SearchProducts' },
  });

  const duration = searchResponse.timings.duration;

  const checkResult = check(searchResponse, {
    'search returns 200': (r) => r.status === 200,
    'valid response format': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.responseCode === 200;
      } catch {
        return false;
      }
    },
  });

  // Track with SLO metrics
  if (checkResult) {
    searchMetrics.recordSuccess(duration);

    // Validate results
    try {
      const data = JSON.parse(searchResponse.body);

      if (!data.products || data.products.length === 0) {
        emptyResults.add(1);
      }

      check(data, {
        'has products array': (d) => Array.isArray(d.products),
        'results match search': (d) => {
          if (d.products.length === 0) return true;
          const firstProduct = d.products[0];
          const text =
            `${firstProduct.name} ${firstProduct.category?.category || ''}`.toLowerCase();
          return text.includes(searchTerm.toLowerCase());
        },
      });
    } catch (error) {
      console.error(`Parse error for "${searchTerm}":`, error);
      searchMetrics.recordFailure();
    }
  } else {
    searchMetrics.recordFailure(duration);
  }

  // User thinks between searches
  sleep(0.5 + Math.random() * 1.5);
}

interface SummaryData {
  metrics: Record<string, any>;
}

export function handleSummary(data: SummaryData) {
  return {
    'tests/load/results/search-load-summary.json': JSON.stringify(data, null, 2),
    stdout: createTextSummary(data),
  };
}

function createTextSummary(data: SummaryData) {
  const metrics = data.metrics;
  const slos = searchMetrics.getSLOs();

  let summary = '\n  Search Load Test Results\n';
  summary += '  ' + '='.repeat(60) + '\n\n';

  summary += '  SLO Performance:\n';
  summary += `    P50: ${(metrics.search_duration?.values['p(50)'] || 0).toFixed(2)}ms (target: <${slos.p50}ms)\n`;
  summary += `    P95: ${(metrics.search_duration?.values['p(95)'] || 0).toFixed(2)}ms (target: <${slos.p95}ms)\n`;
  summary += `    P99: ${(metrics.search_duration?.values['p(99)'] || 0).toFixed(2)}ms (target: <${slos.p99}ms)\n`;
  summary += `    Error Rate: ${((metrics.search_errors?.values.rate || 0) * 100).toFixed(2)}% (target: <${slos.errorRate * 100}%)\n\n`;

  summary += '  Search Statistics:\n';
  summary += `    Total: ${metrics.http_reqs?.values.count || 0}\n`;
  summary += `    Successful: ${metrics.search_successful?.values.count || 0}\n`;
  summary += `    Failed: ${metrics.search_failed?.values.count || 0}\n`;
  summary += `    Empty Results: ${metrics.empty_search_results?.values.count || 0}\n\n`;

  summary += '  Response Times:\n';
  summary += `    Average: ${(metrics.search_duration?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `    Min: ${(metrics.search_duration?.values.min || 0).toFixed(2)}ms\n`;
  summary += `    Max: ${(metrics.search_duration?.values.max || 0).toFixed(2)}ms\n\n`;

  return summary;
}
