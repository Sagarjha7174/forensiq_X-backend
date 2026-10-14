const verifyToken = require("./auth");
const { isStaff, isFullAdmin } = require("../utils/roles");

/** Run verifyToken first when a route forgot to (defence in depth), then `check`. */
const withAuth = (check) => (req, res, next) => {
  if (req.user) return check(req, res, next);
  return verifyToken(req, res, (err) => (err ? next(err) : check(req, res, next)));
};

/**
 * Staff access: ADMIN, SUPERADMIN and sub-admins.
 * Used for admin reads and content management.
 */
const requireStaff = withAuth((req, res, next) => {
  if (isStaff(req.user)) return next();
  return res.status(403).json({ message: "Access denied: insufficient permissions", error: "Forbidden" });
});

/**
 * Full administrator only (ADMIN without is_sub_admin, or SUPERADMIN).
 * Used for user/role management, enrollments, coupons, sub-admins and approvals.
 */
const requireFullAdmin = withAuth((req, res, next) => {
  if (isFullAdmin(req.user)) return next();
  return res.status(403).json({ message: "Access denied: administrator privileges required", error: "Forbidden" });
});

module.exports = requireStaff;
module.exports.requireStaff = requireStaff;
module.exports.requireFullAdmin = requireFullAdmin;
