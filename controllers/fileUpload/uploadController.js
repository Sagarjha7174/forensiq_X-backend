const cloudinary = require("cloudinary").v2;
const prisma = require("../../config/database/prismaClient");

// Allowed configurations
const ALLOWED_MIME_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  document: [
    "application/pdf", 
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-zip-compressed",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv"
  ]
};

const MAX_FILE_SIZES = {
  image: 10 * 1024 * 1024, // 10MB
  document: 20 * 1024 * 1024, // 20MB
  video: 100 * 1024 * 1024, // 100MB
};

const getFileType = (mimeType) => {
  if (ALLOWED_MIME_TYPES.image.includes(mimeType)) return "image";
  if (ALLOWED_MIME_TYPES.video.includes(mimeType)) return "video";
  if (ALLOWED_MIME_TYPES.document.includes(mimeType)) return "document";
  return "unknown";
};

/**
 * Generic upload to Cloudinary
 * Supports folders: 'forensiq/blogs', 'forensiq/courses', etc.
 */
async function fileuploadtoCloudinary(file, folder, quality) {
  const options = {
    folder,
    resource_type: "auto",
  };
  if (quality) {
    options.quality = quality;
  }
  return await cloudinary.uploader.upload(file.tempFilePath, options);
}

exports.uploadGenericFile = async (req, res) => {
  try {
    const file = req.files?.file || req.files?.imagefile; // Support both just in case during migration
    
    // We expect the frontend to pass a folder parameter, e.g., 'courses', 'blogs', 'events'
    // We prepend 'forensiq/' to keep things organized.
    const subFolder = req.body?.folder || "general"; 
    const targetFolder = `forensiq/${subFolder}`;

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const fileType = getFileType(file.mimetype);

    if (fileType === "unknown") {
      return res.status(400).json({ error: `Unsupported file type: ${file.mimetype}` });
    }

    // Size validation
    const maxSize = MAX_FILE_SIZES[fileType];
    if (file.size > maxSize) {
      return res.status(400).json({ 
        error: `File is too large. Max allowed size for ${fileType} is ${maxSize / (1024 * 1024)}MB.` 
      });
    }

    // Upload to Cloudinary
    const response = await fileuploadtoCloudinary(file, targetFolder);

    res.status(201).json({
      success: true,
      url: response.secure_url,
      publicId: response.public_id,
      resourceType: response.resource_type,
      originalName: file.name,
      size: response.bytes
    });
  } catch (err) {
    console.error("Upload Error:", err);
    return res.status(500).json({ error: "File upload failed" });
  }
};
