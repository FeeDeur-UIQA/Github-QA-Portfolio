# Integration Tests

Backend-mocked E2E flows for fast, deterministic testing.

---

## Quick Commands

```bash
npm test -- tests/integration/              # Run all integration tests
npm test -- tests/integration/ --headed     # Watch in browser
npm test -- --grep "INT"                    # Run by test ID pattern
```

---

## Test Files

- TC-INT01_ProductFlowMocked.spec.ts: Product browsing flow with MSW mocking for predictable data.
- TC-INT02_CartFlowMocked.spec.ts: Add-to-cart flow with mocked inventory and pricing.
- TC-INT03_AuthFlowMocked.spec.ts: Login/logout flow with mocked authentication backend.

---

## Why Integration Tests?

These tests bridge unit tests and full E2E:

- **Faster**: No network latency (MSW intercepts requests)
- **Deterministic**: Same mock data every run
- **Edge cases**: Simulate 500s, timeouts, rate limits
- **Offline capable**: Run without internet

See `tests/api/mocks/` for handler definitions.
