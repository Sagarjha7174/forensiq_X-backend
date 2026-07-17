const express = require("express");
const router = express.Router();


const {createQuiz} = require("../controllers/quiz/createQuiz");
const {getQuizById} = require("../controllers/quiz/getQuizById");

router.post("/create", createQuiz);
router.get("/get/:quizId", getQuizById);


module.exports = router;
