const express = require("express");
const router = express.Router();

const { createRequest } = require("../controllers/portalRequest/createRequest");
const { getMyRequests } = require("../controllers/portalRequest/getMyRequests");
const { getAllRequests } = require("../controllers/portalRequest/getAllRequests");
const { getRequestById } = require("../controllers/portalRequest/getRequestById");
const { updateRequest } = require("../controllers/portalRequest/updateRequest");
const { addMessage } = require("../controllers/portalRequest/addMessage");
const { getMessages } = require("../controllers/portalRequest/getMessages");
const { uploadFile } = require("../controllers/portalRequest/uploadFile");
const { addFileUrl } = require("../controllers/portalRequest/addFileUrl");
const prisma = require("../config/database/prismaClient");
const { findAccessibleRequest, notFound, isStaff } = require("../utils/portalAccess");
const { requireStaff } = require("../middlewares/checkAdmin");
const { serverError } = require("../utils/httpErrors");
const { limiters } = require("../utils/rateLimiters");

// Base path will be /api/v1/portal-requests

router.post("/", createRequest);
router.get("/my", getMyRequests);
router.get("/admin", requireStaff, getAllRequests); // Admin route
router.get("/:id", getRequestById);
router.patch("/:id", requireStaff, updateRequest);
router.delete("/:id", async (req, res) => {
  try {
    const request = await findAccessibleRequest(req.user, req.params.id);
    if (!request) return notFound(res);

    await prisma.portalRequest.delete({ where: { id: request.id } });
    return res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    return serverError(res, error, "Failed to delete", req);
  }
});

router.delete("/:id/files/:fileId", async (req, res) => {
  try {
    const request = await findAccessibleRequest(req.user, req.params.id);
    if (!request) return notFound(res);

    const { fileId } = req.params;
    const file = await prisma.portalFile.findUnique({ where: { id: fileId } });
    if (!file || file.requestId !== request.id) return res.status(404).json({ error: "File not found" });

    await prisma.portalFile.delete({ where: { id: fileId } });

    await prisma.portalRequestActivity.create({
      data: {
        requestId: request.id,
        action: "FILE_DELETED",
        description: `Deleted file: ${file.fileName}`,
        performedBy: isStaff(req.user) ? "Admin" : (req.user?.name || "User")
      }
    });

    return res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    return serverError(res, error, "Failed to delete file", req);
  }
});

router.post("/:id/messages", limiters.messages, addMessage);
router.get("/:id/messages", getMessages);
router.post("/:id/files", limiters.upload, uploadFile);
router.post("/:id/files/url", limiters.upload, addFileUrl);

module.exports = router;
