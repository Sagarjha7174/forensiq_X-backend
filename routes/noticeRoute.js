const express = require("express");
const router = express.Router();
const checkAdmin = require("../middlewares/checkAdmin");

const { deleteNotice } = require("../controllers/notice/deleteNotice");

const {createNotice} = require("../controllers/notice/createNotice");
const {updateNotice} = require("../controllers/notice/updateNotice");

router.post("/create", checkAdmin, createNotice);
router.patch("/update/:noticeId", checkAdmin, updateNotice);

router.delete("/delete/:noticeId", checkAdmin, deleteNotice);



module.exports = router;