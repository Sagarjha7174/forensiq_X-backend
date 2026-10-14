/**
 * Test bootstrap: isolated env, in-memory Prisma, no network side effects.
 * Never point tests at a real database or payment provider.
 */
const path = require("path");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
process.env.CASHFREE_APP_ID = "test-app-id";
process.env.CASHFREE_SECRET_KEY = "test-cashfree-secret";
process.env.GOOGLE_CLIENT_ID = "our-client-id.apps.googleusercontent.com";
process.env.FRONTEND_URLS = "https://app.forensiq.example";
process.env.DB_URL = "postgresql://invalid:invalid@127.0.0.1:1/none";
process.env.TRUST_PROXY = "0";

const { createFakePrisma } = require("./fakePrisma");
const prisma = createFakePrisma();
global.__prisma = prisma;

// Outbound email: record calls instead of sending.
const sentMail = [];
const mailPath = require.resolve(path.join(__dirname, "../../utils/mailService"));
const mailStub = new Proxy({}, {
  get: (_t, name) => async (args) => { sentMail.push({ name, args }); },
});
require.cache[mailPath] = { id: mailPath, filename: mailPath, loaded: true, exports: mailStub };

// Cloudinary: never upload.
const cloudinary = require("cloudinary").v2;
const uploads = [];
cloudinary.uploader.upload = async (filePath, options) => {
  uploads.push({ filePath, options });
  return { secure_url: "https://res.cloudinary.com/demo/raw/upload/v1/test-file", public_id: "test-file", resource_type: "raw", bytes: 10 };
};

const app = require("../../index");
const { signAuthToken } = require("../../utils/authToken");
const { resetAllLimiters } = require("../../utils/rateLimiters");

let server;
let baseUrl;
async function start() {
  if (server) return baseUrl;
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}
async function stop() {
  if (server) await new Promise((r) => server.close(r));
  server = null;
}

/** JSON request helper. */
async function api(method, url, { token, body, headers = {} } = {}) {
  const base = await start();
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, body: json, text, headers: res.headers };
}

const bcrypt = require("bcrypt");
const DEFAULT_PASSWORD = "Correct1pass";
const DEFAULT_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 4);

/** Seed a user and return { user, token }. Default password: DEFAULT_PASSWORD. */
function makeUser(overrides = {}) {
  const user = prisma.seed("user", {
    email: `${Math.random().toString(36).slice(2)}@example.com`,
    name: "Test User",
    password: DEFAULT_HASH,
    phone: null,
    isActive: true,
    accountStatus: "ACTIVE",
    role: "STUDENT",
    is_sub_admin: false,
    profileCompleted: true,
    auth_provider: "email",
    // relation placeholders (the fake does not resolve relations)
    enrollments: [],
    _count: { portalRequests: 0, payments: 0, enrollments: 0 },
    ...overrides,
  });
  return { user, token: signAuthToken(user) };
}

async function resetState() {
  prisma.reset();
  sentMail.length = 0;
  uploads.length = 0;
  await resetAllLimiters();
}

module.exports = { DEFAULT_PASSWORD, prisma, api, start, stop, makeUser, resetState, sentMail, uploads, signAuthToken };
