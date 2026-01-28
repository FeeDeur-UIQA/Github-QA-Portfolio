# Performance Flows

---

## Quick Commands

```bash
npm test -- tests/flows/performance/             # Run all performance tests
npm test -- tests/flows/performance/ --headed    # Watch in browser
npm run perf:local                               # Lighthouse audit locally
```

---

## Test Files

- TC-PERF01_LCPValidation.spec.ts: Validates Largest Contentful Paint stays under 2.5s threshold.
- TC-PERF02_FIDMeasurement.spec.ts: Measures First Input Delay on add-to-cart interaction (<100ms).
- TC-PERF03_CLSValidation.spec.ts: Ensures layout stability stays within CLS budget.
