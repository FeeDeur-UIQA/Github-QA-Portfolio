# Flow Suites

End-to-end user journeys grouped by domain. See subfolders for detailed per-test summaries.

---

## Quick Commands

```bash
npm test                      # Run all flows
npm run test:regression       # Exclude smoke tests
npm run test:quick            # Fast & medium tests only (~5 min)
npm run test:headed           # Watch tests in browser
```

**Run by Domain**:
```bash
npm test -- tests/flows/auth/        # Auth flows
npm test -- tests/flows/cart/        # Cart flows
npm test -- tests/flows/catalog/     # Product flows
npm test -- tests/flows/accessibility/  # A11y checks
```

---

## Domains

- **accessibility/**: A11y checks (keyboard, ARIA, focus, contrast).
- **account/**: Account management flows.
- **auth/**: Authentication and registration flows.
- **cart/**: Cart operations and pricing logic.
- **catalog/**: Product discovery and detail synchronization.
- **performance/**: Core Web Vitals budgets on key pages.
- **resilience/**: Graceful degradation and recovery patterns.
- **security/**: Client-side security guardrails in UI workflows.
- **visual/**: Visual regression checks across key views and breakpoints.