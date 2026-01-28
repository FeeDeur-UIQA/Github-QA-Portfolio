# Resilience Flows

---

## Quick Commands

```bash
npm test -- tests/flows/resilience/              # Run all resilience tests
npm test -- tests/flows/resilience/ --headed     # Watch in browser
npm test -- --grep "TC-RES"                       # Run by test ID pattern
```

---

## Test Files

- TC-RES05_CircuitBreaker.spec.ts: Validates graceful degradation when add-to-cart fails repeatedly.

> **Note:** Resilience smoke tests (TC-RES01-04) are located in `tests/smoke/resilience/`.
