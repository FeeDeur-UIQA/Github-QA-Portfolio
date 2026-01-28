# Security Flows

---

## Quick Commands

```bash
npm test -- tests/flows/security/            # Run all security tests
npm test -- tests/flows/security/ --headed   # Watch in browser
npm test -- --grep "TC-SEC"                   # Run by test ID pattern
npm run security:check                        # Local security audit
```

---

## Test Files

- TC-SEC01_XSSInjection.spec.ts: Verifies search field sanitizes XSS payloads.
- TC-SEC02_SQLInjection.spec.ts: Tests login form rejects SQL injection attempts.
- TC-SEC03_CSRFTokenValidation.spec.ts: Requires valid CSRF token for state-changing actions.
- TC-SEC04_DataExposure.spec.ts: Prevents sensitive data exposure in responses or UI.
- TC-SEC05_SecurityHeaders.spec.ts: Validates CSP, HSTS, X-Frame-Options, and other security headers.
- TC-SEC06_APIAuthorization.spec.ts: Tests BOLA protection and parameter pollution handling.
- TC-SEC07_APIInputValidation.spec.ts: Validates API handles malformed JSON and XSS payloads.
- TC-SEC08_MassAssignment.spec.ts: Tests protection against mass assignment attacks.
- TC-SEC09_RateLimiting.spec.ts: Validates API handles rapid and concurrent requests.
- TC-SEC10_InjectionFlaws.spec.ts: Tests SQL, NoSQL, and command injection prevention.
- TC-SEC11_FileUploadSecurity.spec.ts: Validates file upload endpoint rejects malicious files.
- TC-SEC12_CORSMisconfiguration.spec.ts: Tests CORS headers for cross-origin request handling.
- TC-SEC13_UnsafeDeserialization.spec.ts: Validates API handles serialized object attacks.
- TC-SEC14_SecurityLogging.spec.ts: Tests security event logging for failed auth attempts.
- TC-SEC15_APIVersioning.spec.ts: Validates API version handling and deprecation management.
