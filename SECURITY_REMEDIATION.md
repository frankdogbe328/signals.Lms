# Signals LMS Security Remediation Report

## Status

This second-pass report separates implemented code changes from work that remains dependent on production configuration or database-backed verification. The changes are on `security-remediation-pass-2`; they have not been deployed.

## Implemented in this branch

| Area | Severity | Implemented fix |
|---|---|---|
| Result integrity | Critical | Students can only submit their own result. The backend obtains exam questions and student identity from PostgreSQL, calculates objective scores, generates question details, and forces `is_released=false`. Client score, correct-answer count, result identity, title, type, and release fields are not used as authoritative values. Duplicate submissions are checked inside a transaction. |
| Exam eligibility | High | Student result submissions require an active exam and an assigned class or general-exam access. Scheduled start/end time is enforced unless the exam is explicitly manually activated. |
| Exam ownership | Critical | New exam ownership is derived from the authenticated token. Updating an existing exam via POST locks and checks the existing record; lecturers may only update their own exam, and ownership is preserved. The same applies to associated questions and class assignments. |
| Result and release management | High | Lecturers may manage results/releases only for exams they own; administrators retain system-wide access. Publishing/unpublishing synchronizes result release flags. |
| Materials | High | Material creation records the authenticated uploader. Deletion is restricted to administrators or the owning lecturer in both server implementations. Upload signing is restricted to administrators/lecturers and returns a safe configuration error when Cloudinary is not configured. |
| Notifications | High | Students cannot create notifications for other recipients. Administrators may create notifications; lecturers are limited to students in their assigned classes. Read updates are restricted to the recipient or an administrator. |
| Local API parity | High | Added login rate limiting, role-based exam/result/material/announcement/notification checks, class-scoped submission retrieval/grading for lecturers, student-owned submission access, and secure upload-signature access. |
| Registration | High | Public registration cannot set `canPrintResults` or self-assign lecturer classes/subjects. Administrators issue cryptographically random, one-use keys with explicit class/subject scopes; keys expire after seven days. Existing keys receive an expiry based on their original creation time and migrate with empty scopes; existing administrator rows are not deleted or changed. |
| Initial administrator | High | Removed the predefined admin insert/hash from `schema.sql`. Added `npm run provision-admin`, which creates a bcrypt-hashed admin only when the requested username is unused and never replaces an existing account. |
| CORS and lockfile | Medium | Wildcard CORS was removed. Cross-origin access requires an exact `CORS_ALLOWED_ORIGINS` allowlist. `.gitignore` no longer ignores `package-lock.json`. |

## Files changed in this pass

- `api/_security.js`: shared exam ownership, eligibility, and backend grading helpers.
- `api/[...path].js`: result integrity, exam ownership, result management scope, materials and announcement ownership, notification authorization, submission scope, privileged registration fields, and scoped one-time registration keys.
- `dev-server.js`: parity for the above authorization controls, local login rate limiting, multipart body handling, role-scoped submissions, local CORS, and scoped one-time keys.
- `api/_cors.js`: exact configured CORS origin allowlist; no wildcard credentials.
- `schema.sql`: removed default admin credentials, safely adds registration-key expiry/use/scope columns, and adds ownership indexes.
- `js/admin-dashboard.js`, `js/api-service.js`: scoped, cryptographically random lecturer key generation and submission.
- `scripts/provision-admin.js`: secure non-destructive initial admin provisioning.
- `package.json`: provisioning script and unit/integration test command support.
- `.gitignore`: allows npm package lockfile tracking.
- `.env.example`: documents the optional exact-origin CORS allowlist.
- `README.md`: secure admin setup, CORS allowlist, registration-key policy, and test prerequisites.
- `test/security.unit.test.js`: deterministic grading, ownership, exam eligibility, and registration-scope tests.
- `test/smoke.test.js`: optional live-server authorization tests for student/lecturer/admin role behavior.
- `SECURITY_REMEDIATION.md`: updated status and remaining limitations.

## Verification

Verification completed: JavaScript syntax checks, `npm test`, `npm run build`, and `git diff --check` passed. The deterministic unit suite passed. Live API smoke tests were skipped because no dedicated test server/database and role/resource fixtures were configured. The live smoke suite is intentionally gated behind `RUN_API_TESTS=1`; role-specific cases require student and lecturer test credentials/tokens in addition to administrator credentials. Do not run mutation tests against production.

## Outstanding limitations

- Database-backed route tests for actual lecturer-owned/other-owned exam and material records still require a dedicated test database and fixtures.
- Public lecturer registration now takes its class and subject assignments exclusively from the one-use key. Legacy keys migrate with empty scopes, so administrators must issue new scoped keys; end-to-end testing of this flow still requires the dedicated test database.
- Assignment records have no persistent ownership relation in the current schema. Lecturer submission reads and grading are therefore scoped to students in the lecturer's assigned classes, not to an assignment-owner record. A normalized assignments table is needed for exact per-assignment authorization.
- Essay/written questions remain pending manual grading; the student cannot provide an authoritative score. Authorized lecturer/admin grading is still a trusted manual operation.
- Local in-memory rate limiting is per process and is not a distributed limiter.
- Existing third-party integration and deployment configuration still require operator verification. No deployment was performed.
