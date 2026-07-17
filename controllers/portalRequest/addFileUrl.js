const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const addFileUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileUrl, fileName } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: "No file URL provided" });
    }

    const request = await prisma.portalRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin' || Boolean(req.user?.is_sub_admin);
    if (!isAdmin && request.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const newFile = await prisma.portalFile.create({
      data: {
        requestId: id,
        fileUrl,
        fileName: fileName || "Attachment"
      }
    });

    // Add activity
    await prisma.portalRequestActivity.create({
      data: {
        requestId: id,
        action: "FILE_UPLOADED",
        description: `Uploaded file: ${fileName || "Attachment"}`,
        performedBy: isAdmin ? "Admin" : (req.user?.name || "User")
      }
    });

    res.status(201).json({
      message: "File added successfully",
      data: newFile,
    });
  } catch (error) {
    console.error("Error adding file url:", error);
    res.status(500).json({ error: "Failed to add file" });
  }
};

module.exports = { addFileUrl };
