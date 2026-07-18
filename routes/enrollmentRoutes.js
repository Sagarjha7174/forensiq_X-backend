const express = require("express");
const router = express.Router();
const checkAdmin = require("../middlewares/checkAdmin");

const { assignCourse } = require("../controllers/enrollment/assignCourse");
const { updateEnrollmentStatus } = require("../controllers/enrollment/updateEnrollmentStatus");
const { removeEnrollment } = require("../controllers/enrollment/removeEnrollment");
const { getAllEnrollments } = require("../controllers/enrollment/getAllEnrollments");

// All enrollment actions require admin privileges for now
router.use(checkAdmin);

router.get("/", getAllEnrollments);
router.post("/", assignCourse);
router.patch("/:id", updateEnrollmentStatus);
router.delete("/:id", removeEnrollment);

module.exports = router;
