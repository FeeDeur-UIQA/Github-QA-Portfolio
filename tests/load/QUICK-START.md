# Load Testing - Quick Start Guide

## What Is This?

Load testing validates that your application performs well under expected and peak traffic conditions. This suite uses **k6** - a widely-used, developer-friendly load testing tool.

## Quick Start (5 Minutes)

### Install k6

```bash
# macOS
brew install k6

# Verify installation
k6 version
```

### Build Tests

```bash
npm run load:build
```

### Run Your First Load Test

```bash
# Quick smoke test (takes 10 seconds)
npm run load:smoke
```

**Expected Output:**

```
✓ status is 200
✓ response has products
✓ response time < 1000ms

checks.........................: 100.00%
http_req_duration..............: avg=245ms p(95)=350ms p(99)=450ms
http_reqs......................: 10
```

## 🎨 Available Tests

### API Tests

```bash
# Products API - Tests /api/productsList
npm run load:api
# Duration: ~5 minutes | Load: 10→100 users

# Search API - Tests /api/searchProduct
k6 run tests/load/compiled/search-load.test.js
# Duration: ~4 minutes | Load: 20→100 users
```

### E2E Tests

```bash
# Complete User Journey
npm run load:e2e
# Duration: ~7 minutes | Simulates: Homepage → Browse → Search → Details → Cart
```

### Load Profiles

```bash
# Smoke (Sanity Check)
npm run load:smoke
# 1 user, 10 seconds

# Stress (Find Breaking Point)
npm run load:stress
# 100 users, 5 minutes

# Spike (Traffic Surge)
npm run load:spike
# 10→200→10 users, simulates Black Friday
```

---

## Understanding Results

### Good Results ✅

```
✓ http_req_duration............: avg=245ms p(95)=480ms p(99)=890ms
✓ http_req_failed..............: 0.50%
✓ http_reqs....................: 5000 (83.33/s)
```

- P95 under 500ms ✅
- Error rate under 1% ✅
- High throughput ✅

### Bad Results ❌

```
✗ http_req_duration............: avg=2500ms p(95)=5000ms
✗ http_req_failed..............: 15.00%
```

- High latency (>1s) ❌
- High error rate (>5%) ❌

## 🎓 What Each Test Does

### TC-LOAD-API01: Products List

**Tests**: `/api/productsList` endpoint  
**Validates**:

- Response time stays under 500ms (95th percentile)
- Error rate below 1%
- Handles 100 concurrent users
- JSON structure is valid

**When to Run**: After API changes, before deployment

---

### TC-LOAD-API02: Search Products

**Tests**: `/api/searchProduct` endpoint  
**Validates**:

- Search performance under load
- Handles multiple simultaneous searches
- Results are relevant
- Empty results handled gracefully

**When to Run**: After search algorithm changes

---

### TC-LOAD-E2E01: User Journey

**Tests**: Complete shopping flow  
**Validates**:

- Full journey completes in <15 seconds
- Each step (homepage, browse, search, cart) works under load
- Realistic user behavior patterns
- Journey completion rate >95%

**When to Run**: Before major releases, weekly regression

## 🔧 Troubleshooting

### "k6: command not found"

```bash
# Install k6 first
brew install k6  # macOS
```

### "Cannot find compiled tests"

```bash
# Build tests first
npm run load:build
```

### High error rates (>10%)

1. Check if site is accessible: `curl https://automationexercise.com`
2. Reduce virtual users: `k6 run --vus 10 ...`
3. Check network connection

### Tests timing out

```bash
# Increase timeout in test file (e.g., products-load.test.ts)
thresholds: {
  'http_req_duration': ['p(95)<2000'],  // Increase from 500ms
}
```

## 📈 Integration with Existing Tests

| Test Type      | When to Run  | Duration | Purpose                |
| -------------- | ------------ | -------- | ---------------------- |
| **Load Tests** | Pre-deploy   | 5-10 min | Performance validation |
| Playwright E2E | Every PR     | 5-15 min | Functional validation  |
| API Tests      | Every commit | 1-2 min  | Contract validation    |
| Visual Tests   | Daily        | 10 min   | UI regression          |

## Success Criteria

### API Endpoints

- ✅ P95 response time: < 500ms
- ✅ P99 response time: < 1000ms
- ✅ Error rate: < 1%
- ✅ Throughput: > 50 req/s

### E2E Journeys

- ✅ Journey duration: < 15s (P95)
- ✅ Success rate: > 95%
- ✅ Step errors: < 2% each

## Advanced Usage

### Custom Load Pattern

```bash
k6 run \
  --stage 1m:10,5m:50,1m:0 \
  tests/load/compiled/products-load.test.js
```

### Environment Variables

```bash
BASE_URL=https://staging.example.com npm run load:api
```

### Save Results to File

```bash
k6 run --out json=results.json tests/load/compiled/products-load.test.js
```

### Run All Tests (CI/CD)

```bash
# Interactive menu
./tests/load/run-load-tests.sh

# Select option 7 for all tests
```

## 📚 Learn More

- **Full Documentation**: [tests/load/README.md](README.md)
- **Implementation Details**: [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md)
- **k6 Docs**: https://k6.io/docs/

## 🆘 Need Help?

1. Check [README.md](README.md) for detailed docs
2. Review test files in `tests/load/api/` and `tests/load/e2e/`
3. Check existing Playwright tests for context
4. k6 community: https://community.k6.io/

---

**Next Steps:**

1. ✅ Install k6: `brew install k6`
2. ✅ Build tests: `npm run load:build`
3. ✅ Run smoke test: `npm run load:smoke`
4. ✅ Review results and establish baselines
5. Add to CI/CD pipeline
