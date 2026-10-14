const cloudinary = require("cloudinary").v2;
const { validateUpload, safeFolder } = require("../../utils/fileValidation");
const { isStaff } = require("../../utils/roles");
const { serverError } = require("../../utils/httpErrors");

/**
 * Generic upload to Cloudinary.
 * - type is detected from file content, never from the client MIME type / filename
 * - students/clients may upload images and documents; staff may also upload videos
 * - folder is restricted to a slug under forensiq/ (no path tricks)
 * Temp files are removed by the tempFileCleanup middleware.
 */
exports.uploadGenericFile = async (req, res) => {
  try {
    const file = req.files?.file || req.files?.imagefile; // Support both just in case during migration
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const allowed = isStaff(req.user) ? ["image", "document", "video"] : ["image", "document"];
    const info = validateUpload(file, allowed);
    const targetFolder = `forensiq/${safeFolder(req.body?.folder)}`;

    const response = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: targetFolder,
      resource_type: "auto",
      use_filename: false,
      unique_filename: true,
    });

    return res.status(201).json({
      success: true,
      url: response.secure_url,
      publicId: response.public_id,
      resourceType: response.resource_type,
      originalName: info.displayName,
      size: response.bytes
    });
  } catch (err) {
    return serverError(res, err, "File upload failed", req);
  }
};
