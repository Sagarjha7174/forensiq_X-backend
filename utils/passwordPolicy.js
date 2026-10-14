/**
 * Password policy for any newly chosen password (registration, reset, change, sub-admin creation).
 *  - 8 to 72 characters (bcrypt only uses the first 72 bytes)
 *  - must contain at least one letter and one digit
 * Existing passwords are not re-validated at login.
 */
const MIN_LENGTH = 8;
const MAX_BYTES = 72;

const validatePassword = (password) => {
  if (typeof password !== "string" || password.length === 0) return "Password is required";
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (Buffer.byteLength(password, "utf8") > MAX_BYTES) return "Password is too long (max 72 bytes)";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain at least one letter and one number";
  }
  return null;
};

module.exports = { validatePassword, MIN_LENGTH };
