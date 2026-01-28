# Auth Flows

This document provides a concise summary of the authentication flows implemented in the project.

---

## Quick Commands

```bash
npm test -- tests/flows/auth/                 # Run all auth tests
npm test -- tests/flows/auth/ --headed        # Watch in browser
npm test -- --grep "TC-05"                     # Run by test ID
```

---

## Test Files

- TC-05_NegativeRegistration.spec.ts: Validates rejected sign-ups with clear client/server validation messages.
