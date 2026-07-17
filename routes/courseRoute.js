const express = require("express");
const router = express.Router();
const checkAdmin = require("../middlewares/checkAdmin");

const { createCourse } = require("../controllers/course/createCourse");
const { getCourseById } = require("../controllers/course/getCourseById");
const { getAllCourses } = require("../controllers/course/getAllCourses");
const {updateCourse} = require("../controllers/course/updateCourses");
const { deleteCourse } = require("../controllers/course/deleteCourse");
const { route } = require("./fileRoute");

router.post("/create", checkAdmin, createCourse);
router.get("/get/:id", getCourseById);
router.get("/all", getAllCourses);
router.patch("/update/:id", checkAdmin, updateCourse);
router.delete("/delete/:id", checkAdmin, deleteCourse);

module.exports = router;