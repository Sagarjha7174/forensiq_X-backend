const prisma = require('../config/database/prismaClient');
const { isFullAdmin, isSubAdmin, isStaff } = require('./roles');

/**
 * Re-load the acting user from the database (authoritative, not JWT claims).
 * @returns {Promise<any>}
 */
async function getStaffActor(req) {
  if (!req.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, role: true, is_sub_admin: true, name: true, email: true, isActive: true }
  });
}

/**
 * Primary (full) admin changes apply immediately. Sub-admin writes are queued for approval.
 * Throws for anyone who is not staff, so the gate can never be used to bypass authorization.
 * @returns {Promise<any>} null = caller should run the normal handler; otherwise the queued row
 */
async function queueIfSubAdmin(req, actionType, payload) {
  const actor = await getStaffActor(req);
  if (!actor || actor.isActive === false || !isStaff(actor)) {
    const err = new Error('Forbidden');
    err.status = 403;
    err.expose = true;
    throw err;
  }

  if (isFullAdmin(actor)) {
    return null;
  }

  if (!isSubAdmin(actor)) {
    const err = new Error('Forbidden');
    err.status = 403;
    err.expose = true;
    throw err;
  }

  const safePayload = JSON.parse(JSON.stringify(payload ?? {}));
  return prisma.staffPendingAction.create({
    data: {
      submitted_by: actor.id,
      action_type: actionType,
      payload: safePayload,
      status: 'pending'
    }
  });
}

module.exports = { getStaffActor, queueIfSubAdmin };
