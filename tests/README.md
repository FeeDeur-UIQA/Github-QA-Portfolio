# Tests Overview

This directory contains end-to-end, API, and smoke tests organized by purpose. Use these READMEs to quickly understand what each suite covers.

---

## Quick Commands

```bash
npm test                  # Run all tests
npm run test:smoke        # Smoke only (~4 min)
npm run test:regression   # E2E + API (exclude smoke)
npm run test:quick        # Fast tests (~5 min)
npm run test:headed       # Watch in browser
```

**Parallel Execution**:

```bash
npm run test:parallel     # 4 workers (faster)
```

**Coverage**:

```bash
npm run test:coverage     # Full coverage report
npm run coverage:report   # Open HTML report
```

---

## Structure

- **api/**: API contract, error handling, security, and data integrity checks.
- **flows/**: End-to-end user journeys grouped by domain (auth, account, cart, etc.).
- **integration/**: Backend-mocked E2E flows for fast, deterministic testing.
- **smoke/**: Fast health checks for critical paths and resilience probes.
- **load/**: k6 load testing (performance under concurrent users).
- **unit/**: Unit tests for utilities and page object methods.

---

## Test Files

- TC-XX_LoggerDemo.spec.ts: Demonstrates structured logging usage in tests (levels, context, and attachments).
