const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { clientRole, isSubAdmin } = require("./roles");

const TOKEN_TTL = "24h";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
};

/**
 * Fingerprint of the user's current password hash. Embedded in the JWT so that any
 * password change/reset invalidates previously issued tokens without a schema change.
 */
const passwordFingerprint = (user) =>
  crypto
    .createHmac("sha256", getJwtSecret())
    .update(`pwv:${user?.password || "none"}`)
    .digest("base64url")
    .slice(0, 16);

/** Issue an access token. Role claims are informational only (UI); the API re-reads the DB. */
const signAuthToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      role: clientRole(user),
      userName: user.name,
      profileCompleted: user.profileCompleted ?? true,
      is_sub_admin: isSubAdmin(user),
      pwv: passwordFingerprint(user),
    },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL, algorithm: "HS256" }
  );

const verifyAuthToken = (token) => jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });

module.exports = { signAuthToken, verifyAuthToken, passwordFingerprint, getJwtSecret };
