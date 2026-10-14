# ForensIQ — Security Remediation Report

_Date: 2026-10-14 · Scope: `forensiq-backend` (Express 4 + Prisma 5 + PostgreSQL) and `forensiq-frontend` (Next.js 15)_

All changes are **uncommitted** in each repository's working tree (both are git repos; `git diff` shows everything). Nothing was deployed, no production data was modified, no database command was run, and no credential was rotated.

---

## 1. Executive summary

The original audit found an attacker could become an administrator by registering with `"role":"ADMIN"`, read other users' service requests and profiles, read any quiz's answer key without enrolling, escalate a sub-admin to SUPERADMIN, and plant stored XSS in public event pages to steal admin tokens. Payment webhooks were rejected 100% of the time, so customers who closed the tab after paying were never enrolled.

**All Critical and High findings now have code fixes with automated regression tests.** Several items have residual risk or require a deployment-time action; these are called out explicitly below and in §6. In particular:

- Tokens still live in `localStorage` (HttpOnly-cookie migration is not feasible with the current cross-site deployment) — mitigated by server + client sanitization, CSP and an ESLint guard.
- A private key (`sagar.pem`) **was committed and pushed to GitHub**. It is now untracked and ignored, but it remains in git history and **must be rotated** (manual action).
- One additive DB column must be applied before deploying the backend (password-reset OTP counter).
- ESLint now runs in production builds, but `@typescript-eslint/no-explicit-any` was set to *warn* (533 pre-existing occurrences) — see Y.

### Verification at a glance

| Check | Result |
|---|---|
| Backend regression tests (`npm test`, node:test, in-memory Prisma fake) | **75 / 75 pass** |
| Backend `npm audit --omit=dev` | **0 vulnerabilities** (was 7 incl. 1 critical, + nodemailer high) |
| Backend `prisma validate` | valid |
| Backend clean install (`npm ci`) + boot smoke test | OK |
| Frontend `tsc --noEmit` | **0 errors** |
| Frontend `next lint` | **0 errors**, 680 warnings (533 `no-explicit-any`, 128 unused vars, …) |
| Frontend `next build` (lint enabled) | **OK** |
| Frontend clean install (`npm ci`) | OK |
| Frontend `npm audit --omit=dev` | 12 remaining (6 high, 4 moderate, 2 low) — build-time tooling + one low admin-editor issue; **0 critical** (was 24 incl. 3 critical) |
| Headless-browser CSP check (12 public pages) | **0 CSP violations** |
| Headless-browser stored-XSS check (malicious event row) | **no payload executed**; `javascript:` links neutralised |

---

## 2. Status of every finding

Legend: **FIXED** = code changed and the security property verified by a test or runtime check. **PARTIALLY FIXED** = main issue fixed, residual noted. **NOT FIXED / BLOCKED** = explained.

### Phase 1 — Critical

| ID | Finding | Status | Root cause → remediation | Verification |
|---|---|---|---|---|
| A | Registration privilege escalation | **FIXED** | `createUser` trusted `role` from body → zod schema + allowlist `STUDENT/CLIENT/INSTITUTION/PROFESSIONAL/MEMBER`; `is_sub_admin` forced false; same allowlist in Google sign-up; staff accounts only via `POST /admin/sub-admins` (full admin). Password policy enforced. | `auth.registration.test.js`: ADMIN, admin, SUPERADMIN, SubAdmin, SUBADMIN, ROOT, STAFF, " Admin " → 400 and **no row created**; extra `is_sub_admin` ignored |
| B | Service-request IDOR | **FIXED** | `getRequestById` had an empty ownership `if` → new `utils/portalAccess.findAccessibleRequest` (owner or staff) used by get / messages / add message / upload / add URL / delete / delete file; non-owners get the same 404 as a missing id. `isAdmin` on messages derived from DB role. `fileUrl` / `meeting_link` must be http(s); status allowlisted. | `authz.idor.test.js` (unauth 401, other user 404 on 7 endpoints, owner/staff OK, `javascript:` links 400) |
| C | Profile & course-entitlement IDOR | **FIXED** | `/user/get/:id`, `/user/courses/:userId` → owner-or-staff (404 otherwise); stack trace removed. Also found & fixed: `GET /user/all` and `POST /enrollments` returned **password hashes** (`utils/userSerializer`). Course content / stream require ACTIVE enrollment in ACTIVE course; courseId taken from route params only. | IDOR tests; "admin user listing never returns password hashes"; course-content test (outsider, suspended → 403) |
| D | Quiz answer disclosure / attempts | **PARTIALLY FIXED** | `services/quizAccess`: view & submit require ACTIVE enrollment in an ACTIVE course; answers never sent to students (query `select` + explicit strip). `GET /quiz/get/:id` issues a signed attempt token (user+quiz+start, TTL = duration + 10 min); `POST /quiz/submit` requires it (server-side time limit) and allows **one submission per token** under a Postgres advisory lock (409 on duplicates); answers sanitised to real question ids/options; score server-side. Attempt results: owner or staff only. | `quiz.test.js` (non-enrolled 403, no answers in payload, missing/stolen/expired token 403, duplicate 409, score ignores injected fields) |
| | *Residual* | | The product shows correct answers after each submission and has no per-quiz attempt limit / reveal setting in the schema, so an enrolled student can submit once, review, then retake. Requires a product decision + schema fields (`maxAttempts`, `revealAnswers`). |
| E | ADMIN / SUPERADMIN / sub-admin model | **PARTIALLY FIXED** | Central `utils/roles.js` (DB-derived; JWT claims ignored): **staff** = ADMIN, SUPERADMIN, sub-admin; **full admin** = ADMIN (not sub) or SUPERADMIN. Middlewares `requireStaff` / `requireFullAdmin`. Full-admin only: user list/update/block/delete, sub-admin creation, approval queue, enrollments writes, coupon writes. `canManageUser`: no self-management; full admins/SUPERADMINs only manageable by a SUPERADMIN. `updateUser` is `.strict()` and can never assign ADMIN/SUPERADMIN/SUBADMIN or change staff roles. `staffWriteGate` case bug fixed. Approvals: self-approval blocked, atomic claim (no double-apply), rollback to pending on failure. | `authz.matrix.test.js` (forged-claim token, 8 full-admin endpoints × student/sub-admin denied, role escalation blocked, self/peer modification blocked, superadmin allowed, queue + self-approval + double-apply) |
| | *Residual* | | The approval queue still only covers network events (as originally designed). Sub-admins edit content (courses, quizzes, blogs, notices, events, catalog, requests) directly, matching the existing admin UI. Extending approval to more content types is a product decision; `queueIfSubAdmin` + `staffActionApplier` is the extension point. |
| F | Stored XSS + token theft | **PARTIALLY FIXED** | Server: `sanitize-html` allowlist on event `fullDescription` (write **and** read for legacy rows); http(s)-only validation for every link/media field (events, notes, notices, blog images, course/lecture/resource URLs, portal links). Client: `src/lib/security/sanitize.ts` (DOMPurify, fails closed during SSR) for every `dangerouslySetInnerHTML`; `safeHref` on 12 user-controlled link sinks; certificate popup HTML escaped. CSP + security headers (`next.config.mjs`). ESLint rule rejects any `dangerouslySetInnerHTML` not wrapped in `sanitizeHtml`. | `hardening.test.js` (11 payload classes, event write/read, `javascript:` link 400); **browser test**: malicious event row rendered → no execution, no `javascript:` hrefs, 0 CSP violations |
| | *Residual* | | Token remains in `localStorage` (see V). Cookie auth needs frontend and API on the same site (e.g. `app.forensiq.in` + `api.forensiq.in`) to use `SameSite` cookies safely; with today's cross-site setup it would need `SameSite=None` cookies, which third-party cookie blocking breaks. Recommended next step once domains are aligned. |

### Phase 2 — High

| ID | Finding | Status | Remediation | Verification |
|---|---|---|---|---|
| G | Cashfree webhook broken / payment integrity | **FIXED** (live verification BLOCKED) | Raw body via `express.raw` (any content type); signature verified over the exact bytes with the SDK's `PGVerifyWebhookSignature` (HMAC-SHA256 of timestamp+body); JSON parsed only after; order id, `SUCCESS` status, amount and INR currency checked; new `services/paymentFulfillment` (advisory lock, CREATED/FAILED→SUCCESS once, enrollment never duplicated, coupon usage recorded once) shared by webhook and `/confirm-transaction`. `/confirm-transaction` only looks up the caller's own order and requires a Cashfree SUCCESS payment with matching amount. FAILED webhook never downgrades SUCCESS. Transient errors → 500 so Cashfree retries. | `payments.test.js` (valid sig idempotent ×2, bad/tampered/missing sig, amount & currency mismatch, malformed JSON, FAILED-after-SUCCESS, browser confirm: pending/amount mismatch/other user's order/success) |
| | *Blocked / residual* | | Not exercised against Cashfree itself (no sandbox credentials used, by design). No timestamp freshness window (replays are harmless because processing is idempotent). Confirm the webhook URL `https://<api>/api/webhooks/cashfree` is configured in the Cashfree dashboard. |
| H | Google auth accepted any app's token | **FIXED** | `utils/googleVerifier`: ID tokens → `verifyIdToken({audience})` + issuer + `azp`; access tokens (current frontend flow) → `getTokenInfo` and `aud`/`azp` must equal our client id(s), expiry checked; `email_verified` required; staff accounts can't use Google; an account linked to a different Google `sub` can't be taken over. | `auth.google-otp.test.js` (foreign audience, unverified email, expired, ID-token audience/azp, admin role, staff account, account takeover) |
| I | No rate limiting, weak OTP | **FIXED** (residual: shared store) | `express-rate-limit` v8 per IP / per email / per user on login, register, Google, forgot/reset password, change-password, admin re-auth, uploads, payments, coupon validation, quiz submit, messages, webhook, plus a global limit; 429 with standard headers. OTP: `crypto.randomInt`, bcrypt-hashed, 15 min, single use (deleted in the same transaction as the password update); **DB attempt counter** (5) consumed atomically before comparison; counter carried over when a new code is requested within 1 h and no code issued while locked (temporary, not permanent); 60 s resend cooldown; generic responses. Login: one generic message for unknown/wrong/Google-only accounts and a dummy bcrypt compare. | tests: OTP lockout incl. correct code after 5 failures, no reset via re-request, single use, expiry, policy; login and forgot-password 429 |
| | *Residual* | | Limiter store is in-process memory. If the backend runs on several instances or serverless, add a shared store (e.g. `rate-limit-redis`) in `utils/rateLimiters.makeStore`. OTP protection itself is DB-backed. |
| J | Substring CORS | **FIXED** | `utils/corsPolicy`: exact `scheme://host[:port]` allowlist from built-ins + `FRONTEND_URL(S)` + `CORS_ALLOWED_ORIGINS`; localhost only outside production; rejected origins get no CORS headers. | unit test with 12 lookalikes (suffix, prefix, scheme, port, case, trailing slash, `null`) + middleware test incl. preflight |
| K | Unbounded / unchecked uploads | **FIXED** (residual noted) | `express-fileupload` limits (100 MB hard, 1 file, `abortOnLimit` → 413); `utils/fileValidation` detects type from **magic bytes** + extension (PDF, images, MP4/MOV/WebM, Office/ZIP, CSV; no SVG/HTML); per-category size caps; videos staff-only; safe display names; Cloudinary folder slug-only; temp files always removed after the response; all upload paths share it. | tests: HTML-as-PDF, SVG, EXE, extension mismatch, oversize, traversal names/folders, 413 over limit, temp-file cleanup |
| | *Residual* | | Files are stored as public Cloudinary URLs (anyone with the link can fetch). Private/signed delivery and malware scanning would need Cloudinary plan/config changes. |
| L | complete-profile password overwrite / token claims | **FIXED** | Requires `verifyToken`; can only set a password when none exists (conditional update guards races); policy enforced; token issued after commit via shared `signAuthToken` (keeps `is_sub_admin`). **All password changes/resets invalidate existing sessions**: JWT carries an HMAC fingerprint of the password hash (`pwv`), checked on every request — no schema change. `/user/change-password` requires the current password, returns a fresh token, and answers 400 (not 401) on a wrong password so the UI doesn't log the user out. | tests: existing password can't be replaced; Google user sets initial password; unauth 401; change-password invalidates old token; legacy tokens accepted until expiry (documented) |

### Phase 3 — Functional bugs & integrity

| ID | Item | Status | Notes |
|---|---|---|---|
| M | Event description never shown | **FIXED** | Page used `event.description`; now `fullDescription` (sanitized) with `shortDescription` fallback. Also **fixed:** public endpoints returned DRAFT/ARCHIVED events (`/events/public?status=DRAFT`, `/events/public/:slug`). |
| N | Purchases / coupons | **FIXED** (residual) | Course must be ACTIVE; existing ACTIVE enrollment → 400, suspended → 403; **stopped deleting earlier CREATED payments** (a late success on an old order would have been lost); DB record written *before* the Cashfree order; free / 100%-coupon checkout in one serialized transaction with coupon usage consumed atomically against its limit; price always server-computed; coupon admin input validated (non-negative, ≤100 %). *Residual:* for paid orders the coupon limit is checked at order creation and recorded at fulfilment — concurrent paid orders can exceed it (honoured, since the customer paid). |
| O | `/security/log` endpoint missing | **FIXED** | Not implemented on purpose: client-reported viewer/quiz events can be forged, so they aren't trusted audit data. Frontend now logs locally only. |
| P | API base URL mismatch | **FIXED** | Single `src/lib/api/config.ts`; 23 call sites migrated; production build **fails** without `NEXT_PUBLIC_API_URL` (`next.config.mjs`). |
| Q | Internal errors leaked | **FIXED** | Central `errorHandler` + `serverError` / `handleControllerError` (safe message + `requestId`, details logged server-side); malformed JSON → 400; stream proxy no longer returns upstream bodies. |
| R | Backend dependency declarations | **FIXED** | Added `axios`, `express-rate-limit`, `helmet`, `sanitize-html`, `zod`; removed self-reference (which pulled `razorpay`), `crypto` shim, `body-parser`, unused `@azure/communication-email`, `pdfkit`, `xlsx` (+ dead `utils/excelToJson.js`); `nodemon` → devDependencies; `npm audit fix` (express 4.22.3, proxy-addr, qs, path-to-regexp); nodemailer 9 → 10 (credential-disclosure advisory; API used is unchanged, verified). |
| S | Unpublished courses listed | **FIXED** | `/getSimpleCourses` → ACTIVE only; `/courses/all` → ACTIVE only for non-staff (query `status` ignored); `/courses/get/:id` → non-active only for staff or enrolled users. |

### Phase 4 — Code quality & architecture

| ID | Item | Status | Notes |
|---|---|---|---|
| T | Unused frontend deps | **FIXED** | Removed `antd`, `@mui/material`, `@emotion/*`, `formik`, `yup`, `zod`, `react-quill`, `audit`, `forensiq` (self), `react-router-dom`, `react-helmet-async`, `react-hot-toast`, `react-toastify`, `@hookform/resolvers`, `@radix-ui/react-icons`. Kept `sharp` (Next image optimisation) and `pdfjs-dist` (react-pdf worker). Upgraded `next` 15.5.27, `swiper` 14 (critical prototype pollution; carousels verified in browser), `sharp` 0.35.5, `xlsx` 0.20.3 from SheetJS's official CDN (npm build is unmaintained/vulnerable). |
| U | Duplicates | **FIXED** (with documented keeps) | Import-graph scan from all Next entry points → 48 unreachable files removed (legacy `components/requests/*` incl. both `FileUploadSection` variants, duplicate `ChatThread`, two dead route guards, `Navbar.jsx` that imported a non-existent module, dead CSS, `.backup`, unused SEO config). **Toasts consolidated on Sonner** — this also fixes a bug: `react-hot-toast` was used in 45 files but its `<Toaster/>` was never mounted, so those notifications never appeared. Kept on purpose: `/notification` (public notices) vs `/notifications` (logged-in dashboard) — different audiences/layouts; `SecurePDFViewer` (Drive previews) vs `student/PdfViewer` (authenticated stream) — different flows; unused shadcn `ui/` primitives (library). `lib/auth/guards.tsx` is the single remaining route-guard implementation. |
| V | Token/session handling | **PARTIALLY FIXED** | `SessionManager` is the only owner of the token (`localStorage["token"]`), migrates and clears legacy keys (`forensiq_token`, sessionStorage token/user, quiz attempt tokens); every direct `localStorage.getItem("token")` replaced; profile cache holds non-secret fields only. Still JS-readable — see F residual. |
| W | Next.js server-side route protection | **NOT FIXED** (by design for now) | Without a cookie session, Next middleware cannot see the token, so it can't make real decisions. No page renders private data on the server (all private data is fetched client-side from the API, which enforces authorization). Do this together with the cookie migration. |
| X | Dangerous scripts / sensitive logs | **FIXED** | Removed (`git rm`, recoverable from history) 22 ad-hoc scripts incl. `truncate-payments.js` (`TRUNCATE "Payment" CASCADE`), `mintToken.js` (signed a real admin JWT with the production secret), scripts that created/deleted live records or dumped user PII, and two 0-byte artifacts. `seed-catalog.js` → `scripts/maintenance/` behind a `CONFIRM_DB_WRITE=yes` guard (refuses in production without `ALLOW_PRODUCTION_WRITE=yes`); same guard on `scripts/migrateEnrollments.js`. Structured redacting logger; removed logs of Cashfree payloads, user ids on auth failures; email recipients masked. |
| Y | Tests, validation, headers, lint, CI | **PARTIALLY FIXED** | 75 backend security tests; zod on registration / user update / self-update / sub-admin; helmet (+ API CSP `default-src 'none'`); frontend CSP + HSTS + nosniff + frame/referrer/permissions policies; ESLint **re-enabled in builds**; GitHub Actions CI for both repos (no secrets). **Deviation:** `@typescript-eslint/no-explicit-any` set to *warn* — 533 pre-existing `any`s (220 are untyped API responses); typing the whole API surface is a large, type-only refactor with no security effect. Every other rule stays an error; the 3 `ts-ignore`/`ts-nocheck` suppressions were removed by fixing the types. |

### Phase 5 — Repository hygiene & secrets

| ID | Item | Status | Notes |
|---|---|---|---|
| Z | Git hygiene | **PARTIALLY FIXED** | Correction to the original analysis: **both apps are git repos** (the parent folder is not). Backend tracked `sagar.pem` and `config/database/sagar.pem` (identical **private key**, unreferenced by code), pushed to `origin/main` (`github.com/Sagarjha7174/forensiq_X-backend`, commits `a3d3a3f`, `6be4595`). Now `git rm --cached` + ignored. Both `.gitignore`s now cover `.env*` (except `.env.example`), `*.pem`, keys, credential JSON. `.env.example` added to both repos. `.env` / `.env.local` were **never** committed (history checked). The frontend repo has no secret files in history. History was **not** rewritten (destructive; your decision). |
| AA | Secret rotation | **ACTION REQUIRED** | See §6.1. |

### Additional defects found and fixed during remediation

- Blocked users could still log in (`accountStatus: BLOCKED` left `isActive: true`); now both are synced and `verifyToken` rejects BLOCKED.
- `deleteUser` raw SQL used an unquoted table name, failing for any user with quiz attempts.
- `createCourse` ignored `class` and `status` sent by the admin form (every new course was DRAFT).
- Members could never register for network events (`'member'` vs `'MEMBER'`).
- Event stats file was written outside the backend directory.
- Certificate popup: `window.open(..., 'noopener')` always returned `null` (feature never worked) and interpolated names into HTML unescaped.
- `updateCourse`/`deleteCourse` had DB calls outside `try` (unhandled rejections).
- SSRF guard + redirect checks + Range-header validation on the PDF stream proxy.

---

## 3. Important implementation decisions

1. **Authorization source of truth** is the DB user loaded by `verifyToken`; JWT role claims are UI hints only (tested with a forged-claim token).
2. **No breaking schema change.** Session invalidation uses a password-hash fingerprint in the JWT; the only schema change is one additive column (`PasswordResetOtp.attempts`). If the migration is missing, only the two password-reset endpoints return 503 — nothing else is affected.
3. **Quiz timing without a schema change** via signed attempt tokens + advisory lock.
4. **One fulfilment path** for webhook and browser confirmation, idempotent by construction.
5. **Fail closed**: client sanitizer renders nothing if DOMPurify is unavailable; production build fails without an API URL; backend refuses to start without `JWT_SECRET`.

## 4. Behaviour changes to be aware of (deploy backend and frontend together)

- Sub-admins can no longer list/modify users, manage sub-admins, review approvals, change enrollments, or create/edit coupons (they can still read coupons and edit content).
- Quiz submissions require the attempt token issued with the quiz (old frontend builds will get 403 on submit).
- After a password change the old token stops working; the new frontend stores the returned token.
- New passwords: ≥ 8 characters with a letter and a number (existing passwords still work).
- Login failures show one generic message; 429 after repeated failures.
- Students only see ACTIVE courses in listings; the public sees only PUBLISHED events.
- CORS only allows exact configured origins — **set `FRONTEND_URLS` before deploying**.

## 5. Tests executed (real results)

```
forensiq-backend$ npm test                       → tests 75, pass 75, fail 0
forensiq-backend$ npm audit --omit=dev           → found 0 vulnerabilities
forensiq-backend$ npm audit (incl. dev)          → 3 high: braces via nodemon→chokidar (dev only)
forensiq-backend$ npm run db:validate            → schema valid
forensiq-frontend$ npm run typecheck             → 0 errors
forensiq-frontend$ npm run lint                  → 0 errors, 680 warnings
forensiq-frontend$ next build (NEXT_PUBLIC_API_URL set) → success
forensiq-frontend$ npm audit --omit=dev          → 12 (6 high, 4 moderate, 2 low), 0 critical
Browser (puppeteer, built app): 12 pages, 0 CSP violations; stored-XSS page: no execution
```

Remaining frontend advisories: `braces`, `postcss` (Next's bundled copy), `postcss-selector-parser` — build-time tooling processing only project source; `quill` 2.0.3 (low, HTML-export XSS in the admin-only editor; npm's only "fix" is a downgrade; event HTML is sanitized server-side).

**Not verified (blocked):** live Cashfree webhook delivery, real Google sign-in round trip, behaviour behind your production proxy/CDN, Prisma queries against the real PostgreSQL (tests use an in-memory fake — Postgres-specific behaviour such as advisory locks is asserted to be *issued*, not executed). Run the staging checklist in `SECURITY_TEST_PLAN.md`.

## 6. Remaining manual actions

### 6.1 Rotate the exposed private key (required)
1. Identify what `sagar.pem` grants (it is an RSA/PKCS private key with `0400` permissions — typically an EC2/SSH key pair). Check the GitHub repo's visibility and access list; if it ever was public, treat the key as compromised.
2. Create a new key pair, install the new public key, **remove the old public key** from every `authorized_keys` / cloud key-pair / service that trusts it, and verify you can no longer authenticate with the old key.
3. Optional: purge it from history (`git filter-repo --path sagar.pem --path config/database/sagar.pem --invert-paths`, then force-push and ask collaborators to re-clone). This rewrites history — only after rotation and with team agreement. Purging does not undo prior exposure.
4. Delete the redundant copies inside the repo folder once you've confirmed the canonical location.

No evidence was found that `.env` values were committed. Rotating `JWT_SECRET` is optional; doing so logs everyone out.

### 6.2 Deployment checklist
1. Apply `forensiq-backend/config/database/migrations/manual/20261014_password_reset_otp_attempts.sql` (additive, idempotent).
2. Backend env: `FRONTEND_URLS` (every production origin, exact), `TRUST_PROXY` (1 behind a proxy, 0 if exposed directly), `GOOGLE_CLIENT_ID(S)` matching the frontend, `NODE_ENV=production`.
3. Frontend env: `NEXT_PUBLIC_API_URL` (incl. `/api/v1`), `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Optionally ship the CSP first with `CSP_REPORT_ONLY=1`.
4. Cashfree dashboard: webhook URL `https://<api-host>/api/webhooks/cashfree`.
5. Multi-instance/serverless backend: plug a shared rate-limit store.
6. Deploy backend and frontend together; then run the staging checks.
7. Review and commit (`git diff` in each repo). Untracked-but-new files were marked intent-to-add (`git add -N`) for visibility only.

### 6.3 Recommended follow-ups
- Same-site API domain + HttpOnly `SameSite=Lax` cookie session, then Next middleware route protection (closes F/V/W residuals).
- Per-quiz `maxAttempts` / `revealAnswers` settings (closes D residual).
- Shared rate-limit store; private Cloudinary delivery for paid resources.
- Type the API client responses and restore `no-explicit-any` to error.
- `quizApi.getQuizzesByCourse` calls a non-existent `/quiz/course/:id` route (returns `[]` via catch) — pre-existing, not changed.

## 7. Files changed (high level)

**Backend — new:** `utils/{roles,authToken,corsPolicy,rateLimiters,fileValidation,sanitize,publicUrl,httpErrors,logger,passwordPolicy,portalAccess,googleVerifier,userSerializer}.js`, `services/{paymentFulfillment,quizAccess}.js`, `controllers/course/courseInput.js`, `scripts/maintenance/_guard.js`, `tests/**`, migration SQL, `.env.example`, CI.
**Backend — rewritten/modified:** `index.js`, all middlewares, all route files, controllers for auth, user, portal requests, quiz, cashfree, coupons, courses, course content, events, network, enrollments, uploads, blogs/notes/notices/catalog (error handling + URL validation), `package.json`/lock, `.gitignore`, `schema.prisma`.
**Frontend — new:** `src/lib/api/config.ts`, `src/lib/security/{sanitize,passwordPolicy}.ts`, `src/types/cashfree-js.d.ts`, `scripts/security/*`, `.env.example`, CI.
**Frontend — modified:** `next.config.mjs`, `.eslintrc.json`, `src/lib/auth/{session,authStorage}.ts`, all API clients, events page, quiz flow, profile/password forms, link sinks, 50+ files for toast consolidation, `package.json`/lock, `.gitignore`. **Removed:** 48 dead files.
