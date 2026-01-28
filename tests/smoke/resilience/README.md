# Smoke Resilience

---

## Quick Commands

```bash
npm run test:smoke                           # Run all smoke tests (includes resilience)
npm test -- tests/smoke/resilience/          # Run only resilience smoke tests
npm test -- tests/smoke/resilience/ --headed # Watch in browser
```

---

## Test Files

- TC-RES01_NetworkAbortRecovery.spec.ts: Validates graceful recovery when network requests are aborted.
- TC-RES02_SlowAPIResponse.spec.ts: Tests UI behavior with slow API responses (timeout handling).
- TC-RES03_ExponentialBackoff.spec.ts: Retries implement exponential backoff on repeated failures.
- TC-RES04_OfflineGracefulDegradation.spec.ts: Offline mode shows cached content or helpful fallback UX.
