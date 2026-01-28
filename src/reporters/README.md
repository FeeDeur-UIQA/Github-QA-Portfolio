# Jira Reporter Integration

> **Note:** The Jira Reporter implementation is located at [`src/utils/JiraReporter.ts`](../utils/JiraReporter.ts).  
> This README provides usage documentation and best practices.

Automated Jira issue creation and management based on test failures.

---

## Quick Start

### 1. Environment Setup

Add to `.env.local` or CI secrets:

```bash
# Required
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_USER_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=QA
```

### 2. Playwright Config (Already Configured)

The reporter is already configured in `playwright.config.ts`:

```typescript
// playwright.config.ts
reporter: [
  ['html'],
  ['./src/utils/JiraReporter.ts'],  // Located in src/utils/
],
```

### 3. Run Tests

```bash
# Local (dry run - generates local report only)
npx playwright test

# CI (creates issues when enabled)
JIRA_REPORTER_ENABLED=true npx playwright test
```

---

## Features

### Automatic Bug Creation

- Creates Jira issues on test failure
- Skips flaky tests (configurable threshold)
- Deduplicates via fingerprinting

### Rich Bug Reports Include

| Field       | Source                         |
| ----------- | ------------------------------ |
| Summary     | Test name + error type         |
| Environment | Browser, viewport, base URL    |
| Steps       | From `test.step()` annotations |
| Error       | Assertion/timeout message      |
| Stack Trace | Collapsible section            |
| Screenshots | Auto-attached                  |
| Video       | Auto-attached (on retry)       |
| Trace       | Auto-attached                  |
| CI Link     | Direct to GitHub Actions run   |
| Labels      | Test tags (auto-prefixed)      |
| Priority    | Based on @critical/@high tags  |

### Deduplication

- Generates fingerprint from: test name + error hash + file path
- Searches for existing open issues before creating
- Adds comment to existing issue if duplicate found
- Reopens closed issues if failure recurs

### Team Routing

```typescript
teamAssignments: {
  security: 'security-team',
  accessibility: 'frontend-team',
  performance: 'platform-team',
  api: 'backend-team',
  visual: 'design-team',
}
```

### Flaky Test Handling

- Checks `test-stability.json` before creating bugs
- Skips tests with >10% flake rate (configurable)
- Adds `flaky-investigation` label instead

---

## Configuration Options

```typescript
interface JiraConfig {
  // Connection
  baseUrl: string; // Jira instance URL
  email: string; // Jira user email
  apiToken: string; // API token
  projectKey: string; // Project key (e.g., "QA")

  // Behavior
  enabled: boolean; // Enable reporter
  createOnFailure: boolean; // Create issues on failure
  updateExisting: boolean; // Update existing issues
  skipFlaky: boolean; // Skip flaky tests
  flakyThreshold: number; // Flake rate threshold (%)

  // Attachments
  attachScreenshots: boolean;
  attachVideos: boolean;
  attachTraces: boolean;

  // Customization
  issueType: string; // Issue type (default: "Bug")
  labelPrefix: string; // Prefix for auto-labels
  priorityMapping: Record<string, string>;
  teamAssignments: Record<string, string>;
}
```

---

## Example Bug Report

### Summary

```
🔴 [chromium] TC-05: Verify login with invalid credentials - expect(locator).toBeVisible
```

### Description

#### 🌐 Environment

| Field       | Value                             |
| ----------- | --------------------------------- |
| Browser     | chromium                          |
| Viewport    | 1280x720                          |
| Base URL    | https://automationexercise.com    |
| Test File   | tests/flows/auth/TC-05.spec.ts:42 |
| Duration    | 12.34s                            |
| Retry Count | 2                                 |

#### 📝 Steps to Reproduce

1. Navigate to login page
2. Enter invalid email format
3. Click login button
4. Verify error message appears

#### ❌ Error Message

```
expect(locator).toBeVisible()

Locator: getByText('Invalid email format')
Expected: visible
Received: hidden
```

#### 🔗 CI Run

[View full execution](https://github.com/FeeDeur-UIQA/Github-QA-Portfolio/actions/runs/12345)

#### 🏷️ Metadata

- **Tags:** auth, critical, e2e
- **Fingerprint:** `a1b2c3d4e5f6`

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/playwright.yml
- name: Run Tests
  env:
    JIRA_REPORTER_ENABLED: ${{ github.event_name == 'push' }}
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
    JIRA_PROJECT_KEY: QA
  run: npx playwright test
```

### Required Secrets

- `JIRA_BASE_URL` - e.g., `https://your-org.atlassian.net`
- `JIRA_EMAIL` - Jira account email
- `JIRA_API_TOKEN` - [Generate token](https://id.atlassian.com/manage-profile/security/api-tokens)

---

## Best Practices (2024-2026)

### What Makes a Good Automated Bug Report

1. **Actionable Title**: Include browser, test name, and error type
2. **Environment Context**: Browser version, viewport, URLs
3. **Reproducible Steps**: From test annotations, not just "run the test"
4. **Expected vs Actual**: Clear assertion failure
5. **Visual Evidence**: Screenshots at failure point
6. **Execution Context**: Video showing the full flow
7. **Debug Data**: Trace files for deep investigation
8. **Direct Links**: CI run, related user story, similar issues
9. **Automatic Priority**: Based on test criticality tags
10. **Team Routing**: Auto-assign based on test category

### Avoid

- ❌ Creating bugs for known flaky tests
- ❌ Duplicate issues for the same failure
- ❌ Missing environment details
- ❌ Screenshots without context
- ❌ Manual priority assignment
- ❌ Unstructured error messages

---

## Troubleshooting

### "Jira API error: 401"

- Verify `JIRA_EMAIL` and `JIRA_API_TOKEN` are correct
- Ensure API token has project access

### "Jira API error: 403"

- Check project permissions for the API user
- Verify issue type exists in project

### No issues created

- Set `JIRA_REPORTER_ENABLED=true`
- Check console output for skip reasons (flaky, existing issue)

### Attachments not appearing

- Verify file paths exist
- Check Jira attachment size limits (10MB default)

---

## Related Documentation

- [Playwright Reporters](https://playwright.dev/docs/test-reporters)
- [Jira REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Test Tagging Standard](../documentation/TEST-TAGGING-STANDARD.md)
- [Flake Report](../FLAKE-REPORT.md)
