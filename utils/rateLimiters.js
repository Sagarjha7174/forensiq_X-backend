const { rateLimit, ipKeyGenerator, MemoryStore, MINUTE, HOUR } = require("express-rate-limit");

/**
 * Rate limiters for abuse-prone endpoints.
 *
 * Store: in-process MemoryStore. This is effective for a single long-running instance.
 * For multi-instance or serverless deployments, plug a shared store (e.g. rate-limit-redis)
 * into `makeStore` — see SECURITY_REMEDIATION_REPORT.md. OTP brute-force protection does
 * NOT rely on this alone: reset attempts are also counted in the database.
 */
const stores = [];
const makeStore = () => {
  const store = new MemoryStore();
  stores.push(store);
  return store;
};

const ipKey = (req) => ipKeyGenerator(req.ip || "unknown");
const emailKey = (req) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  return email ? `email:${email}` : `ip:${ipKey(req)}`;
};
const userKey = (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${ipKey(req)}`);

const tooMany = (message) => (req, res, _next, options) =>
  res.status(options.statusCode).json({ error: message, message });

const limiter = ({ windowMs, limit, keyGenerator = ipKey, message, ...rest }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: makeStore(),
    handler: tooMany(message || "Too many requests, please try again later."),
    ...rest,
  });

const limiters = {
  // Broad safety net for the whole API.
  global: limiter({ windowMs: 15 * MINUTE, limit: 1000, message: "Too many requests, please slow down." }),

  loginByIp: limiter({ windowMs: 15 * MINUTE, limit: 30, message: "Too many login attempts. Try again later." }),
  // Failed logins per account; successful logins do not count.
  loginByEmail: limiter({
    windowMs: 15 * MINUTE, limit: 10, keyGenerator: emailKey, skipSuccessfulRequests: true,
    message: "Too many login attempts for this account. Try again in 15 minutes.",
  }),
  register: limiter({ windowMs: HOUR, limit: 10, message: "Too many sign-up attempts. Try again later." }),
  googleAuth: limiter({ windowMs: 15 * MINUTE, limit: 30, message: "Too many sign-in attempts. Try again later." }),
  completeProfile: limiter({ windowMs: 15 * MINUTE, limit: 20, keyGenerator: userKey }),

  forgotPasswordByIp: limiter({ windowMs: 15 * MINUTE, limit: 10, message: "Too many reset requests. Try again later." }),
  forgotPasswordByEmail: limiter({ windowMs: HOUR, limit: 5, keyGenerator: emailKey, message: "Too many reset requests. Try again later." }),
  resetPasswordByIp: limiter({ windowMs: 15 * MINUTE, limit: 20, message: "Too many attempts. Try again later." }),
  resetPasswordByEmail: limiter({ windowMs: HOUR, limit: 15, keyGenerator: emailKey, message: "Too many attempts. Try again later." }),

  passwordChange: limiter({ windowMs: 15 * MINUTE, limit: 10, keyGenerator: userKey }),
  adminVerifyPassword: limiter({ windowMs: 15 * MINUTE, limit: 10, keyGenerator: userKey }),
  upload: limiter({ windowMs: HOUR, limit: 100, keyGenerator: userKey, message: "Upload limit reached. Try again later." }),
  payment: limiter({ windowMs: 15 * MINUTE, limit: 30, keyGenerator: userKey }),
  couponValidate: limiter({ windowMs: 15 * MINUTE, limit: 30, keyGenerator: userKey }),
  quizSubmit: limiter({ windowMs: 15 * MINUTE, limit: 30, keyGenerator: userKey }),
  messages: limiter({ windowMs: 15 * MINUTE, limit: 120, keyGenerator: userKey }),
  webhook: limiter({ windowMs: MINUTE, limit: 300 }),
};

/** Test helper: clear all counters. */
const resetAllLimiters = async () => {
  await Promise.all(stores.map((s) => s.resetAll()));
};

module.exports = { limiters, resetAllLimiters };
