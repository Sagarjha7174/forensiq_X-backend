const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const cloudinary = require("cloudinary").v2;

async function fileuploadtoCloudinary(file, folder, quality) {
  const options = { folder };
  options.resource_type = "auto";
  if (quality) {
    options.quality = quality;
  }
  return await cloudinary.uploader.upload(file.tempFilePath, options);
}

const uploadFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.files?.file; // the frontend usually sends it as 'file'

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const request = await prisma.portalRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Access control: User or Admin
    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin' || Boolean(req.user?.is_sub_admin);
    if (!isAdmin && request.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const response = await fileuploadtoCloudinary(file, "forensiq/portal_requests");
    
    const newFile = await prisma.portalFile.create({
      data: {
        requestId: id,
        fileUrl: response.secure_url,
        fileName: file.name
      }
    });

    res.status(201).json({
      message: "File uploaded successfully",
      data: newFile,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
};

module.exports = { uploadFile };
