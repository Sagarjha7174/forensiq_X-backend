const express = require('express');
const router = express.Router();
const verifyToken = require("../middlewares/auth");

const { imageupload } = require('../controllers/fileUpload/fileUpload');
const { uploadGenericFile } = require('../controllers/fileUpload/uploadController');
const checkAdmin = require("../middlewares/checkAdmin");

// Legacy route (keep for now until fully migrated)
router.post("/fileupload", verifyToken, checkAdmin, imageupload);

// New generic platform-wide upload route (any logged in user can upload, specific permissions checked in frontend or via specific limits)
router.post("/upload", verifyToken, uploadGenericFile);

module.exports = router;