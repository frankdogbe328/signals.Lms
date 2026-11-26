# Security Remediation Report

## Executive summary

The remediated application now removes known JWT fallbacks, requires a strong production JWT secret, enables secure database TLS verification by default, rejects plaintext password credentials, prevents public administrator/unauthorized role assignment, removes password fields from API user transforms, and adds backend role checks in both Vercel and local-server implementations.

## High-risk findings and fixes

| Vulnerability | Severity | Affected areas | Fix |
|---|---|---|---|
| Known JWT fallback secrets | Critical | `api/_auth.js`, `dev-server.js` | Removed known fallbacks; production/startup requires `JWT_SECRET` and a 32-character minimum. Development uses a process-ephemeral secret only when not configured. |
| Password hashes and plaintext credentials | Critical | API login/user responses, login flow, migration logic | Login requires bcrypt hashes; user responses omit password fields; Supabase migration ignores non-bcrypt credentials. |
| Public administrator privilege assignment | Critical | Authentication registration routes | Public registration rejects `admin`; lecturer registration requires a valid key or administrator authorization. |
| Missing user-management authorization | High | Vercel/local users routes | User listing and privileged mutations require administrator authorization; self updates require ownership. |
| Insecure database TLS verification | High | `api/_db.js`, `dev-server.js` | Certificate verification is enabled by default; disabling it requires explicit configuration. |
| Unrestricted academic mutations | High | Exams/results/submissions/materials/announcements/settings/keys/audit routes | Added role checks and ownership restrictions in both implementations. |
| Backup exposing password data | High | Vercel backup route | Backup selects profile columns only for `users`, excluding password hashes. |
| Unsafe default credentials/documentation | High | README, sample initialization, login UI | Removed known administrator credentials and lecturer key from source/documentation. |

## Modified files

- `api/_auth.js`: shared JWT secret validation and verification behavior.
- `api/_db.js`: required database URL and secure TLS defaults.
- `api/[...path].js`: password exposure, registration, user, exam, result, submission, administrative route authorization and backup sanitization.
- `dev-server.js`: consistent JWT/database behavior and local route authorization/password handling.
- `js/migrate-data.js`: rejects plaintext credentials and migrates only bcrypt values.
- `js/app.js`: removed local sample admin password.
- `js/init-sample-data.js`: removed default lecturer key and credentials.
- `js/admin-dashboard.js`: removed password prefill and in-memory password assignment.
- `js/lecturer-auth.js`: removed in-memory password assignment.
- `js/student-auth.js`: removed in-memory password assignment.
- `admin/login.html`: removed public default credential text.
- `README.md`: updated backend, environment, credential, and setup documentation.
- `.env.example`: documents required environment variables without real secrets.
- `test/smoke.test.js`: added invalid-token and public-admin registration checks and password-field assertions.
- `package.json`: corrected test script for Node test discovery.

## Verification

- JavaScript syntax checks: **PASS** for modified JavaScript files.
- `npm ci`: **PASS**; dependencies restored from the lockfile.
- `npm run build`: **PASS** (Vite production build completed; only existing bundling warnings for classic scripts).
- `npm test`: **NOT RUN SUCCESSFULLY** because no API server was running; all smoke tests were cancelled after the suite could not connect to `http://localhost:3000`.
- Database-backed tests: **NOT RUN** because no database/environment was available in this session.

## Remaining limitations

- Resource-level lecturer ownership checks remain incomplete for every academic route and may require a per-resource data-model review.
- Examination timing, attempt, and submission enforcement still need database-backed integration tests.
- Legacy plaintext password records require an explicit migration/recovery procedure and cannot authenticate under the remediated login logic.
- Cloudinary and Resend integrations require valid server-side environment variables.
- A full dependency audit reported 6 npm vulnerabilities; upgrading requires compatibility review and is not included in this security remediation.
- Production deployment was not performed.

## Deployment requirements

Set `DATABASE_URL` and `JWT_SECRET` (at least 32 characters) before startup. Configure Cloudinary variables only if uploads are enabled. Configure `RESEND_API_KEY` and `RESEND_FROM` only if result-release email is enabled. Provision the initial administrator and lecturer keys through a secure manual database process; do not use public registration for privileged accounts.
