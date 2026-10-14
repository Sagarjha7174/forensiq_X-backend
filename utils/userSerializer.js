/** Fields that must never leave the server. */
const PRIVATE_USER_FIELDS = ["password", "google_id"];

/** Strip credentials / internal identifiers from a user record before sending it to a client. */
const toSafeUser = (user) => {
  if (!user || typeof user !== "object") return user;
  const copy = { ...user };
  for (const field of PRIVATE_USER_FIELDS) delete copy[field];
  return copy;
};

module.exports = { toSafeUser, PRIVATE_USER_FIELDS };
