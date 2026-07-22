const express = require("express");
const router = express.Router();


const {createQuiz} = require("../controllers/quiz/createQuiz");
const {getQuizById} = require("../controllers/quiz/getQuizById");
const {submitQuiz} = require("../controllers/quiz/submitQuiz");
const {getQuizAttempts} = require("../controllers/quiz/getQuizAttempts");
const {getUserQuizHistory} = require("../controllers/quiz/getUserQuizHistory");
const {getAttemptResult} = require("../controllers/quiz/getAttemptResult");
const {getCourseQuizzesOverview} = require("../controllers/quiz/getCourseQuizzesOverview");
const checkAdmin = require("../middlewares/checkAdmin");
const verifyToken = require("../middlewares/auth");

router.post("/create", checkAdmin, createQuiz);
router.get("/get/:quizId", verifyToken, getQuizById); // Protect this route since we need req.user for answer stripping
router.post("/submit", verifyToken, submitQuiz);
router.get("/history", verifyToken, getUserQuizHistory);
router.get("/attempts/:quizId", verifyToken, getQuizAttempts);
router.get("/attempt/:attemptId", verifyToken, getAttemptResult);
router.get("/course/:courseId/overview", verifyToken, getCourseQuizzesOverview);

module.exports = router;
