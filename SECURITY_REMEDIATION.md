# Signals LMS Security Remediation Report

## Status

This report covers the second remediation and final correction pass. Changes are on `security-remediation-pass-2`; no deployment or production-data changes were made.

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
| Student exam response | High | A successful student submission now returns only a submission receipt (id, exam id/title, timestamp, unreleased state). It omits score, answers, question details, correctness flags, and answer keys. Students only receive answer-key-bearing result details from the existing result GET path when `is_released = true`. |
| Written marks | High | Both APIs verify the target is a student enrolled in the requested class. Lecturer marks additionally require the lecturer's persisted class and subject assignments; invalid scope is rejected before the upsert. |
| Announcement targeting | High | Both APIs validate target class names on the backend. Lecturers must specify one or more valid assigned classes and cannot create school-wide announcements. Administrators may still use an empty class target for school-wide announcements. |
| Submission grading | High | Both APIs apply an atomic class-scope predicate to lecturer grade updates, and lecturer submission reads use the same assigned-class constraint. Students must be actual student accounts. The current schema cannot establish ownership of an assignment itself; see the migration proposal below. |
| Registration-key consumption | High | Lecturer key claim and account creation now occur in one transaction in both implementations. The conditional `UPDATE ... WHERE used_at IS NULL AND expires_at > NOW()` serializes concurrent claims; account creation failure rolls the key update back. |

## Files changed in this pass

- `api/_security.js`: shared exam ownership, eligibility, and backend grading helpers.
- `api/[...path].js`: result integrity and response shaping, exam ownership, written-mark and announcement target scope, submission grade scope, registration transaction, materials and notification authorization, privileged registration fields, and scoped one-time keys.
- `dev-server.js`: matching result response, mark, announcement, submission, and registration controls plus local login throttling, multipart handling, local CORS, and earlier authorization protections.
- `api/_cors.js`: exact configured CORS origin allowlist; no wildcard credentials.
- `schema.sql`: removed default admin credentials, safely adds registration-key expiry/use/scope columns, and adds ownership indexes.
- `js/admin-dashboard.js`, `js/api-service.js`: scoped, cryptographically random lecturer key generation and submission.
- `scripts/provision-admin.js`: secure non-destructive initial admin provisioning.
- `package.json`: provisioning script and unit/integration test command support.
- `.gitignore`: allows npm package lockfile tracking.
- `.env.example`: documents the optional exact-origin CORS allowlist.
- `README.md`: secure admin setup, CORS allowlist, registration-key policy, and guarded test prerequisites.
- `test/security.unit.test.js`: deterministic grading, ownership, exam eligibility, response redaction, mark/announcement/submission authorization, and transaction tests.
- `test/smoke.test.js`: optional live-server authorization tests for student/lecturer/admin role behavior.
- `test/final-security.integration.test.js`: local-database-only regression checks for answer leakage, mark/announcement/submission authorization, transaction rollback, and concurrent key reuse.
- `SECURITY_REMEDIATION.md`: updated status and remaining limitations.

## Verification

Dependencies were installed with `npm ci` from the checked-in lockfile. JavaScript syntax checks, `npm test`, `npm run build`, and `git diff --check` passed. The security unit suite passed (12 tests). Vite emitted existing warnings that classic script tags cannot be bundled as module scripts; the build completed successfully. `npm ci` also reported 6 dependency advisories (1 moderate, 5 high); dependency upgrades were not part of this correction pass.

The final live API integration suite was not run: no test database URL, test-role tokens, or fixture configuration is present in the environment. The existing optional smoke suite was also skipped. The new mutation tests require a local API server and assert `DATABASE_URL` exactly matches `TEST_DATABASE_URL`; they refuse non-local API URLs. Test setup must use a disposable database, an open eligible exam with no prior attempt for the test student, assigned/unassigned class fixtures, a student outside the lecturer's assigned class, and an existing username for key-rollback testing. No production database was accessed.

## Outstanding limitations

- **Assignment ownership remains unverifiable.** Assignments are currently stored in browser local storage; the database has no `assignments` table, `submissions.assignment_id` has no foreign key, and there is no persisted assignment owner, subject, or class association. Lecturer submission reads and grading are restricted to students in their assigned classes, but the backend cannot prove that a submission's assignment belongs to that lecturer or subject. Do not treat this class-level check as exact assignment ownership.
- **Safe migration proposal:** introduce a persisted `assignments` table with UUID primary key, `lecturer_id` FK, `class_id` FK, subject, title, created/updated timestamps and an index on `(lecturer_id, class_id, subject)`. Migrate assignments only from a trusted source that can establish the original owner/class/subject; do not infer owner from the submitter or grant ownership from untrusted browser data. Quarantine orphaned/ambiguous submissions, add a foreign key from `submissions.assignment_id` after reconciliation, then require a join through `assignments` and the lecturer's current class/subject scope on submission reads and grading. Update assignment creation/deletion to use the API before enforcing the foreign key. This migration was not applied in this pass.
- Final live database-backed route tests remain pending until a disposable test DB and test fixtures are supplied.
- Public lecturer registration takes class and subject assignments exclusively from the one-use key. Legacy keys migrate with empty scopes; administrators should replace them with scoped keys.
- Essay/written questions remain pending manual grading; the student cannot provide an authoritative score. Authorized lecturer/admin grading is still a trusted manual operation.
- Local in-memory rate limiting is per process and is not a distributed limiter.
- Existing third-party integration and deployment configuration still require operator verification.
