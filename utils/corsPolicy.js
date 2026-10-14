const { getFrontendUrls } = require("./frontendUrls");
const logger = require("./logger");

/**
 * Exact-match CORS allowlist. Origins are compared as normalized `scheme://host[:port]`
 * strings; substring / suffix matching is intentionally not supported.
 *
 * Sources:
 *  - FRONTEND_URLS / FRONTEND_URL / FRONTEND_URL_1 / FRONTEND_URL_2 (comma separated)
 *  - CORS_ALLOWED_ORIGINS (comma separated; e.g. specific Vercel preview URLs)
 *  - Built-in production domains below
 *  - http://localhost:3000 and http://127.0.0.1:3000 when NODE_ENV !== "production"
 */
const DEFAULT_PRODUCTION_ORIGINS = [
  "https://forensiq.in",
  "https://www.forensiq.in",
  "https://forensiq.sagarjha.in",
];
const DEVELOPMENT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

const normalizeOrigin = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin; // scheme://host[:port], default ports dropped, lowercase host
  } catch {
    return null;
  }
};

const getAllowedOrigins = () => {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS || "").split(",");
  const list = [...DEFAULT_PRODUCTION_ORIGINS, ...getFrontendUrls(), ...fromEnv];
  if (process.env.NODE_ENV !== "production") list.push(...DEVELOPMENT_ORIGINS);
  return new Set(list.map(normalizeOrigin).filter(Boolean));
};

const isOriginAllowed = (origin, allowed = getAllowedOrigins()) => {
  const normalized = normalizeOrigin(origin);
  // Compare against the raw header too, so "https://forensiq.in/" or odd casing is not
  // silently accepted as a different spelling of an allowed origin.
  return Boolean(normalized) && normalized === origin && allowed.has(normalized);
};

const buildCorsOptions = () => {
  const allowed = getAllowedOrigins();
  return {
    origin(origin, callback) {
      // No Origin header: same-origin, server-to-server, curl, webhooks. CORS does not apply.
      if (!origin) return callback(null, true);
      if (isOriginAllowed(origin, allowed)) return callback(null, true);
      logger.warn("CORS origin rejected", { origin });
      return callback(null, false); // no CORS headers -> browser blocks the response
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy", "Retry-After"],
    credentials: true,
    maxAge: 600,
  };
};

module.exports = { buildCorsOptions, isOriginAllowed, getAllowedOrigins, normalizeOrigin };
