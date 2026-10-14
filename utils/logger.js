/**
 * Minimal structured logger with redaction of secrets / credentials / PII-heavy fields.
 * Never log tokens, passwords, OTPs, signatures or full provider payloads.
 */

const SENSITIVE_KEY = /pass(word)?|otp|token|secret|authorization|cookie|signature|api[_-]?key|credential|card|cvv|upi|vpa|session/i;
const MAX_DEPTH = 5;

const redact = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: value.code };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
};

const write = (level, message, meta) => {
  if (process.env.NODE_ENV === "test" && !process.env.LOG_IN_TESTS) return;
  const entry = { level, time: new Date().toISOString(), message };
  if (meta !== undefined) entry.meta = redact(meta);
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

module.exports = {
  redact,
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};
