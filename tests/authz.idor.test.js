const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { prisma, api, stop, resetState, makeUser } = require("./helpers/setup");

beforeEach(resetState);
after(stop);

test("GET /user/get/:id — owner and staff only", async () => {
  const owner = makeUser({ phone: "9000000001" });
  const other = makeUser();
  const staff = makeUser({ role: "ADMIN", is_sub_admin: true });
  prisma.__store.user.forEach((u) => { u.enrollments = []; u._count = { portalRequests: 0, payments: 0, enrollments: 0 }; });

  assert.equal((await api("GET", `/api/v1/user/get/${owner.user.id}`)).status, 401);
  const cross = await api("GET", `/api/v1/user/get/${owner.user.id}`, { token: other.token });
  assert.equal(cross.status, 404);
  assert.equal(cross.text.includes("9000000001"), false);

  const self = await api("GET", `/api/v1/user/get/${owner.user.id}`, { token: owner.token });
  assert.equal(self.status, 200);
  const asStaff = await api("GET", `/api/v1/user/get/${owner.user.id}`, { token: staff.token });
  assert.equal(asStaff.status, 200);
});

test("GET /user/courses/:userId — owner and staff only", async () => {
  const owner = makeUser();
  const other = makeUser();
  prisma.__store.user.forEach((u) => { u.enrollments = []; });
  assert.equal((await api("GET", `/api/v1/user/courses/${owner.user.id}`, { token: other.token })).status, 404);
  assert.equal((await api("GET", `/api/v1/user/courses/${owner.user.id}`, { token: owner.token })).status, 200);
});

const seedRequest = (ownerId) => {
  const req = prisma.seed("portalRequest", {
    userId: ownerId, moduleType: "CLIENT", title: "Secret case", status: "submitted", formData: { note: "confidential" },
    messages: [{ message: "private message" }], files: [{ fileUrl: "https://x/y.pdf" }], user: { name: "Owner", email: "owner@example.com", phone: "9999999999" },
  });
  prisma.seed("portalFile", { requestId: req.id, fileUrl: "https://x/y.pdf", fileName: "y.pdf" });
  return req;
};

test("service requests: unrelated users cannot read, message, upload to or delete", async () => {
  const owner = makeUser({ role: "CLIENT" });
  const other = makeUser({ role: "CLIENT" });
  const staff = makeUser({ role: "ADMIN", is_sub_admin: true });
  const r = seedRequest(owner.user.id);
  const file = prisma.__store.portalFile[0];

  // unauthenticated
  assert.equal((await api("GET", `/api/v1/portal-requests/${r.id}`)).status, 401);

  // unrelated user
  const read = await api("GET", `/api/v1/portal-requests/${r.id}`, { token: other.token });
  assert.equal(read.status, 404);
  assert.equal(read.text.includes("confidential"), false);
  assert.equal((await api("GET", `/api/v1/portal-requests/${r.id}/messages`, { token: other.token })).status, 404);
  assert.equal((await api("POST", `/api/v1/portal-requests/${r.id}/messages`, { token: other.token, body: { message: "hi" } })).status, 404);
  assert.equal((await api("POST", `/api/v1/portal-requests/${r.id}/files/url`, { token: other.token, body: { fileUrl: "https://e.com/a.pdf" } })).status, 404);
  assert.equal((await api("DELETE", `/api/v1/portal-requests/${r.id}/files/${file.id}`, { token: other.token })).status, 404);
  assert.equal((await api("DELETE", `/api/v1/portal-requests/${r.id}`, { token: other.token })).status, 404);
  assert.equal((await api("PATCH", `/api/v1/portal-requests/${r.id}`, { token: other.token, body: { status: "approved" } })).status, 403);
  assert.equal((await api("GET", "/api/v1/portal-requests/admin", { token: other.token })).status, 403);
  assert.equal(prisma.__store.portalRequest.length, 1);
  assert.equal(prisma.__store.portalMessage.length, 0);

  // owner
  assert.equal((await api("GET", `/api/v1/portal-requests/${r.id}`, { token: owner.token })).status, 200);
  const msg = await api("POST", `/api/v1/portal-requests/${r.id}/messages`, { token: owner.token, body: { message: "hello", isAdmin: true } });
  assert.equal(msg.status, 201);
  assert.equal(msg.body.data.isAdmin, false, "isAdmin is derived server-side");

  // staff
  assert.equal((await api("GET", `/api/v1/portal-requests/${r.id}`, { token: staff.token })).status, 200);
  assert.equal((await api("PATCH", `/api/v1/portal-requests/${r.id}`, { token: staff.token, body: { status: "approved" } })).status, 200);
});

test("service requests: javascript: links are rejected for file and meeting links", async () => {
  const owner = makeUser({ role: "CLIENT" });
  const staff = makeUser({ role: "ADMIN" });
  const r = seedRequest(owner.user.id);
  assert.equal((await api("POST", `/api/v1/portal-requests/${r.id}/files/url`, { token: owner.token, body: { fileUrl: "javascript:alert(1)" } })).status, 400);
  assert.equal((await api("PATCH", `/api/v1/portal-requests/${r.id}`, { token: staff.token, body: { meeting_link: "javascript:alert(1)" } })).status, 400);
  assert.equal((await api("PATCH", `/api/v1/portal-requests/${r.id}`, { token: staff.token, body: { status: "<script>" } })).status, 400);
});

test("paid course content requires an active enrollment in an active course", async () => {
  const course = prisma.seed("course", { name: "Paid", description: "d", price: 999, status: "ACTIVE", modules: [], resources: [], assignments: [], announcements: [] });
  const outsider = makeUser();
  const student = makeUser();
  const suspended = makeUser();
  prisma.seed("enrollment", { userId: student.user.id, courseId: course.id, status: "ACTIVE", course: { status: "ACTIVE" } });
  prisma.seed("enrollment", { userId: suspended.user.id, courseId: course.id, status: "INACTIVE", course: { status: "ACTIVE" } });
  prisma.seed("courseResource", { courseId: course.id, title: "Notes", fileUrl: "https://example.com/n.pdf" });
  const resId = prisma.__store.courseResource[0].id;

  assert.equal((await api("GET", `/api/v1/course-content/${course.id}`, { token: outsider.token })).status, 403);
  assert.equal((await api("GET", `/api/v1/course-content/${course.id}`, { token: suspended.token })).status, 403);
  assert.equal((await api("GET", `/api/v1/course-content/${course.id}/resource/${resId}/stream`, { token: outsider.token })).status, 403);
  // body/query cannot redirect the check to another course
  assert.equal((await api("GET", `/api/v1/course-content/${course.id}?courseId=other`, { token: outsider.token })).status, 403);
  assert.equal((await api("GET", `/api/v1/course-content/${course.id}`, { token: student.token })).status, 200);
});

test("public and student course listings hide unpublished courses; staff see them", async () => {
  prisma.seed("course", { name: "Live", description: "d", price: 1, status: "ACTIVE", quizess: [], _count: { enrollments: 0, modules: 0 } });
  prisma.seed("course", { name: "Draft", description: "d", price: 1, status: "DRAFT", quizess: [], _count: { enrollments: 0, modules: 0 } });
  prisma.seed("course", { name: "Old", description: "d", price: 1, status: "INACTIVE", quizess: [], _count: { enrollments: 0, modules: 0 } });
  const student = makeUser();
  const staff = makeUser({ role: "ADMIN", is_sub_admin: true });

  const simple = await api("GET", "/api/v1/getSimpleCourses");
  assert.deepEqual(simple.body.map((c) => c.name), ["Live"]);

  const studentList = await api("GET", "/api/v1/courses/all?status=DRAFT", { token: student.token });
  assert.deepEqual(studentList.body.data.map((c) => c.name), ["Live"]);

  const staffList = await api("GET", "/api/v1/courses/all", { token: staff.token });
  assert.equal(staffList.body.data.length, 3);

  const draftId = prisma.__store.course.find((c) => c.name === "Draft").id;
  assert.equal((await api("GET", `/api/v1/courses/get/${draftId}`, { token: student.token })).status, 404);
  assert.equal((await api("GET", `/api/v1/courses/get/${draftId}`, { token: staff.token })).status, 200);
});

test("admin user listing never returns password hashes", async () => {
  makeUser();
  const admin = makeUser({ role: "ADMIN" });
  prisma.__store.user.forEach((u) => { u.enrollments = []; });
  const res = await api("GET", "/api/v1/user/all", { token: admin.token });
  assert.equal(res.status, 200);
  assert.equal(res.text.includes("$2b$"), false);
  assert.equal(res.body.data.every((u) => u.password === undefined), true);
});
