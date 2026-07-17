const express = require("express");
const router = express.Router();
const checkAdmin = require("../middlewares/checkAdmin");

const { createNotes } = require("../controllers/notes/createNotes");
const { getAllNotes } = require("../controllers/notes/getAllNotes");
const { deleteNotes } = require("../controllers/notes/deleteNotes");
const { updateNotes } = require("../controllers/notes/updateNotes");


router.post("/create", checkAdmin, createNotes);
router.get("/all",checkAdmin, getAllNotes);
router.patch("/update/:id", checkAdmin, updateNotes);
router.delete("/delete/:id", checkAdmin, deleteNotes);

module.exports = router;