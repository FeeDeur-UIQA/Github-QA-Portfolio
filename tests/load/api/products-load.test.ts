import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  SLOMetrics,
  DEFAULT_API_SLOS,
  buildThresholds,
  classifyPerformance,
  formatSLOReport,
} from '../utils/slo-metrics';

/**
 * TC-LOAD-API01: Products List API Load Test
 *
 * Tests the products listing endpoint under various load conditions
 * using defined SLO targets for response times and error rates.
 */

// SLO-based metrics tracking
const productListMetrics = new SLOMetrics('products_list', DEFAULT_API_SLOS);
const productDetailMetrics = new SLOMetrics('product_detail', DEFAULT_API_SLOS);

console.log(formatSLOReport('Products List API', DEFAULT_API_SLOS));

// Load test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Warm up
    { duration: '1m', target: 50 }, // Ramp to normal load
    { duration: '2m', target: 50 }, // Sustain normal load
    { duration: '30s', target: 100 }, // Spike test
    { duration: '1m', target: 100 }, // Sustain spike
    { duration: '30s', target: 0 }, // Cool down
  ],
  thresholds: buildThresholds(productListMetrics, productDetailMetrics),
  ext: {
    loadimpact: {
      projectID: 0,
      name: 'Products List API Load Test',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://automationexercise.com';

export default function () {
  // Test products list endpoint
  const productsResponse = http.get(`${BASE_URL}/api/productsList`, {
    tags: { name: 'GetProductsList' },
  });

  const duration = productsResponse.timings.duration;
  classifyPerformance(duration, DEFAULT_API_SLOS);

  const checkResult = check(productsResponse, {
    'status is 200': (r) => r.status === 200,
    'response has products': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.responseCode === 200 && Array.isArray(data.products);
      } catch {
        return false;
      }
    },
    'response time acceptable': (r) => r.timings.duration < DEFAULT_API_SLOS.p99,
  });

  // Record metrics based on success/failure
  if (checkResult) {
    productListMetrics.recordSuccess(duration);
  } else {
    productListMetrics.recordFailure(duration);
  }

  // Detailed validation when successful
  if (productsResponse.status === 200) {
    try {
      const data = JSON.parse(productsResponse.body);

      check(data, {
        'products array not empty': (d) => d.products && d.products.length > 0,
        'product has required fields': (d) => {
          const product = d.products[0];
          return product?.id && product?.name && product?.price;
        },
      });
    } catch (error) {
      console.error('Failed to parse response:', error);
      productListMetrics.recordFailure();
    }
  }

  // Realistic user behavior - pause between requests
  sleep(1 + Math.random() * 2);
}

interface SummaryData {
  metrics: Record<string, any>;
}

interface TextSummaryOptions {
  indent?: string;
  enableColors?: boolean;
}

export function handleSummary(data: SummaryData) {
  return {
    'tests/load/results/products-load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data: SummaryData, options: TextSummaryOptions = {}) {
  const indent = options.indent || '';
  const metrics = data.metrics;

  let summary = `\n${indent}Load Test Results\n`;
  summary += `${indent}${'='.repeat(60)}\n\n`;

  // SLO Performance
  summary += `${indent}SLO Performance:\n`;
  summary += `${indent}  Products List P50: ${metrics.products_list_duration?.values['p(50)']?.toFixed(2) || 'N/A'}ms (target: <${DEFAULT_API_SLOS.p50}ms)\n`;
  summary += `${indent}  Products List P95: ${metrics.products_list_duration?.values['p(95)']?.toFixed(2) || 'N/A'}ms (target: <${DEFAULT_API_SLOS.p95}ms)\n`;
  summary += `${indent}  Products List P99: ${metrics.products_list_duration?.values['p(99)']?.toFixed(2) || 'N/A'}ms (target: <${DEFAULT_API_SLOS.p99}ms)\n`;
  summary += `${indent}  Error Rate: ${((metrics.products_list_errors?.values.rate || 0) * 100).toFixed(2)}% (target: <${DEFAULT_API_SLOS.errorRate * 100}%)\n\n`;

  // Request stats
  summary += `${indent}Request Statistics:\n`;
  summary += `${indent}  Total Requests: ${metrics.http_reqs?.values.count || 0}\n`;
  summary += `${indent}  Successful: ${metrics.products_list_successful?.values.count || 0}\n`;
  summary += `${indent}  Failed: ${metrics.products_list_failed?.values.count || 0}\n`;
  summary += `${indent}  Peak VUs: ${metrics.vus_max?.values.max || 0}\n\n`;

  // Overall HTTP metrics
  summary += `${indent}HTTP Performance:\n`;
  summary += `${indent}  Avg Response Time: ${metrics.http_req_duration?.values.avg?.toFixed(2) || 'N/A'}ms\n`;
  summary += `${indent}  Min Response Time: ${metrics.http_req_duration?.values.min?.toFixed(2) || 'N/A'}ms\n`;
  summary += `${indent}  Max Response Time: ${metrics.http_req_duration?.values.max?.toFixed(2) || 'N/A'}ms\n`;

  return summary;
}
