const { test, beforeEach, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const { prisma, api, stop, resetState, makeUser, sentMail } = require("./helpers/setup");

beforeEach(resetState);
after(stop);

/* ------------------------------ Google ------------------------------ */
const origTokenInfo = OAuth2Client.prototype.getTokenInfo;
const origVerifyId = OAuth2Client.prototype.verifyIdToken;
const origFetch = global.fetch;
afterEach(() => {
  OAuth2Client.prototype.getTokenInfo = origTokenInfo;
  OAuth2Client.prototype.verifyIdToken = origVerifyId;
  global.fetch = origFetch;
});

const stubAccessToken = (info) => {
  OAuth2Client.prototype.getTokenInfo = async () => ({ expiry_date: Date.now() + 3600e3, ...info });
  global.fetch = async (url, opts) => {
    if (String(url).startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) {
      return new Response(JSON.stringify({ sub: info.sub, name: "G User", email: info.email }), { status: 200 });
    }
    return origFetch(url, opts);
  };
};

const ACCESS_TOKEN = "ya29.a0AfH6SMfaketokenvaluethatislongenough";

test("google: access token issued to another app is rejected", async () => {
  stubAccessToken({ aud: "someone-elses-app.apps.googleusercontent.com", sub: "g1", email: "x@example.com", email_verified: "true" });
  const res = await api("POST", "/api/v1/auth/google-auth", { body: { credential: ACCESS_TOKEN } });
  assert.equal(res.status, 401);
  assert.equal(prisma.__store.user.length, 0);
});

test("google: unverified email is rejected", async () => {
  stubAccessToken({ aud: process.env.GOOGLE_CLIENT_ID, sub: "g1", email: "x@example.com", email_verified: "false" });
  const res = await api("POST", "/api/v1/auth/google-auth", { body: { credential: ACCESS_TOKEN } });
  assert.equal(res.status, 401);
});

test("google: expired access token is rejected", async () => {
  stubAccessToken({ aud: process.env.GOOGLE_CLIENT_ID, sub: "g1", email: "x@example.com", email_verified: "true", expiry_date: Date.now() - 1000 });
  const res = await api("POST", "/api/v1/auth/google-auth", { body: { credential: ACCESS_TOKEN } });
  assert.equal(res.status, 401);
});

test("google: ID token path uses verifyIdToken with our audience; bad tokens rejected", async () => {
  let seenAudience;
  OAuth2Client.prototype.verifyIdToken = async ({ audience }) => { seenAudience = audience; throw new Error("Wrong recipient, payload audience != requiredAudience"); };
  const idToken = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";
  const res = await api("POST", "/api/v1/auth/google-auth", { body: { credential: idToken } });
  assert.equal(res.status, 401);
  assert.deepEqual(seenAudience, [process.env.GOOGLE_CLIENT_ID]);

  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ iss: "https://accounts.google.com", azp: "other-app", sub: "g2", email: "y@example.com", email_verified: true }) });
  assert.equal((await api("POST", "/api/v1/auth/google-auth", { body: { credential: idToken } })).status, 401, "azp must be our client");

  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ iss: "https://accounts.google.com", aud: process.env.GOOGLE_CLIENT_ID, sub: "g2", email: "y@example.com", email_verified: true, name: "Y" }) });
  const ok = await api("POST", "/api/v1/auth/google-auth", { body: { credential: idToken } });
  assert.equal(ok.status, 200);
  assert.equal(prisma.__store.user[0].role, "STUDENT");
});

test("google: privileged roles cannot be requested and staff accounts cannot use Google", async () => {
  stubAccessToken({ aud: process.env.GOOGLE_CLIENT_ID, sub: "g9", email: "boss@example.com", email_verified: "true" });
  assert.equal((await api("POST", "/api/v1/auth/google-auth", { body: { credential: ACCESS_TOKEN, role: "ADMIN" } })).status, 403);
  makeUser({ email: "boss@example.com", role: "ADMIN", is_sub_admin: true });
  assert.equal((await api("POST", "/api/v1/auth/google-auth", { body: { credential: ACCESS_TOKEN } })).status, 403);
});

test("google: an account already linked to a different Google id cannot be taken over", async () => {
  makeUser({ email: "linked@example.com", google_id: "original-sub" });
  stubAccessToken({ aud: process.env.GOOGLE_CLIENT_ID, sub: "attacker-sub", email: "linked@example.com", email_verified: "true" });
  assert.equal((await api("POST", "/api/v1/auth/google-auth", { body: { credential: ACCESS_TOKEN } })).status, 400);
});

/* --------------------------- Complete profile --------------------------- */
test("complete-profile cannot replace an existing password; first-time Google users can set one", async () => {
  const withPwd = makeUser();
  const r1 = await api("POST", "/api/v1/auth/complete-profile", { token: withPwd.token, body: { phone: "9123456780", password: "Another9Pass" } });
  assert.equal(r1.status, 400);
  assert.ok(await bcrypt.compare("Correct1pass", prisma.__store.user.find((u) => u.id === withPwd.user.id).password));

  const google = makeUser({ password: null, auth_provider: "google", profileCompleted: false });
  const r2 = await api("POST", "/api/v1/auth/complete-profile", { token: google.token, body: { phone: "9123456781", password: "Initial9Pass" } });
  assert.equal(r2.status, 200);
  assert.ok(r2.body.token);
  const stored = prisma.__store.user.find((u) => u.id === google.user.id);
  assert.equal(stored.profileCompleted, true);
  assert.ok(await bcrypt.compare("Initial9Pass", stored.password));

  assert.equal((await api("POST", "/api/v1/auth/complete-profile", { body: { phone: "9123456782" } })).status, 401);
});

/* ------------------------------ OTP reset ------------------------------ */
const otpFromMail = () => sentMail.filter((m) => m.name === "sendPasswordResetEmail").pop()?.args?.resetData;

test("forgot-password responds identically for unknown and known emails", async () => {
  const { user } = makeUser();
  const a = await api("POST", "/api/v1/auth/forgot-password", { body: { email: "nobody@example.com" } });
  const b = await api("POST", "/api/v1/auth/forgot-password", { body: { email: user.email } });
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
  assert.match(otpFromMail(), /^\d{6}$/);
  assert.notEqual(prisma.__store.passwordResetOtp[0].otp_hash, otpFromMail(), "only a hash is stored");
});

test("OTP brute force: locked after 5 wrong guesses, even for the right code, and re-requesting does not reset", async () => {
  const { user } = makeUser();
  await api("POST", "/api/v1/auth/forgot-password", { body: { email: user.email } });
  const otp = otpFromMail();
  const wrong = otp === "000000" ? "111111" : "000000";

  for (let i = 0; i < 5; i++) {
    const r = await api("POST", "/api/v1/auth/reset-password", { body: { email: user.email, otp: wrong, newPassword: "NewPass9word" } });
    assert.equal(r.status, 400);
  }
  const locked = await api("POST", "/api/v1/auth/reset-password", { body: { email: user.email, otp, newPassword: "NewPass9word" } });
  assert.equal(locked.status, 429);

  // Requesting a new code while locked does not issue one / reset the counter.
  prisma.__store.passwordResetOtp[0].createdAt = new Date(Date.now() - 2 * 60 * 1000); // past resend cooldown
  sentMail.length = 0;
  await api("POST", "/api/v1/auth/forgot-password", { body: { email: user.email } });
  assert.equal(otpFromMail(), undefined, "no new code while locked");
  assert.equal(prisma.__store.passwordResetOtp[0].attempts, 5);
  assert.ok(await bcrypt.compare("Correct1pass", prisma.__store.user[0].password), "password unchanged");
});

test("OTP: correct code resets once, is single-use, and enforces password policy", async () => {
  const { user, token } = makeUser();
  await api("POST", "/api/v1/auth/forgot-password", { body: { email: user.email } });
  const otp = otpFromMail();
  assert.equal((await api("POST", "/api/v1/auth/reset-password", { body: { email: user.email, otp, newPassword: "weak" } })).status, 400);
  const ok = await api("POST", "/api/v1/auth/reset-password", { body: { email: user.email, otp, newPassword: "NewPass9word" } });
  assert.equal(ok.status, 200);
  assert.equal(prisma.__store.passwordResetOtp.length, 0);
  assert.equal((await api("POST", "/api/v1/auth/reset-password", { body: { email: user.email, otp, newPassword: "NewPass9word2" } })).status, 400);
  assert.equal((await api("GET", `/api/v1/user/get/${user.id}`, { token })).status, 401, "old sessions invalidated");
});

test("OTP: expired codes are rejected", async () => {
  const { user } = makeUser();
  await api("POST", "/api/v1/auth/forgot-password", { body: { email: user.email } });
  const otp = otpFromMail();
  prisma.__store.passwordResetOtp[0].expires_at = new Date(Date.now() - 1000);
  assert.equal((await api("POST", "/api/v1/auth/reset-password", { body: { email: user.email, otp, newPassword: "NewPass9word" } })).status, 400);
});

/* ------------------------------ Rate limits ------------------------------ */
test("login is rate limited per account after repeated failures", async () => {
  const { user } = makeUser();
  let last;
  for (let i = 0; i < 11; i++) {
    last = await api("POST", "/api/v1/login", { body: { email: user.email, password: `wrong${i}pass` } });
  }
  assert.equal(last.status, 429);
  assert.ok(last.headers.get("ratelimit") || last.headers.get("ratelimit-policy"), "standard rate-limit headers present");
});

test("forgot-password is rate limited per email", async () => {
  const { user } = makeUser();
  let last;
  for (let i = 0; i < 6; i++) {
    last = await api("POST", "/api/v1/auth/forgot-password", { body: { email: user.email } });
  }
  assert.equal(last.status, 429);
});
