const prisma = require("../../config/database/prismaClient");
const cloudinary = require("cloudinary").v2;
const { findAccessibleRequest, notFound, isStaff } = require("../../utils/portalAccess");
const { validateUpload } = require("../../utils/fileValidation");
const { serverError } = require("../../utils/httpErrors");

const uploadFile = async (req, res) => {
  try {
    const file = req.files?.file; // the frontend usually sends it as 'file'
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const request = await findAccessibleRequest(req.user, req.params.id);
    if (!request) return notFound(res);

    // Content-based type check (images + documents only) and size limits.
    const info = validateUpload(file, ["image", "document"]);

    const response = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "forensiq/portal_requests",
      resource_type: "auto", // content already validated: no HTML/SVG/scripts can reach Cloudinary
      use_filename: false,
      unique_filename: true,
    });

    const newFile = await prisma.portalFile.create({
      data: {
        requestId: request.id,
        fileUrl: response.secure_url,
        fileName: info.displayName
      }
    });

    await prisma.portalRequestActivity.create({
      data: {
        requestId: request.id,
        action: "FILE_UPLOADED",
        description: `Uploaded file: ${info.displayName}`,
        performedBy: isStaff(req.user) ? "Admin" : (req.user?.name || "User")
      }
    });

    return res.status(201).json({
      message: "File uploaded successfully",
      data: newFile,
    });
  } catch (error) {
    return serverError(res, error, "Failed to upload file", req);
  }
};

module.exports = { uploadFile };
