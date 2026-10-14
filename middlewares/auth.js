const prisma = require("../config/database/prismaClient");
const { verifyAuthToken, passwordFingerprint } = require("../utils/authToken");
const logger = require("../utils/logger");

const extractBearerToken = (req) => {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  return token.trim();
};

const isAccountUsable = (user) =>
  Boolean(user) && user.isActive !== false && user.accountStatus !== "BLOCKED";

/**
 * Authenticates the request and loads the authoritative user record from the database.
 * Role / privilege decisions downstream must use req.user (DB state), never JWT claims.
 */
async function verifyToken(req, res, next) {
  if (req.user) return next(); // already authenticated earlier in the chain

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  let decoded;
  try {
    decoded = verifyAuthToken(token);
  } catch {
    return res.status(401).json({ error: "Token invalid or expired" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!isAccountUsable(user)) {
      return res.status(403).json({ error: "Forbidden: User not found or inactive" });
    }

    // Tokens issued before the last password change are rejected.
    // Legacy tokens without a fingerprint remain valid until they expire (max 24h).
    if (decoded.pwv && decoded.pwv !== passwordFingerprint(user)) {
      return res.status(401).json({ error: "Token invalid or expired" });
    }

    req.user = user;
    return next();
  } catch (err) {
    logger.error("verifyToken: failed to load user", { requestId: req.id, error: err });
    return res.status(500).json({ error: "Internal server error during authentication" });
  }
}

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.extractBearerToken = extractBearerToken;
module.exports.isAccountUsable = isAccountUsable;
