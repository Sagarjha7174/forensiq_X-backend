const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { prisma, api, stop, resetState, makeUser, DEFAULT_PASSWORD } = require("./helpers/setup");

beforeEach(resetState);
after(stop);

const register = (overrides = {}) =>
  api("POST", "/api/v1/register", {
    body: { email: `u${Math.random().toString(36).slice(2)}@example.com`, name: "New User", password: "Str0ngPassw0rd", phone: "9876543210", ...overrides },
  });

for (const role of ["ADMIN", "admin", "SUPERADMIN", "SubAdmin", "SUBADMIN", "ROOT", "STAFF", " Admin "]) {
  test(`registration rejects privileged/unknown role "${role}"`, async () => {
    const res = await register({ role });
    assert.equal(res.status, 400);
    assert.equal(prisma.__store.user.length, 0, "no account must be created");
  });
}

test("registration cannot set is_sub_admin via extra fields", async () => {
  const res = await register({ role: "STUDENT", is_sub_admin: true, isVerified: true });
  assert.equal(res.status, 201);
  const [u] = prisma.__store.user;
  assert.equal(u.is_sub_admin, false);
  assert.equal(u.role, "STUDENT");
});

for (const role of ["STUDENT", "client", "Institution", "PROFESSIONAL", "member"]) {
  test(`registration accepts public role "${role}"`, async () => {
    const res = await register({ role });
    assert.equal(res.status, 201);
    assert.equal(prisma.__store.user[0].role, role.toUpperCase());
    assert.equal(res.body.password, undefined, "hash never returned");
  });
}

test("registration defaults to STUDENT when role omitted", async () => {
  const res = await register({});
  assert.equal(res.status, 201);
  assert.equal(prisma.__store.user[0].role, "STUDENT");
});

test("registration enforces password policy", async () => {
  for (const password of ["short1", "allletterslong", "12345678901"]) {
    const res = await register({ password });
    assert.equal(res.status, 400, password);
  }
  assert.equal(prisma.__store.user.length, 0);
});

test("login: unknown email and wrong password return the same generic error", async () => {
  const { user } = makeUser();
  const a = await api("POST", "/api/v1/login", { body: { email: "nobody@example.com", password: "whatever1" } });
  const b = await api("POST", "/api/v1/login", { body: { email: user.email, password: "wrongpass1" } });
  const g = makeUser({ password: null, auth_provider: "google" }).user;
  const c = await api("POST", "/api/v1/login", { body: { email: g.email, password: "whatever1" } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(c.status, 401);
  assert.equal(a.body.error, b.body.error);
  assert.equal(a.body.error, c.body.error, "Google-only accounts must not be distinguishable");
});

test("login succeeds with correct password and the token carries no privilege the DB lacks", async () => {
  const { user } = makeUser();
  const res = await api("POST", "/api/v1/login", { body: { email: user.email.toUpperCase(), password: DEFAULT_PASSWORD } });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, "STUDENT");
});

test("login rejects blocked accounts", async () => {
  const { user } = makeUser({ accountStatus: "BLOCKED" });
  const res = await api("POST", "/api/v1/login", { body: { email: user.email, password: DEFAULT_PASSWORD } });
  assert.equal(res.status, 401);
});
