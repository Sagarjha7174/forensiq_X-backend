const { OAuth2Client } = require("google-auth-library");
const { AppError } = require("./httpErrors");

/**
 * Verifies a Google credential and returns the identity it proves.
 *
 * Accepts either:
 *  - an ID token (JWT from <GoogleLogin/> / One Tap): verified with verifyIdToken —
 *    signature, issuer, expiry and audience are all checked by the library;
 *  - an OAuth access token (from useGoogleLogin implicit flow): verified with Google's
 *    tokeninfo endpoint, and its `aud`/`azp` MUST equal one of our client IDs. Without
 *    this check, a token issued to any other app could be replayed here.
 *
 * In both cases the email must be verified by Google.
 *
 * Allowed audiences: GOOGLE_CLIENT_IDS (comma separated) or GOOGLE_CLIENT_ID.
 */
const getClientIds = () =>
  (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

let client;
const getClient = () => {
  if (!client) client = new OAuth2Client();
  return client;
};

const isVerifiedFlag = (v) => v === true || v === "true";

const verifier = {
  async verifyIdToken(idToken, audiences) {
    const ticket = await getClient().verifyIdToken({ idToken, audience: audiences });
    const p = ticket.getPayload() || {};
    if (!ISSUERS.includes(p.iss)) throw new AppError(401, "Invalid Google token issuer");
    if (p.azp && !audiences.includes(p.azp)) throw new AppError(401, "Google token was issued to a different application");
    return {
      sub: p.sub,
      email: p.email,
      emailVerified: isVerifiedFlag(p.email_verified),
      name: p.name || p.given_name,
      picture: p.picture,
    };
  },

  async verifyAccessToken(accessToken, audiences) {
    const info = await getClient().getTokenInfo(accessToken);
    const audienceOk = audiences.includes(info.aud) || (info.azp && audiences.includes(info.azp));
    if (!audienceOk) throw new AppError(401, "Google token was issued to a different application");
    if (!info.expiry_date || info.expiry_date <= Date.now()) throw new AppError(401, "Google token expired");

    // Profile details (name / picture) come from userinfo; identity fields from tokeninfo.
    let profile = {};
    try {
      const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) profile = await r.json();
    } catch {
      profile = {};
    }
    if (profile.sub && profile.sub !== info.sub) throw new AppError(401, "Inconsistent Google identity");

    return {
      sub: info.sub,
      email: info.email || profile.email,
      emailVerified: isVerifiedFlag(info.email_verified) || isVerifiedFlag(profile.email_verified),
      name: profile.name || profile.given_name,
      picture: profile.picture,
    };
  },
};

const looksLikeJwt = (s) => typeof s === "string" && s.split(".").length === 3 && s.startsWith("eyJ");

/** @returns {Promise<{sub:string,email:string,emailVerified:boolean,name?:string,picture?:string}>} */
async function verifyGoogleCredential(credential) {
  const audiences = getClientIds();
  if (audiences.length === 0) throw new AppError(500, "Google Auth is not configured on backend");
  if (typeof credential !== "string" || credential.length < 20 || credential.length > 4096) {
    throw new AppError(400, "Missing Google credential");
  }

  let identity;
  try {
    identity = looksLikeJwt(credential)
      ? await verifier.verifyIdToken(credential, audiences)
      : await verifier.verifyAccessToken(credential, audiences);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, "Invalid Google credential");
  }

  if (!identity.sub || !identity.email) throw new AppError(401, "Invalid Google user info payload");
  if (!identity.emailVerified) throw new AppError(401, "Your Google email address is not verified");
  return { ...identity, email: String(identity.email).toLowerCase() };
}

module.exports = { verifyGoogleCredential, verifier, getClientIds };
