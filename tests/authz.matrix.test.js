const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { prisma, api, stop, resetState, makeUser, signAuthToken } = require("./helpers/setup");

beforeEach(resetState);
after(stop);

const actors = () => ({
  student: makeUser({ role: "STUDENT" }),
  subAdmin: makeUser({ role: "ADMIN", is_sub_admin: true }),
  admin: makeUser({ role: "ADMIN", is_sub_admin: false }),
  superAdmin: makeUser({ role: "SUPERADMIN" }),
});

test("JWT role claims are ignored: a student token claiming ADMIN is still a student", async () => {
  const { user } = makeUser({ role: "STUDENT" });
  const forged = jwt.sign({ id: user.id, role: "ADMIN", is_sub_admin: false }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const res = await api("GET", "/api/v1/user/all", { token: forged });
  assert.equal(res.status, 403);
});

test("tokens signed with another secret are rejected", async () => {
  const { user } = makeUser({ role: "ADMIN" });
  const forged = jwt.sign({ id: user.id }, "attacker-secret");
  const res = await api("GET", "/api/v1/user/all", { token: forged });
  assert.equal(res.status, 401);
});

test("full-admin-only endpoints: sub-admin and student are denied, admin allowed", async () => {
  const a = actors();
  const target = makeUser({ role: "STUDENT" }).user;
  const course = prisma.seed("course", { name: "C", description: "d", price: 100, status: "ACTIVE" });

  const cases = [
    ["GET", "/api/v1/user/all", undefined],
    ["PATCH", `/api/v1/user/update/${target.id}`, { name: "x" }],
    ["PATCH", `/api/v1/user/block/${target.id}`, undefined],
    ["GET", "/api/v1/admin/sub-admins", undefined],
    ["POST", "/api/v1/admin/sub-admins", { email: "new@example.com", first_name: "N", password: "Str0ngPassw0rd" }],
    ["GET", "/api/v1/admin/staff-actions/pending", undefined],
    ["POST", "/api/v1/enrollments", { userIds: [target.id], courseId: course.id }],
    ["POST", "/api/v1/admin/coupons", { code: "SAVE10", title: "t", discountType: "PERCENTAGE", discountValue: 10 }],
  ];

  for (const [method, url, body] of cases) {
    for (const who of ["student", "subAdmin"]) {
      const res = await api(method, url, { token: a[who].token, body });
      assert.equal(res.status, 403, `${who} must be denied ${method} ${url} (got ${res.status})`);
    }
    const res = await api(method, url, { token: a.admin.token, body });
    assert.ok(res.status < 400, `admin should be allowed ${method} ${url} (got ${res.status} ${res.text})`);
  }
});

test("staff (incl. sub-admin) may use content endpoints; students may not", async () => {
  const a = actors();
  for (const who of ["subAdmin", "admin"]) {
    const res = await api("POST", "/api/v1/blogs/create", { token: a[who].token, body: { title: "T", content: "C", author: "A" } });
    assert.equal(res.status, 201, who);
    const coupons = await api("GET", "/api/v1/admin/coupons", { token: a[who].token });
    assert.equal(coupons.status, 200, who);
  }
  const res = await api("POST", "/api/v1/blogs/create", { token: a.student.token, body: { title: "T", content: "C", author: "A" } });
  assert.equal(res.status, 403);
});

test("updateUser never assigns privileged roles and cannot touch staff / self", async () => {
  const a = actors();
  const student = makeUser({ role: "STUDENT" }).user;

  for (const role of ["ADMIN", "SUPERADMIN", "SUBADMIN"]) {
    const res = await api("PATCH", `/api/v1/user/update/${student.id}`, { token: a.admin.token, body: { role } });
    assert.equal(res.status, 403, role);
  }
  const ok = await api("PATCH", `/api/v1/user/update/${student.id}`, { token: a.admin.token, body: { role: "CLIENT" } });
  assert.equal(ok.status, 200);
  assert.equal(prisma.__store.user.find((u) => u.id === student.id).role, "CLIENT");

  const self = await api("PATCH", `/api/v1/user/update/${a.admin.user.id}`, { token: a.admin.token, body: { name: "me" } });
  assert.equal(self.status, 403, "no self-modification via admin endpoint");

  const otherAdmin = makeUser({ role: "ADMIN" }).user;
  const peer = await api("PATCH", `/api/v1/user/update/${otherAdmin.id}`, { token: a.admin.token, body: { isActive: false } });
  assert.equal(peer.status, 403, "full admins cannot modify other full admins");

  const sup = await api("PATCH", `/api/v1/user/update/${otherAdmin.id}`, { token: a.superAdmin.token, body: { isActive: false } });
  assert.equal(sup.status, 200, "superadmin can manage full admins");

  const flags = await api("PATCH", `/api/v1/user/update/${student.id}`, { token: a.admin.token, body: { is_sub_admin: true } });
  assert.equal(flags.status, 400, "unknown/privileged fields are rejected");
});

test("sub-admin network writes are queued and cannot be self-approved", async () => {
  const a = actors();
  const queued = await api("POST", "/api/v1/network/events", { token: a.subAdmin.token, body: { title: "Meetup", date: "2030-01-01" } });
  assert.equal(queued.status, 202);
  assert.equal(prisma.__store.networkEvent.length, 0);

  const id = queued.body.request_id;
  const selfApprove = await api("PATCH", `/api/v1/admin/staff-actions/${id}`, { token: a.subAdmin.token, body: { status: "approved" } });
  assert.equal(selfApprove.status, 403);

  const approve = await api("PATCH", `/api/v1/admin/staff-actions/${id}`, { token: a.admin.token, body: { status: "approved" } });
  assert.equal(approve.status, 200);
  assert.equal(prisma.__store.networkEvent.length, 1);

  const again = await api("PATCH", `/api/v1/admin/staff-actions/${id}`, { token: a.admin.token, body: { status: "approved" } });
  assert.equal(again.status, 400, "cannot be applied twice");
  assert.equal(prisma.__store.networkEvent.length, 1);
});

test("an admin cannot approve an action they submitted themselves", async () => {
  const a = actors();
  const row = prisma.seed("staffPendingAction", { submitted_by: a.admin.user.id, action_type: "network.delete_event", payload: { id: 1 }, status: "pending", id: 77 });
  const res = await api("PATCH", `/api/v1/admin/staff-actions/${row.id}`, { token: a.admin.token, body: { status: "approved" } });
  assert.equal(res.status, 403);
});

test("deactivated users are rejected even with a valid token", async () => {
  const { user, token } = makeUser();
  prisma.__store.user.find((u) => u.id === user.id).isActive = false;
  const res = await api("GET", `/api/v1/user/get/${user.id}`, { token });
  assert.equal(res.status, 403);
});

test("password change invalidates previously issued tokens", async () => {
  const { user, token } = makeUser();
  const res = await api("PUT", "/api/v1/user/change-password", { token, body: { currentPassword: "Correct1pass", newPassword: "Brand9NewPass" } });
  assert.equal(res.status, 200);
  assert.ok(res.body.token, "fresh token returned");
  const old = await api("GET", `/api/v1/user/get/${user.id}`, { token });
  assert.equal(old.status, 401, "old token no longer valid");
  const fresh = await api("GET", `/api/v1/user/get/${user.id}`, { token: res.body.token });
  assert.equal(fresh.status, 200);
  // legacy tokens without fingerprint still work until expiry (documented)
  const legacy = jwt.sign({ id: user.id, role: "STUDENT" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  assert.equal((await api("GET", `/api/v1/user/get/${user.id}`, { token: legacy })).status, 200);
  assert.ok(signAuthToken);
});
