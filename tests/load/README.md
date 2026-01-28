# Load Testing — Quick Guide

**Goal:** Validate system performance under realistic and peak loads using [k6](https://k6.io/).

---

## Quick Commands

```bash
# Build
npm run load:build            # Compile TypeScript → JavaScript

# Run Tests
npm run load:smoke            # 1 user, 10s (sanity check)
npm run load:api              # Progressive load test (realistic)
npm run load:e2e              # User journey simulation
npm run load:stress           # 100 users, 5m (breaking point)
npm run load:spike            # 0→100→0 rapid (surge handling)

# Watch Mode
npm run load:build:watch      # Auto-compile on changes

# View Results
open tests/load/results/      # JSON summaries
```

---

## Setup

```bash
# Install k6
brew install k6           # macOS
choco install k6          # Windows
# For Linux: https://k6.io/docs/get-started/installation/

npm install               # Dependencies
npm run load:build        # Compile tests (required)
```

---

## Test Coverage

| Test | Users | Duration | Purpose |
|------|-------|----------|---------|
| **smoke** | 1 | 10s | Sanity check |
| **api** | 1→100 | 5m30s | Realistic traffic |
| **e2e** | 10→50 | 7m | User journey |
| **stress** | 100 | 5m | Breaking point |
| **spike** | 0→100→0 | 1m20s | Surge handling |

---

## Key Metrics

- **http_req_duration** — Response time (P95, P99)
- **http_req_failed** — Error rate (%)
- **e2e_journey_duration** — Full flow completion time
- **vus_max** — Peak concurrent users hit

---

## Thresholds (Defaults)

```
API:  P95 < 500ms,  P99 < 1s,   errors < 5%
E2E:  P95 < 2s,     errors < 10%
```

Customize in `tests/load/config/load-profiles.ts`.

---

## Quick Wins

1. **Start small** — Use `load:smoke` first.
2. **Monitor resources** — Watch CPU/memory during runs.
3. **Data variety** — Use random inputs; avoid cache skew.
4. **Realism** — Include think time between requests.

---

## Troubleshoot

```bash
# Build failed?
rm -rf tests/load/compiled && npm run load:build

# High errors?
Check BASE_URL, reduce VUs, verify endpoint availability.
```

---

## CI Integration

Add to GitHub Actions:
```yaml
- name: Load Test
  run: npm run load:smoke
  env:
    BASE_URL: ${{ secrets.BASE_URL }}
```

---

## Further Reading

- [k6 Docs](https://k6.io/docs/)
- [Load Profiles](tests/load/config/load-profiles.ts)
- [Custom Metrics](tests/load/utils/load-helpers.ts)
