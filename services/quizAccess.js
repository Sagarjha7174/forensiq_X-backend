const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const prisma = require("../config/database/prismaClient");
const { isStaff } = require("../utils/roles");
const { getJwtSecret } = require("../utils/authToken");

/**
 * Quiz eligibility + attempt tokens.
 *
 * A student may view/submit a quiz only with an ACTIVE enrollment in an ACTIVE course
 * that contains the quiz. Viewing a quiz issues a signed, short-lived attempt token
 * bound to (user, quiz, start time). Submissions must present it, which enforces the
 * time limit server-side (duration + grace) and allows exactly one submission per token.
 */
const SUBMIT_GRACE_SECONDS = 10 * 60; // page load / instructions / network latency
const VALID_ANSWERS = new Set(["OPTION A", "OPTION B", "OPTION C", "OPTION D"]);

async function hasQuizAccess(user, quizId) {
  if (!user || typeof quizId !== "string") return { quiz: null, allowed: false };
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, duration: true, queCount: true, course: { select: { id: true, status: true } } },
  });
  if (!quiz) return { quiz: null, allowed: false };
  if (isStaff(user)) return { quiz, allowed: true };

  const activeCourseIds = quiz.course.filter((c) => c.status === "ACTIVE").map((c) => c.id);
  if (activeCourseIds.length === 0) return { quiz, allowed: false };

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: user.id, courseId: { in: activeCourseIds }, status: "ACTIVE" },
    select: { id: true },
  });
  return { quiz, allowed: Boolean(enrollment) };
}

function issueAttemptToken(userId, quiz) {
  const durationSeconds = Math.max(1, Number(quiz.duration) || 0) * 60;
  return jwt.sign(
    { typ: "quiz_attempt", quizId: quiz.id, sub: userId, startedAt: Date.now(), jti: crypto.randomUUID() },
    getJwtSecret(),
    { expiresIn: durationSeconds + SUBMIT_GRACE_SECONDS, algorithm: "HS256" }
  );
}

/** @returns {{ startedAt: number, jti: string } | null} */
function verifyAttemptToken(token, userId, quizId) {
  if (typeof token !== "string" || !token) return null;
  try {
    const p = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (p.typ !== "quiz_attempt" || p.sub !== userId || p.quizId !== quizId) return null;
    return { startedAt: Number(p.startedAt), jti: p.jti };
  } catch {
    return null;
  }
}

/** Keep only answers for real questions with a valid option value. */
function sanitizeAnswers(answers, questionIds) {
  const out = {};
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return out;
  for (const id of questionIds) {
    const v = answers[id];
    if (typeof v === "string" && VALID_ANSWERS.has(v)) out[id] = v;
  }
  return out;
}

module.exports = { hasQuizAccess, issueAttemptToken, verifyAttemptToken, sanitizeAnswers, SUBMIT_GRACE_SECONDS };
