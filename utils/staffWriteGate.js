const prisma = require('../config/database/prismaClient');

/**
 * @returns {Promise<any>}
 */
async function getStaffActor(req) {
  if (!req.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, role: true, is_sub_admin: true, name: true, email: true }
  });
}

const isSuperAdmin = (user) => Boolean(user && user.role === 'admin');

/**
 * Primary admin changes apply immediately. Sub-admin writes are queued for approval.
 * @returns {Promise<any>} null = run normal handler
 */
async function queueIfSubAdmin(req, actionType, payload) {
  const actor = await getStaffActor(req);
  if (!actor) {
    throw new Error('User not found');
  }
  if (isSuperAdmin(actor)) {
    return null;
  }
  if (!actor.is_sub_admin) {
    return null;
  }

  const safePayload = JSON.parse(JSON.stringify(payload ?? {}));
  const row = await prisma.staffPendingAction.create({
    data: {
      submitted_by: actor.id,
      action_type: actionType,
      payload: safePayload,
      status: 'pending'
    }
  });

  return row;
}

module.exports = { getStaffActor, queueIfSubAdmin };
