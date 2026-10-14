# ForensIQ — Security Test Plan

Regression cases for every Critical/High finding, how to run them, and what still needs a staging environment. **Never run these against production data or live payment credentials.**

## 1. Automated backend suite

```bash
cd forensiq-backend
npm ci
npm test            # node --test --test-concurrency=1 "tests/*.test.js"
```

- Runner: Node's built-in `node:test` (no extra dependency).
- Database: `tests/helpers/fakePrisma.js`, an in-memory Prisma stand-in injected through the `global.__prisma` singleton. No database connection is ever opened (`NODE_ENV=test` also skips the startup DB check).
- Email: `utils/mailService` is replaced by a recorder (`sentMail`). Cloudinary uploads are stubbed. Cashfree and Google calls are stubbed per test.
- Rate-limit counters are reset between tests (`resetAllLimiters`).
- Debug server-side logs: `LOG_IN_TESTS=1 npm test`.

| File | Covers | Key cases |
|---|---|---|
| `auth.registration.test.js` | A, I | 8 privileged/unknown role spellings → 400 and no row; extra `is_sub_admin` ignored; public roles accepted; password policy; generic login errors (unknown / wrong / Google-only); blocked account login |
| `authz.matrix.test.js` | E, L | forged role claim in JWT; foreign-secret JWT; 8 full-admin endpoints × (student, sub-admin, admin); content endpoints for staff; privileged role assignment, self- and peer-modification, superadmin override, unknown fields; sub-admin queue → self-approval 403 → approval → no double-apply; admin self-approval; deactivated user; password change invalidates old tokens |
| `authz.idor.test.js` | B, C, S | `/user/get/:id`, `/user/courses/:id` (unauth / other / owner / staff); service request read, messages, upload-by-URL, file delete, request delete, status update, admin list; `isAdmin` spoofing; `javascript:` links; paid course content (outsider, suspended, query-param redirect); course visibility for public/student/staff; no password hashes in user list |
| `quiz.test.js` | D | non-enrolled view/submit; no answers in payload + attempt token; suspended enrollment / inactive course; missing / other user's / expired attempt token; server-side scoring ignores injected fields; advisory lock issued; duplicate submission 409; attempt result privacy |
| `payments.test.js` | G, N | signed webhook fulfils once (duplicate delivery idempotent); bad / tampered / missing signature; amount and currency mismatch; malformed JSON; FAILED never downgrades SUCCESS; browser confirm (pending, amount mismatch, other user's order, success); DRAFT course; already enrolled; suspended; free checkout once; exhausted coupon; order persisted before Cashfree call; client amount ignored; old pending orders kept |
| `auth.google-otp.test.js` | H, I, L | Google: foreign audience, unverified email, expired token, ID-token audience/azp, privileged role request, staff account, linked-account takeover. complete-profile: can't replace password, first-time set, unauth. OTP: identical responses, hash-only storage, lockout after 5 (even correct code), re-request doesn't reset, single use, expiry, policy, sessions invalidated. Rate limits: login per account, forgot-password per email |
| `hardening.test.js` | F, J, K, Q | sanitizer vs 11 XSS payload classes; URL validation; event write/read sanitization, `javascript:` links, drafts hidden; CORS exact matching (12 lookalikes) + middleware incl. preflight; magic-byte detection (HTML-as-PDF, SVG, EXE, ext mismatch, oversize); traversal names/folders; upload endpoint auth/spoof/success/temp cleanup/video restriction; 413 over hard limit; SSRF private-address classification; no stack/internal text in 500s; malformed JSON 400; security headers |

**Adding a test:** seed rows with `prisma.seed(model, row)` (attach any related objects the controller reads, because the fake does not resolve relations), create actors with `makeUser({ role, is_sub_admin })`, and call `api(method, url, { token, body })`.

## 2. Frontend checks

```bash
cd forensiq-frontend
npm ci
npm run typecheck
npm run lint                                           # must report 0 errors
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api/v1 npm run build
```

- The build must fail without `NEXT_PUBLIC_API_URL` (`next.config.mjs` guard). Check: `env -u NEXT_PUBLIC_API_URL npx next build` with `.env.local` moved aside.
- The lint rule `no-restricted-syntax` rejects `dangerouslySetInnerHTML` unless the value comes from `sanitizeHtml(...)`, `JSON.stringify(...)` or a static template literal.

### Browser checks (`scripts/security/`)
These need Puppeteer. The backend already has it: pass its path as the last argument.

```bash
# terminal 1: serve the production build
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api/v1 npx next start -p 3123
# terminal 2: mock API serving a malicious (legacy, unsanitized) event row on :3001
node scripts/security/mock-api.js
# terminal 3
PUP=../forensiq-backend/node_modules/puppeteer
node scripts/security/csp-check.js $PUP   # expect: no "Content Security Policy" violations
node scripts/security/xss-check.js $PUP   # expect: xss=null, jsHrefs=0, renderedSafeText=true, xssAfterClick=null
```
(The only expected "Refused to execute" messages locally are Vercel analytics scripts, which exist only on Vercel.)

## 3. Staging checklist (needs real services — not automated)

Run against a staging deployment with a **copy** of the database and Cashfree **sandbox** credentials.

| # | Check | Expected |
|---|---|---|
| 1 | Apply the OTP migration, then request a reset code and enter 5 wrong codes | 6th attempt → 429; a new code is not issued for 1 h |
| 2 | Register via API with `"role":"ADMIN"` | 400, no account |
| 3 | Log in as student A; `GET /api/v1/user/get/<B id>` and `/portal-requests/<B request>` | 404 |
| 4 | Sub-admin: `PATCH /api/v1/user/update/<own id>` `{"role":"SUPERADMIN"}` | 403 |
| 5 | Sandbox purchase, close the tab immediately after paying | Webhook enrolls the user; Cashfree dashboard shows 200 for the webhook |
| 6 | Resend the same webhook from the Cashfree dashboard | 200 `ignored - already success`, one enrollment |
| 7 | `curl -X POST /api/webhooks/cashfree` with a fake signature | 401 |
| 8 | Google sign-in (button) for new and existing student | Works; admin email → 403 |
| 9 | `curl -H "Origin: https://evil.example" -I /api/v1/getSimpleCourses` | No `Access-Control-Allow-Origin` |
| 10 | Real frontend origin | API calls succeed (confirms `FRONTEND_URLS`) |
| 11 | Hammer `/api/v1/login` with wrong passwords | 429 after 10 per account / 30 per IP per 15 min (verify the real client IP is used → `TRUST_PROXY`) |
| 12 | Upload a `.pdf` that is really HTML via the request page | 400 |
| 13 | Create an event with `<img src=x onerror=alert(1)>` in the description and publish | Saved without the handler; page shows no alert |
| 14 | Take a quiz: start → submit; submit again from devtools with the same body | Second → 409. Submitting after duration + 10 min → 403 |
| 15 | Change password in profile; reuse the old token from another tab | Old tab gets logged out on its next API call |
| 16 | Browse every page with devtools open | No CSP violations (or ship with `CSP_REPORT_ONLY=1` first and watch) |
| 17 | Toasts across admin/student pages | Visible (previously silent `react-hot-toast` calls) |

## 4. Route-by-route authorization reference

| Area | Public | Authenticated (owner checks in controller) | Staff (incl. sub-admin) | Full admin only |
|---|---|---|---|---|
| Auth | register, login, forgot/reset password, google-auth | complete-profile, me | — | — |
| Users | — | get/:id & courses/:userId (owner or staff), update-profile, change-password | — | all, update/:id, block/:id, delete/:id |
| Admin | — | — | verify-password, GET coupons | staff-actions (list/review), sub-admins (list/create), coupon writes |
| Courses | getSimpleCourses (ACTIVE) | all & get/:id (ACTIVE or enrolled; staff see all) | create, update, delete | — |
| Course content | — | GET content / stream (active enrollment) | module / lecture / resource / assignment / announcement writes | — |
| Quiz | — | get (enrolled), submit (enrolled + attempt token), history, attempts, attempt/:id (owner), course overview (enrolled) | create | — |
| Payments | webhook (signature) | create-order, confirm-transaction (own order), coupons/validate | — | — |
| Enrollments | — | — | GET | POST, bulk, PATCH, DELETE |
| Portal requests | — | create, my, get/:id, messages, files, delete (owner or staff) | admin list, PATCH | — |
| Events | public list/featured/stats/:slug (PUBLISHED), categories | — | admin CRUD, categories, stats | — |
| Network | — | events list, register (MEMBER), my-registrations | event writes (sub-admin → approval queue), registrations | — |
| Blogs / notices / notes / catalog | allBlogs, allNotices, catalog public | — | writes (+ notes list) | — |
| Uploads | — | `/upload` (images/docs; video for staff), `/portal-requests/:id/files` | `/fileupload` | — |
