const express = require("express");
const router = express.Router();

const checkAdmin = require("../middlewares/checkAdmin");

const { createBlog } = require("../controllers/blog/createBlog");
const { updateBlog } = require("../controllers/blog/updateBlog");
const { deleteBlog } = require("../controllers/blog/deleteBlog");




// 🔐 Admin-only routes
router.post("/create", checkAdmin, createBlog);
router.patch("/update/:id", checkAdmin, updateBlog);
router.delete("/delete/:id", checkAdmin, deleteBlog);

module.exports = router;
