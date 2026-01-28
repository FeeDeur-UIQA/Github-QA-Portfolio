# QA Automation Portfolio – Production‑Oriented, Experience‑Driven

[![Playwright Tests](https://github.com/FeeDeur-UIQA/Github-QA-Portfolio/actions/workflows/playwright.yml/badge.svg)](https://github.com/FeeDeur-UIQA/Github-QA-Portfolio/actions/workflows/playwright.yml)
[![Smoke Tests](https://github.com/FeeDeur-UIQA/Github-QA-Portfolio/actions/workflows/smoke-tests.yml/badge.svg)](https://github.com/FeeDeur-UIQA/Github-QA-Portfolio/actions/workflows/smoke-tests.yml)
[![Security Audit](https://github.com/FeeDeur-UIQA/Github-QA-Portfolio/actions/workflows/security-audit.yml/badge.svg)](https://github.com/FeeDeur-UIQA/Github-QA-Portfolio/actions/workflows/security-audit.yml)
[![Flake Rate](https://img.shields.io/badge/flake%20rate-%3C2%25-brightgreen)](./FLAKE-REPORT.md)

> **Author’s note**
> This repository started as a simple Playwright learning project. Over time, I kept running into the same problems I’ve seen on real teams: flaky UI tests, slow pipelines, unclear failures, and little confidence in CI results. Instead of adding more tests, I focused on solving those problems first.
>
> The framework you see here reflects how I think about QA automation in practice — including trade‑offs, constraints, and decisions that may differ depending on team size and maturity.

---

## What This Project Is (and Isn’t)

**This _is_:**

- A realistic QA automation framework built around common pain points
- A demonstration of how I design for reliability, observability, and CI speed
- A portfolio project meant to show how I think, not what tools I know

**This is not:**

- A drop-in framework every team should adopt wholesale
- A claim that all metrics here reflect live production traffic
- An argument that more tests automatically mean better quality

Some solutions here are intentionally “heavier” than what small teams need — that’s part of the discussion I expect to have in interviews.

---

## Project Overview

This repository contains a Playwright‑based QA framework tested against **automationexercise.com**. It focuses on reducing flakiness, improving CI feedback speed, and making failures easy to diagnose.

**High‑level characteristics:**

- **66 automated test specs** across 7 test categories
- **7 test categories**: API, Accessibility, Security, Performance, Visual, Integration, E2E Functional
- **6 browser configurations**: Chromium, Firefox, WebKit, Mobile Chrome/Safari, Edge
- **~15 minutes for full regression** when sharded across workers
- **~4 minutes for smoke suite** (@critical + @smoke tags)
- **Multi-layered quality**: WCAG 2.2, OWASP Top 10, Core Web Vitals, Chaos Engineering

CI/CD workflows publish HTML reports and dashboards to GitHub Pages for visibility.

---

## Why I Built It This Way

In many teams I’ve worked with or observed, test automation failed not because of missing coverage, but because:

- Tests failed intermittently and were ignored
- CI pipelines took too long to be useful
- Failures lacked context, screenshots, or logs
- Accessibility and security checks were manual or skipped

This project is my attempt to address those issues systematically.

---

## Key Focus Areas

### Reliability Over Raw Coverage

- Stable locators (ARIA‑first)
- Defensive interaction strategies (3-tier click fallback)
- Clear failure diagnostics with screenshots, videos, traces

### Fast CI Feedback

- Smoke tests run on PRs (~4min)
- Full regression parallelized and sharded (~15min)
- Intentionally avoid slow or redundant tests

### Built‑In Quality Signals

- Accessibility: WCAG checks (keyboard nav, ARIA roles, focus)
- Security: OWASP patterns (XSS, SQLi, CSRF validation)
- Performance: Core Web Vitals budgets (LCP, CLS)

---

## By the Numbers (Context Matters)

| Area          | What’s Covered        | Notes                                      |
| ------------- | --------------------- | ------------------------------------------ |
| Accessibility | 13 specs × 6 browsers | Keyboard nav, ARIA roles, focus, axe-core  |
| Security      | 15 specs total        | OWASP Top 10: XSS, SQLi, CSRF, headers     |
| API Testing   | 9 specs               | Contract, mocking, SLOs, error handling    |
| Integration   | 3 specs               | Mocked backend flows (MSW/route intercept) |
| Performance   | 3 specs               | LCP, CLS, FID - Core Web Vitals budgets    |
| Visual        | 5 specs               | Cross-browser screenshot regression        |
| Load Testing  | 3 suites (k6)         | API & E2E under concurrent traffic         |
| Flakiness     | **<2% in CI**         | [View Flake Report](./FLAKE-REPORT.md)     |

**What this tells you:**

- Coverage follows real priorities — not chasing 80% line coverage that nobody reads
- Flakiness metric matters more than test count — broken tests erode team trust faster than gaps in coverage
- Load tests are intentional smoke checks, not production-grade stress testing

---

## Getting Started Locally

```bash
git clone https://github.com/FeeDeur-UIQA/Github-QA-Portfolio.git
cd Github-QA-Portfolio
npm install && npx playwright install
npx playwright test --headed
```

**Requirements:** Node.js 18+, Git

**No setup secrets needed** — test credentials have defaults (`test.user@automation.test` / `SecurePassword123!`). Override in `.env.local` for CI/CD via GitHub Secrets.

After execution:

- HTML report is generated at `playwright-report/index.html`
- CI‑published reports are available via GitHub Pages (if enabled)

---

## When Tests Fail

Every failed test captures:

- **Screenshot** - Page state at failure
- **Video** - Full execution on retry
- **Trace** - Browser network, DOM, JS timeline
- **Logs** - Structured JSON with timestamps

Debugging without this context is noise.

---

## Test Execution Commands

```bash
npx playwright test                 # Full suite
npx playwright test --grep @smoke   # Critical path only
npx playwright test --grep @api     # API tests
npx playwright test --grep @accessibility
npx playwright test --ui            # Interactive debugging
```

---

## Architecture (High Level)

I use a **BasePage pattern** with defensive interaction logic. This was added after repeated CI failures caused by overlays, timing issues, and minor UI shifts.

**Key design choices:**

- **Locators**: Prefer ARIA roles and accessibility attributes over brittle CSS selectors
- **Interactions**: 3-tier fallback for clicks (normal → force → JavaScript) handles overlay interference
- **Fixtures**: Separate fixtures for different test types (page objects, API, accessibility, visual) — see `.github/copilot-instructions.md` for guidance

**Why this matters:**
Tests that fail intermittently destroy team trust. These patterns reduce flakiness from typical ~15% to <2% in CI.

See `documentation/ARCHITECTURE.md` for deeper context.

---

## Specialized Testing

**Accessibility**: Keyboard navigation, focus order, ARIA labels, color contrast - early detection of common regressions.

**Security**: XSS/SQLi checks, CSRF token validation, API auth - automated regression detection, not penetration testing replacement.

**Performance**: LCP and CLS budgets enforced in CI - keeps performance discussions objective.

**Load Testing (k6)**: API and E2E under concurrent traffic with smoke, load, stress, and spike profiles. See [tests/load/README.md](tests/load/README.md).

**API Testing**: Typed client abstraction with retry logic and structured responses - maintainability and signal quality over endpoint count.

---

## CI/CD

GitHub Actions handles smoke tests on PRs, full regression on main, security audits, static analysis, and Lighthouse performance checks. Parallel execution and sharding reduce feedback time.

---

## Repository Structure

```
src/
  pages/        # Page objects and BasePage
  support/      # API clients, factories
  utils/        # Logging, configuration

tests/
  api/          # API contract & security tests (TC-API01–06)
  smoke/
    resilience/ # Network abort, slow API, backoff, offline (TC-RES01–04)
  flows/
    accessibility/  # WCAG 2.2 tests (TC-A01–06)
    security/       # XSS, SQL injection, CSRF, data exposure (TC-SEC01–04)
    performance/    # Core Web Vitals: LCP, FID, CLS (TC-PERF01–03)
    visual/         # Visual regression & responsive design (TC-VIS01–05)
    resilience/     # Circuit breaker pattern (TC-RES05)
    auth/           # Login, signup, negative flows (TC-01–05)
    cart/           # Shopping cart workflows (TC-12)
    account/        # Account deletion & cleanup (TC-17)
    catalog/        # Product browsing & sync (TC-08)
  load/         # k6 load/stress/spike tests

fixtures/       # Custom Playwright fixtures
  page.fixtures.ts
  api-fixtures.ts
  accessibility.fixtures.ts
  visual.fixtures.ts
  smoke.fixtures.ts

infrastructure/
  docker/
  Playwright.dockerfile

documentation/
  ARCHITECTURE.md
  Hiring-Manager-Guide.md
```

---

## Trade‑Offs and Limitations

- Some patterns here are overkill for small teams
- UI‑based security testing is limited by nature
- Maintenance cost increases with cross‑browser depth

These are deliberate choices and discussion points, not hidden drawbacks.

---

## What I’d Improve Next

If I were to continue evolving this project:

- Add contract testing (e.g., Pact)
- Improve API mocking strategy
- Reduce overlapping coverage between smoke and full suites
- Add trend‑based reporting instead of static reports\* ~~Add load/stress testing~~ ✅ **Done (k6 implementation)**

---

## Why This Repo Exists

This repository is not about showing off tools.

It’s about demonstrating:

- How I reason about QA problems — starting with _why_ tests fail, not _how many_ to write
- How I balance speed, reliability, and coverage — acknowledging that 34 stable tests beat 200 flaky ones
- How I design automation that teams can trust — with diagnostics, clear failures, and honest limitations

The specific pain point: **Most test automation projects fail not because QA engineers don't know the tools. They fail because tests become noise** — failing randomly, taking forever to run, impossible to debug, consuming time without building confidence.

This framework is built to avoid that.

---

## Questions or Discussion

If you're reviewing this as a hiring manager and want to understand _why_ something was done a certain way, I'm available to discuss the decisions and trade‑offs in detail.
