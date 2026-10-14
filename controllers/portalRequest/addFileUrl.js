const prisma = require("../../config/database/prismaClient");
const { findAccessibleRequest, notFound, isStaff } = require("../../utils/portalAccess");
const { safeUrl } = require("../../utils/sanitize");
const { safeDisplayName } = require("../../utils/fileValidation");
const { serverError } = require("../../utils/httpErrors");

const addFileUrl = async (req, res) => {
  try {
    const { fileUrl, fileName } = req.body || {};

    if (!fileUrl) {
      return res.status(400).json({ error: "No file URL provided" });
    }
    // Only absolute http(s) links; blocks javascript:/data: links that would run when clicked.
    let url;
    try {
      url = safeUrl(fileUrl, "fileUrl");
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "Invalid fileUrl: must be an absolute http(s) URL" });
    }

    const request = await findAccessibleRequest(req.user, req.params.id);
    if (!request) return notFound(res);

    const name = safeDisplayName(fileName, "Attachment");
    const newFile = await prisma.portalFile.create({
      data: {
        requestId: request.id,
        fileUrl: url,
        fileName: name
      }
    });

    await prisma.portalRequestActivity.create({
      data: {
        requestId: request.id,
        action: "FILE_UPLOADED",
        description: `Uploaded file: ${name}`,
        performedBy: isStaff(req.user) ? "Admin" : (req.user?.name || "User")
      }
    });

    return res.status(201).json({
      message: "File added successfully",
      data: newFile,
    });
  } catch (error) {
    return serverError(res, error, "Failed to add file", req);
  }
};

module.exports = { addFileUrl };
