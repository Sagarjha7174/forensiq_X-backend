const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { prisma, api, stop, resetState, makeUser } = require("./helpers/setup");

beforeEach(resetState);
after(stop);

function seedQuiz({ courseStatus = "ACTIVE" } = {}) {
  const course = prisma.seed("course", { name: "C", description: "d", price: 100, status: courseStatus });
  const questions = [
    { id: "q1", question: "1+1?", options: [], image: null, answer: "OPTION B" },
    { id: "q2", question: "2+2?", options: [], image: null, answer: "OPTION D" },
  ];
  const quiz = prisma.seed("quiz", {
    name: "Quiz", duration: 30, queCount: 2, total: 2, passMark: 1,
    course: [{ id: course.id, status: course.status }],
    questions,
  });
  return { course, quiz };
}

const enroll = (userId, courseId, status = "ACTIVE") =>
  prisma.seed("enrollment", { userId, courseId, status, course: { status: "ACTIVE" } });

test("non-enrolled users cannot load or submit a quiz", async () => {
  const { quiz } = seedQuiz();
  const outsider = makeUser();
  assert.equal((await api("GET", `/api/v1/quiz/get/${quiz.id}`, { token: outsider.token })).status, 403);
  const sub = await api("POST", "/api/v1/quiz/submit", { token: outsider.token, body: { quizId: quiz.id, answers: {} } });
  assert.equal(sub.status, 403);
  assert.equal(prisma.__store.attempt.length, 0, "blank submission must not create an attempt");
});

test("enrolled student gets questions WITHOUT answers plus an attempt token", async () => {
  const { quiz, course } = seedQuiz();
  const s = makeUser();
  enroll(s.user.id, course.id);
  const res = await api("GET", `/api/v1/quiz/get/${quiz.id}`, { token: s.token });
  assert.equal(res.status, 200);
  assert.ok(res.body.attemptToken);
  assert.equal(res.text.includes("OPTION B"), false);
  assert.equal(res.text.includes("OPTION D"), false);
});

test("suspended enrollment or inactive course denies access", async () => {
  const a = seedQuiz();
  const s = makeUser();
  enroll(s.user.id, a.course.id, "INACTIVE");
  assert.equal((await api("GET", `/api/v1/quiz/get/${a.quiz.id}`, { token: s.token })).status, 403);

  const b = seedQuiz({ courseStatus: "INACTIVE" });
  const t = makeUser();
  enroll(t.user.id, b.course.id);
  assert.equal((await api("GET", `/api/v1/quiz/get/${b.quiz.id}`, { token: t.token })).status, 403);
});

test("submission requires a valid attempt token bound to user and quiz; score is server-side", async () => {
  const { quiz, course } = seedQuiz();
  const s = makeUser();
  const other = makeUser();
  enroll(s.user.id, course.id);
  enroll(other.user.id, course.id);

  const noToken = await api("POST", "/api/v1/quiz/submit", { token: s.token, body: { quizId: quiz.id, answers: { q1: "OPTION B" } } });
  assert.equal(noToken.status, 403);

  const otherToken = (await api("GET", `/api/v1/quiz/get/${quiz.id}`, { token: other.token })).body.attemptToken;
  const stolen = await api("POST", "/api/v1/quiz/submit", { token: s.token, body: { quizId: quiz.id, answers: {}, attemptToken: otherToken } });
  assert.equal(stolen.status, 403, "token is bound to the user");

  const expired = jwt.sign({ typ: "quiz_attempt", quizId: quiz.id, sub: s.user.id, startedAt: Date.now() - 3600e3, jti: "x" }, process.env.JWT_SECRET, { expiresIn: -10 });
  assert.equal((await api("POST", "/api/v1/quiz/submit", { token: s.token, body: { quizId: quiz.id, answers: {}, attemptToken: expired } })).status, 403);

  const attemptToken = (await api("GET", `/api/v1/quiz/get/${quiz.id}`, { token: s.token })).body.attemptToken;
  const ok = await api("POST", "/api/v1/quiz/submit", {
    token: s.token,
    body: { quizId: quiz.id, attemptToken, answers: { q1: "OPTION B", q2: "OPTION A", bogus: "OPTION A", score: 99 } },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.score, 1);
  assert.ok(prisma.rawQueries.some((q) => q.sql.includes("pg_advisory_xact_lock")), "submission is serialized");

  const dup = await api("POST", "/api/v1/quiz/submit", { token: s.token, body: { quizId: quiz.id, attemptToken, answers: {} } });
  assert.equal(dup.status, 409, "same attempt token cannot be reused");
  assert.equal(prisma.__store.attempt.length, 1);
});

test("attempt results are private to the attempt owner (and staff)", async () => {
  const owner = makeUser();
  const other = makeUser();
  const staff = makeUser({ role: "ADMIN", is_sub_admin: true });
  const attempt = prisma.seed("attempt", { userId: owner.user.id, quizId: "qz", score: 1, quiz: {}, questionAttempts: [] });
  assert.equal((await api("GET", `/api/v1/quiz/attempt/${attempt.id}`, { token: other.token })).status, 404);
  assert.equal((await api("GET", `/api/v1/quiz/attempt/${attempt.id}`, { token: owner.token })).status, 200);
  assert.equal((await api("GET", `/api/v1/quiz/attempt/${attempt.id}`, { token: staff.token })).status, 200);
});
