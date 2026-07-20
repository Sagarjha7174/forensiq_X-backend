const express = require('express');
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const checkAdmin = require("../middlewares/checkAdmin");
const contentController = require("../controllers/courseContentController");

const checkCourseAccess = require("../middlewares/checkCourseAccess");

// Admin routes
router.use(verifyToken);

// For student viewing, the course content requires enrollment validation
router.get("/:courseId", checkCourseAccess, contentController.getCourseContent);

// Require admin for the rest
router.use(checkAdmin);

// Modules
router.post("/module", contentController.createModule);
router.patch("/module/reorder", contentController.reorderModules);
router.put("/module/:id", contentController.updateModule);
router.delete("/module/:id", contentController.deleteModule);

// Lectures
router.post("/lecture", contentController.createLecture);
router.patch("/lecture/reorder", contentController.reorderLectures);
router.put("/lecture/:id", contentController.updateLecture);
router.delete("/lecture/:id", contentController.deleteLecture);

// Resources
router.post("/resource", contentController.createResource);
router.delete("/resource/:id", contentController.deleteResource);

// Assignments
router.post("/assignment", contentController.createAssignment);
router.delete("/assignment/:id", contentController.deleteAssignment);

// Announcements
router.post("/announcement", contentController.createAnnouncement);
router.delete("/announcement/:id", contentController.deleteAnnouncement);

module.exports = router;
