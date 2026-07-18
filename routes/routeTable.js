const express = require("express");
const routeTable = express.Router();
const verifyToken = require("../middlewares/auth");
const userRoutes = require("./userRoutes");
const { createUser } = require("../controllers/user/createUser");
const loginRoute = require("./loginRoute");
const quizRoute=require("./quizRoutes")
const fileRoute = require("./fileRoute");
const courseRoute = require("./courseRoute");
const notesRoute = require("./notesRoutes");
const { getAllCoursesSimple } = require("../controllers/course/getAllCoursesSimple");
const { getAllNotice } = require("../controllers/notice/getAllNotice");
const noticeRoute = require("./noticeRoute");
const razorpayRoutes = require("./razorpayRoutes");
const blogRoutes = require("./blogRoutes");
const {getAllBlogs} = require("../controllers/blog/getAllBlog");
const portalRequestRoutes = require("./portalRequestRoutes");


routeTable.post("/register", createUser);
routeTable.get("/getSimpleCourses", getAllCoursesSimple);
routeTable.use(loginRoute);
routeTable.use("/auth", require("./authRoutes"));
routeTable.use("/admin", verifyToken, require("./adminRoutes"));
routeTable.use("/network", verifyToken, require("./networkRoutes"));
routeTable.use("/user", verifyToken, userRoutes);
routeTable.use("/quiz",verifyToken,quizRoute);
routeTable.use("/courses", verifyToken, courseRoute);
routeTable.use("/course-content", require("./courseContentRoute"));
routeTable.use(fileRoute);
routeTable.use("/notes", verifyToken, notesRoute);
routeTable.use("/notices", verifyToken, noticeRoute);
routeTable.get("/allNotices", getAllNotice);
routeTable.use("/razorpay", verifyToken, razorpayRoutes);
routeTable.use("/blogs", verifyToken, blogRoutes);
routeTable.get("/allBlogs", getAllBlogs);
routeTable.use("/portal-requests", verifyToken, portalRequestRoutes);
routeTable.use("/events", require("./event/eventRoutes"));
routeTable.use("/enrollments", verifyToken, require("./enrollmentRoutes"));

module.exports = routeTable;
