const cloudinary = require("cloudinary").v2;
async function fileuploadtoCloudinary(file, folder, quality) {
  const options = {
    folder,
  };
  options.resource_type = "auto";
  if (quality) {
    options.quality = quality;
  }
  return await cloudinary.uploader.upload(file.tempFilePath, options);
}
exports.imageupload = async (req, res) => {
  try {
   
    const file = req.files.imagefile;

    
    
    const response = await fileuploadtoCloudinary(file, "forensiq");
   

    res.status(201).json({ message: "Image uploaded successfully" ,data: response.secure_url});
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: "Image upload failed" });
  }
};
