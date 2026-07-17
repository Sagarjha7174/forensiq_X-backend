const prisma = require('../../config/database/prismaClient');
const { applyStaffAction, cleanupOrphanUploads } = require('../../services/staffActionApplier');

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
    return res.status(500).json({ message: 'Failed to list pending actions', error: error.message });
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
    return res.status(500).json({ message: 'Failed to list history', error: error.message });
  }
};

exports.reviewStaffAction = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, reject_reason: rejectReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }

    const row = await prisma.staffPendingAction.findUnique({ where: { id } });
    if (!row) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (row.status !== 'pending') {
      return res.status(400).json({ message: 'This request was already handled' });
    }

    if (status === 'rejected') {
      await cleanupOrphanUploads(row.payload);
      const updatedRow = await prisma.staffPendingAction.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
          reject_reason: rejectReason || null
        }
      });
      return res.json(updatedRow);
    }

    await applyStaffAction(row);
    const updatedRow = await prisma.staffPendingAction.update({
      where: { id },
      data: {
        status: 'approved',
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
        reject_reason: null
      }
    });

    return res.json(updatedRow);
  } catch (error) {
    console.error('[staffApproval]', error);
    return res.status(500).json({ message: error.message || 'Failed to process request' });
  }
};
