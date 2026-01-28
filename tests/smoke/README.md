# Smoke Tests

Fast checks to validate critical app paths and availability.

---

## Quick Commands

```bash
npm run test:smoke                    # Run all smoke tests
npm test -- tests/smoke/ --headed     # Watch in browser
npm test -- tests/smoke/ --debug      # Debug mode
npm run test:fast                     # All @fast tagged tests
```

---

## Test Files

- 01-system-health.smoke.ts: Pre-flight API availability check before business logic tests.
- 02-auth.smoke.ts: User registration, login, and account deletion lifecycle.
- 04-cart.smoke.ts: Add-to-cart functionality on the critical revenue path.
- 05-discovery-search.smoke.ts: Product search returns valid results.

### Utilities

- smoke-dashboard.ts: Aggregates smoke results into a simple dashboard.
- smoke-hooks.ts: Common setup/teardown for smoke suite.
- smoke-trends.ts: Tracks historical smoke run metrics.
- smoke.utils.ts: Utility helpers for smoke flows.

See resilience/ for fault-injection smoke tests.
