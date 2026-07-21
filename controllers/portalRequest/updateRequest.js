const prisma = require("../../config/database/prismaClient");

const updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, meeting_date, meeting_time, meeting_link } = req.body;
    
    // Check admin role
    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin' || Boolean(req.user?.is_sub_admin);
    
    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const dataToUpdate = {};
    if (status) dataToUpdate.status = status;
    if (admin_notes !== undefined) dataToUpdate.admin_notes = admin_notes;
    if (meeting_date) dataToUpdate.meeting_date = meeting_date;
    if (meeting_time) dataToUpdate.meeting_time = meeting_time;
    if (meeting_link) dataToUpdate.meeting_link = meeting_link;

    const updatedRequest = await prisma.portalRequest.update({
      where: { id },
      data: dataToUpdate
    });

    res.status(200).json({
      message: "Request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).json({ error: "Failed to update request" });
  }
};

module.exports = { updateRequest };
