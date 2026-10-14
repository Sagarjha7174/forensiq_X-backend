const express = require("express");
const router = express.Router();
const { requireStaff, requireFullAdmin } = require("../middlewares/checkAdmin");
const { assignCourse } = require("../controllers/enrollment/assignCourse");
const { updateEnrollmentStatus } = require("../controllers/enrollment/updateEnrollmentStatus");
const { removeEnrollment } = require("../controllers/enrollment/removeEnrollment");
const { getAllEnrollments } = require("../controllers/enrollment/getAllEnrollments");
const { bulkEnrollmentAction } = require("../controllers/enrollment/bulkActions");

// Enrollment grants paid access: staff may view, only full administrators may change.
router.get("/", requireStaff, getAllEnrollments);
router.post("/", requireFullAdmin, assignCourse);
router.post("/bulk", requireFullAdmin, bulkEnrollmentAction);
router.patch("/:id", requireFullAdmin, updateEnrollmentStatus);
router.delete("/:id", requireFullAdmin, removeEnrollment);

module.exports = router;
