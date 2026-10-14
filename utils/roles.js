/**
 * Central role / permission model.
 *
 * Roles are stored as uppercase strings on User.role. Sub-admins are stored as
 * role "ADMIN" with is_sub_admin = true (legacy rows may also carry role "SUBADMIN").
 *
 *  - Public roles: may be self-assigned at registration / Google sign-up.
 *  - Staff: ADMIN, SUPERADMIN and sub-admins. May read admin data and manage content.
 *  - Full admin: ADMIN (not a sub-admin) or SUPERADMIN. Only full admins may manage
 *    users, roles, enrollments, coupons, sub-admins and the approval queue.
 *
 * Authorization must always be derived from the database user loaded by verifyToken
 * (req.user), never from JWT claims or client-supplied data.
 */

const PUBLIC_ROLES = Object.freeze(["STUDENT", "CLIENT", "INSTITUTION", "PROFESSIONAL", "MEMBER"]);
const PRIVILEGED_ROLES = Object.freeze(["ADMIN", "SUPERADMIN", "SUBADMIN"]);

const normalizeRole = (role) => (typeof role === "string" ? role.trim().toUpperCase() : "");

const isPublicRole = (role) => PUBLIC_ROLES.includes(normalizeRole(role));

const isSubAdmin = (user) =>
  Boolean(user) && (Boolean(user.is_sub_admin) || normalizeRole(user.role) === "SUBADMIN");

const isStaff = (user) =>
  Boolean(user) && (PRIVILEGED_ROLES.includes(normalizeRole(user.role)) || Boolean(user.is_sub_admin));

const isFullAdmin = (user) => {
  if (!user || isSubAdmin(user)) return false;
  const role = normalizeRole(user.role);
  return role === "ADMIN" || role === "SUPERADMIN";
};

const isSuperAdmin = (user) => !isSubAdmin(user) && normalizeRole(user?.role) === "SUPERADMIN";

/** Role value exposed to clients (JWT / login response). */
const clientRole = (user) => (isSubAdmin(user) ? "SUBADMIN" : normalizeRole(user?.role) || "STUDENT");

/** True when `user` may read/act on a resource owned by `ownerId`. */
const canAccessOwnedResource = (user, ownerId) =>
  Boolean(user) && (user.id === ownerId || isStaff(user));

/**
 * Whether `actor` (already verified as a full admin) may modify / block / delete `target`.
 *  - nobody manages their own account through admin endpoints (no self-escalation / lock-out)
 *  - full administrators and SUPERADMINs can only be managed by a SUPERADMIN
 *  - sub-admins and public users can be managed by any full administrator
 */
const canManageUser = (actor, target) => {
  if (!actor || !target || !isFullAdmin(actor)) return false;
  if (actor.id === target.id) return false;
  if (isFullAdmin(target)) return isSuperAdmin(actor) && !isSuperAdmin(target);
  return true;
};

module.exports = {
  canManageUser,
  PUBLIC_ROLES,
  PRIVILEGED_ROLES,
  normalizeRole,
  isPublicRole,
  isSubAdmin,
  isStaff,
  isFullAdmin,
  isSuperAdmin,
  clientRole,
  canAccessOwnedResource,
};
