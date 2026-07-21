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

// Base path will be /api/v1/portal-requests

router.post("/", createRequest);
router.get("/my", getMyRequests);
router.get("/admin", getAllRequests); // Admin route
router.get("/:id", getRequestById);
router.patch("/:id", updateRequest);
router.delete("/:id", async (req, res) => {
  // simple delete using prisma inline as it's small, or we could create a controller.
  try {
        const prisma = require("../config/database/prismaClient");
    const { id } = req.params;
    
    // access control
    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin' || Boolean(req.user?.is_sub_admin);
    const request = await prisma.portalRequest.findUnique({ where: { id } });
    
    if (!request) return res.status(404).json({ error: "Not found" });
    if (!isAdmin && request.userId !== req.user.id) return res.status(403).json({ error: "Access denied" });
    
    await prisma.portalRequest.delete({ where: { id } });
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

router.delete("/:id/files/:fileId", async (req, res) => {
  try {
        const prisma = require("../config/database/prismaClient");
    const { id, fileId } = req.params;

    const request = await prisma.portalRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: "Request not found" });

    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin' || Boolean(req.user?.is_sub_admin);
    
    // Check if the user is deleting their own file or admin
    if (!isAdmin && request.userId !== req.user.id) return res.status(403).json({ error: "Access denied" });

    const file = await prisma.portalFile.findUnique({ where: { id: fileId } });
    if (!file || file.requestId !== id) return res.status(404).json({ error: "File not found" });

    await prisma.portalFile.delete({ where: { id: fileId } });

    // Add activity
    await prisma.portalRequestActivity.create({
      data: {
        requestId: id,
        action: "FILE_DELETED",
        description: `Deleted file: ${file.fileName}`,
        performedBy: isAdmin ? "Admin" : (req.user?.name || "User")
      }
    });

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete file" });
  }
});

router.post("/:id/messages", addMessage);
router.get("/:id/messages", getMessages);
router.post("/:id/files", uploadFile);
router.post("/:id/files/url", addFileUrl);

module.exports = router;
