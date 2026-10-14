const crypto = require("crypto");
const logger = require("./logger");

/** Error carrying a safe, client-facing message and HTTP status. */
class AppError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.expose = true;
    if (extra) this.extra = extra;
  }
}

/** Attach a correlation id to every request (honours a sane inbound X-Request-Id). */
const requestId = (req, res, next) => {
  const inbound = req.get("x-request-id");
  req.id = inbound && /^[A-Za-z0-9._-]{8,64}$/.test(inbound) ? inbound : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
};

/**
 * Send a safe 500 for unexpected errors and log the details server-side.
 * Use from controllers' catch blocks: `return serverError(res, err, "Failed to x", req)`.
 */
const serverError = (res, err, publicMessage = "Internal server error", req) => {
  if (err && (err instanceof AppError || err.expose) && err.status) {
    if (res.headersSent) return undefined;
    return res.status(err.status).json({ error: err.message, message: err.message });
  }
  logger.error(publicMessage, { requestId: req?.id, path: req?.originalUrl, error: err });
  if (res.headersSent) return undefined;
  return res.status(500).json({ error: publicMessage, message: publicMessage, requestId: req?.id });
};

/** Map well-known Prisma errors to safe client responses. */
const prismaErrorStatus = (err) => {
  switch (err?.code) {
    case "P2002": return [409, "A record with these details already exists"];
    case "P2025": return [404, "Record not found"];
    case "P2003": return [409, "Operation conflicts with related records"];
    default: return null;
  }
};

/**
 * Safe catch-all for controllers: maps Prisma validation / known errors to 4xx with generic
 * messages and everything else to a logged 500. Never returns raw exception text.
 */
const handleControllerError = (res, err, req, fallbackMessage = "Request failed") => {
  if (err && (err instanceof AppError || err.expose) && err.status) return serverError(res, err, fallbackMessage, req);
  const mapped = prismaErrorStatus(err);
  if (mapped) return res.status(mapped[0]).json({ error: mapped[1], message: mapped[1] });
  if (err?.name === "PrismaClientValidationError") {
    return res.status(400).json({ error: "Invalid request data", message: "Invalid request data" });
  }
  return serverError(res, err, fallbackMessage, req);
};

/* eslint-disable no-unused-vars */
const errorHandler = (err, req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }
  if (err instanceof AppError || err?.expose) {
    const status = err.status || err.statusCode || 400;
    return res.status(status).json({ error: err.message, message: err.message, ...(err.extra || {}) });
  }
  const mapped = prismaErrorStatus(err);
  if (mapped) {
    return res.status(mapped[0]).json({ error: mapped[1], message: mapped[1] });
  }
  return serverError(res, err, "Internal server error", req);
};

const notFoundHandler = (req, res) => res.status(404).json({ error: "Not found" });

module.exports = { AppError, requestId, serverError, handleControllerError, errorHandler, notFoundHandler, prismaErrorStatus };
