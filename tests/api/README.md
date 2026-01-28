# API Tests

Short, high-signal checks of key API behaviors: response status, headers, schema, error handling, and security.

---

## Quick Commands

```bash
npm test -- tests/api/                # Run all API tests
npm test -- tests/api/ --headed       # Watch in browser
npm test -- tests/api/ --debug        # Debug mode
```

---

## Test Files

- TC-API01_ProductsList.spec.ts: Verifies products list endpoint returns expected structure, paging, and headers.
- TC-API02_BrandsList.spec.ts: Validates brands listing endpoint and data consistency.
- TC-API03_SearchProducts.spec.ts: Tests search by name including no-results and edge cases.
- TC-API04_ErrorHandling.spec.ts: Ensures proper status codes and error payloads for invalid requests.
- TC-API05_ApiSecurity.spec.ts: Spot-checks auth, rate limiting, and sensitive header policies.
- TC-API06_DataIntegrity.spec.ts: Confirms field types, required attributes, and cross-endpoint consistency.
- TC-API07_PerformanceSLOs.spec.ts: Validates API performance against P50/P95/P99 SLO thresholds.
- TC-API08_ApiMocking.spec.ts: Demonstrates MSW mocking for fast, deterministic offline testing.
- TC-API09_ContractValidation.spec.ts: Validates API responses against OpenAPI 3.0 specification.
