# Part 8 — Validation, responsiveness, and optional features audit

The existing 154 backend checks and three browser suites passed before pagination/export implementation. The completed scope retains the required stack and adds no runtime dependencies. Part 9's final submission review remains separate.

| Area | Evidence |
| --- | --- |
| Registration/login | Required fields, email/password validation, duplicate email, failed login, saved sessions, expiry, logout, and cross-tab logout covered by API/browser tests. |
| Transaction validation | Required/invalid amount, category, date, type, descriptions, malformed IDs, and extra ownership fields covered by backend tests; 19 frontend validation assertions cover form rules. |
| Budgets | Blank/negative/zero budget handling, persistence, spending percentages, overspending, and server errors covered by backend/browser suites. |
| Authorization | Tests use separate users and verify isolated reads, edits, deletes, totals, budgets, pagination counts, and CSV downloads. |
| Loading/error states | API unavailable, expired sessions, invalid forms, empty results, failed saves/deletes, failed export, and recovery/retry exercised in browser tests. |
| Responsive layouts | Login, registration, transactions, dashboard, and budget checked at 320, 768, 1440, and 1920px. Transaction dialogs and long unbroken text included. |
| Accessibility | Existing label associations, alerts, status announcements, keyboard dialog dismissal/focus containment, and navigation retained. Budget validation now focuses its field; disabled secondary controls have visible feedback. This is not a formal WCAG certification. |
| Pagination | Defaults/bounds, malformed/repeated query values, combined filters, deterministic ordering, empty results, second-user exclusion, and last-page deletion tested. |
| CSV | Full 101-record browser download and filtered content compared with expected records. Unit test gathers 205 records across three requests; checks quoting, line breaks, Unicode BOM, formula-leading text, allowed columns, failures, cancellation, and detected concurrent changes. |

## Fixes made

- Long account names could force the dashboard heading beyond a 320px viewport. Restricted its flex child width and enabled wrapping anywhere; included regression coverage.
- Kept long transaction category labels within their text column instead of extending toward amount/action controls.
- Added disabled-control styling and focused the invalid budget amount for keyboard users.
- Replaced a spread-based chart maximum with a reduction to avoid argument-count limits on large category lists.

## Boundaries

- UI page size is 10. API page size is capped at 100. Empty API results have pages=0, while the UI labels the empty state Page 1 of 1.
- CSV uses the applied filters, contains only transaction fields, and neutralizes formula-like text. Pagination/export use existing authenticated APIs.
- Multi-request exports are not transactional snapshots; count-preserving concurrent edits can affect results. Browser memory limits still apply to very large personal datasets.
- Currency remains LKR; monthly budget boundaries remain UTC. No deployment, Git commit/push, demo video, or submission document was performed in Part 8.

## Commands

Run from the project root:

```powershell
npm.cmd test --prefix frontend
npm.cmd test --prefix backend
npm.cmd run build --prefix frontend
```

Optional browser suites require the existing Playwright/Edge setup described in README. Temporary test databases are removed after each suite; application data is not used.
