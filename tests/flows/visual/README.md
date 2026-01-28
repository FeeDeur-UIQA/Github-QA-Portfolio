# Visual Flows

---

## Quick Commands

```bash
npm run visual:run                    # Run visual tests (chromium)
npm run visual:run:all-browsers       # Chrome, Firefox, Safari
npm run visual:update                 # Update baselines
npm run visual:detect-flakes --runs 5 # Check for flakes
```

---

## Test Files

- TC-VIS01_HomepageLayout.spec.ts: Homepage visual consistency across browsers and viewports.
- TC-VIS02_ProductGrid.spec.ts: Product listing page and card layout visual regression.
- TC-VIS03_CartCheckout.spec.ts: Snapshots for cart and checkout key states.
- TC-VIS04_ResponsiveDesign.spec.ts: Responsive layout across common breakpoints.
- TC-VIS05_Forms.spec.ts: Visual consistency of form states and validation.
