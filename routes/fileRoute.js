const express = require('express');
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const { requireStaff } = require("../middlewares/checkAdmin");
const { imageupload } = require('../controllers/fileUpload/fileUpload');
const { uploadGenericFile } = require('../controllers/fileUpload/uploadController');
const { limiters } = require("../utils/rateLimiters");

router.post("/fileupload", verifyToken, requireStaff, limiters.upload, imageupload);

// Generic upload endpoint (images/documents for everyone, videos for staff)
router.post("/upload", verifyToken, limiters.upload, uploadGenericFile);

module.exports = router;
