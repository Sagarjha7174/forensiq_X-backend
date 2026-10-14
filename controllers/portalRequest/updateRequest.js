const prisma = require("../../config/database/prismaClient");
const { isStaff, REQUEST_STATUSES } = require("../../utils/portalAccess");
const { safeUrl } = require("../../utils/sanitize");
const { serverError } = require("../../utils/httpErrors");

const shortText = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

const updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, meeting_date, meeting_time, meeting_link } = req.body || {};

    // Only staff can update request workflow fields.
    if (!isStaff(req.user)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const dataToUpdate = {};
    if (status !== undefined) {
      if (!REQUEST_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      dataToUpdate.status = status;
    }
    if (admin_notes !== undefined) {
      if (admin_notes !== null && typeof admin_notes !== "string") return res.status(400).json({ error: "Invalid admin_notes" });
      dataToUpdate.admin_notes = admin_notes === null ? null : admin_notes.slice(0, 10000);
    }
    if (meeting_date) dataToUpdate.meeting_date = shortText(meeting_date, 40);
    if (meeting_time) dataToUpdate.meeting_time = shortText(meeting_time, 40);
    if (meeting_link) {
      // Rendered as a clickable link for the client: http(s) only.
      try {
        dataToUpdate.meeting_link = safeUrl(meeting_link, "meeting_link");
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }

    const updatedRequest = await prisma.portalRequest.update({
      where: { id },
      data: dataToUpdate
    });

    return res.status(200).json({
      message: "Request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Request not found" });
    return serverError(res, error, "Failed to update request", req);
  }
};

module.exports = { updateRequest };
