const cloudinary = require("cloudinary").v2;
const { validateUpload } = require("../../utils/fileValidation");
const { serverError } = require("../../utils/httpErrors");

/** Legacy admin image upload (field name "imagefile"). Images only. */
exports.imageupload = async (req, res) => {
  try {
    const file = req.files?.imagefile;
    if (!file) {
      return res.status(400).json({ message: "No image provided" });
    }
    validateUpload(file, ["image"]);

    const response = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "forensiq",
      resource_type: "image",
      use_filename: false,
      unique_filename: true,
    });
    return res.status(201).json({ message: "Image uploaded successfully", data: response.secure_url });
  } catch (err) {
    if (err.expose) return res.status(err.status).json({ message: err.message });
    return serverError(res, err, "Image upload failed", req);
  }
};
