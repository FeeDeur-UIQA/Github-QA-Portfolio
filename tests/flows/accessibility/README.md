# Accessibility Flows

Quick A11y validations focused on usable, perceivable, and operable UI.

---

## Quick Commands

```bash
npm test -- tests/flows/accessibility/           # Run all A11y tests
npm test -- tests/flows/accessibility/ --headed  # Watch in browser
npm test -- --grep "TC-A0"                        # Run by test ID pattern
```

---

## Test Files

- TC-A01_LoginKeyboardNav.spec.ts: Keyboard-only navigation and logical focus order on login.
- TC-A02_SearchARIALabels.spec.ts: Required ARIA labels for search inputs and controls.
- TC-A03_CartAnnouncements.spec.ts: Live-region announcements for cart updates (polite/assertive).
- TC-A04_ErrorMessageAccess.spec.ts: Screen-reader accessible error messages and associations.
- TC-A05_ModalFocusManagement.spec.ts: Modal focus trapping and restoration on close.
- TC-A06_ColorContrastValidation.spec.ts: Color contrast meets WCAG AA thresholds.
- TC-A07_AxeCoreAutomated.spec.ts: Automated WCAG 2.2 AA scanning using axe-core across key pages.
- TC-A08_FocusNotObscured.spec.ts: Focus not hidden by overlays (WCAG 2.4.11).
- TC-A09_FocusAppearance.spec.ts: Focus indicators have sufficient contrast (WCAG 2.4.13).
- TC-A10_TargetSize.spec.ts: Interactive elements meet 24x24px minimum target size (WCAG 2.5.8).
- TC-A11_PageStructure.spec.ts: Semantic HTML structure with proper headings and landmarks.
- TC-A12_FormAccessibility.spec.ts: Form labels, instructions, and error handling (WCAG 3.3.2).
- TC-A13_ConsistentDesign.spec.ts: Consistent navigation and layout across pages (WCAG 3.2.4).
