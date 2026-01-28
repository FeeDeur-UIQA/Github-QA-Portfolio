/**
 * Load Test Configuration Profiles
 * 
 * Different load patterns for various testing scenarios:
 * - Smoke: Quick sanity check
 * - Load: Normal expected traffic
 * - Stress: Beyond normal capacity
 * - Spike: Sudden traffic surge
 * - Soak: Extended duration for stability
 */

export const LoadProfiles = {
  // Quick sanity check - minimal load
  smoke: {
    stages: [
      { duration: '10s', target: 1 },
      { duration: '30s', target: 1 },
    ],
    thresholds: {
      'http_req_duration': ['p(95)<500'],
      'http_req_failed': ['rate<0.01'],
    },
  },

  // Normal load - expected production traffic
  load: {
    stages: [
      { duration: '1m', target: 20 },    // Ramp up
      { duration: '3m', target: 20 },    // Steady state
      { duration: '1m', target: 50 },    // Peak hours
      { duration: '3m', target: 50 },    // Sustained peak
      { duration: '1m', target: 0 },     // Ramp down
    ],
    thresholds: {
      'http_req_duration': ['p(95)<800', 'p(99)<1500'],
      'http_req_failed': ['rate<0.05'],
    },
  },

  // Stress test - push beyond capacity
  stress: {
    stages: [
      { duration: '1m', target: 50 },    // Normal load
      { duration: '2m', target: 100 },   // Approaching limits
      { duration: '2m', target: 200 },   // Beyond capacity
      { duration: '2m', target: 300 },   // Way beyond
      { duration: '2m', target: 400 },   // Breaking point
      { duration: '2m', target: 0 },     // Recovery
    ],
    thresholds: {
      'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
      'http_req_failed': ['rate<0.20'], // Allow higher failure rate
    },
  },

  // Spike test - sudden traffic surge
  spike: {
    stages: [
      { duration: '30s', target: 10 },   // Normal traffic
      { duration: '10s', target: 200 },  // Sudden spike!
      { duration: '1m', target: 200 },   // Hold spike
      { duration: '10s', target: 10 },   // Drop back
      { duration: '30s', target: 10 },   // Normal again
      { duration: '10s', target: 0 },    // End
    ],
    thresholds: {
      'http_req_duration': ['p(95)<1500'],
      'http_req_failed': ['rate<0.10'],
    },
  },

  // Soak test - long duration for memory leaks, resource exhaustion
  soak: {
    stages: [
      { duration: '2m', target: 30 },    // Ramp up
      { duration: '20m', target: 30 },   // Stay for long duration
      { duration: '2m', target: 0 },     // Ramp down
    ],
    thresholds: {
      'http_req_duration': ['p(95)<1000'],
      'http_req_failed': ['rate<0.05'],
    },
  },

  // Breakpoint test - gradually increase until system breaks
  breakpoint: {
    stages: [
      { duration: '1m', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '1m', target: 150 },
      { duration: '1m', target: 200 },
      { duration: '1m', target: 250 },
      { duration: '1m', target: 300 },
      { duration: '1m', target: 350 },
      { duration: '1m', target: 400 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      'http_req_duration': ['p(99)<10000'],
      'http_req_failed': ['rate<0.50'],
    },
  },
};

// Performance SLI/SLO thresholds
export const PerformanceThresholds = {
  api: {
    responseTime: {
      p50: 200,   // 50% under 200ms
      p95: 500,   // 95% under 500ms
      p99: 1000,  // 99% under 1s
    },
    errorRate: 0.01, // 1% error budget
    availability: 99.9, // 99.9% uptime
  },
  
  web: {
    responseTime: {
      p50: 500,
      p95: 2000,
      p99: 3000,
    },
    errorRate: 0.05,
    availability: 99.5,
  },
  
  search: {
    responseTime: {
      p50: 300,
      p95: 700,
      p99: 1500,
    },
    errorRate: 0.05,
    availability: 99.0,
  },
};

// Virtual User behavior patterns
export const UserBehaviorPatterns = {
  // Quick visitors - bounce quickly
  bouncer: {
    thinkTime: { min: 0.5, max: 2 },
    sessionDuration: { min: 10, max: 30 },
  },
  
  // Normal shoppers - moderate browsing
  shopper: {
    thinkTime: { min: 2, max: 5 },
    sessionDuration: { min: 60, max: 300 },
  },
  
  // Detailed researchers - slow and thorough
  researcher: {
    thinkTime: { min: 5, max: 15 },
    sessionDuration: { min: 300, max: 900 },
  },
};
