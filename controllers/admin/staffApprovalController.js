const prisma = require('../../config/database/prismaClient');
const { applyStaffAction, cleanupOrphanUploads } = require('../../services/staffActionApplier');
const { serverError } = require('../../utils/httpErrors');
const logger = require('../../utils/logger');

exports.listPendingStaffActions = async (req, res) => {
  try {
    const rows = await prisma.staffPendingAction.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'asc' },
      include: {
        submitter: { select: { id: true, name: true, email: true } }
      }
    });
    return res.json(rows);
  } catch (error) {
    return serverError(res, error, 'Failed to list pending actions', req);
  }
};

exports.listStaffActionHistory = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await prisma.staffPendingAction.findMany({
      where: { status: { not: 'pending' } },
      orderBy: { reviewed_at: 'desc' },
      take: limit,
      include: {
        submitter: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } }
      }
    });
    return res.json(rows);
  } catch (error) {
    return serverError(res, error, 'Failed to list history', req);
  }
};

exports.reviewStaffAction = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, reject_reason: rejectReason } = req.body || {};

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid request id' });
    }
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }

    const row = await prisma.staffPendingAction.findUnique({ where: { id } });
    if (!row) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (row.submitted_by === req.user.id) {
      return res.status(403).json({ message: 'You cannot review your own request' });
    }
    if (row.status !== 'pending') {
      return res.status(400).json({ message: 'This request was already handled' });
    }

    // Atomically claim the row so concurrent reviewers cannot apply it twice.
    const claimed = await prisma.staffPendingAction.updateMany({
      where: { id, status: 'pending' },
      data: {
        status,
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
        reject_reason: status === 'rejected' ? (typeof rejectReason === 'string' ? rejectReason.slice(0, 2000) : null) : null
      }
    });
    if (claimed.count === 0) {
      return res.status(409).json({ message: 'This request was already handled' });
    }

    if (status === 'rejected') {
      await cleanupOrphanUploads(row.payload);
    } else {
      try {
        await applyStaffAction(row);
      } catch (applyError) {
        // Release the claim so the action can be retried or rejected.
        await prisma.staffPendingAction.update({
          where: { id },
          data: { status: 'pending', reviewed_by: null, reviewed_at: null }
        });
        logger.error('Failed to apply staff action', { requestId: req.id, actionId: id, error: applyError });
        return res.status(422).json({ message: 'The change could not be applied; it is still pending.' });
      }
    }

    const updatedRow = await prisma.staffPendingAction.findUnique({ where: { id } });
    return res.json(updatedRow);
  } catch (error) {
    return serverError(res, error, 'Failed to process request', req);
  }
};
