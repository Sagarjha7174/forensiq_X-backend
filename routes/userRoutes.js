const express = require("express");
const router = express.Router();
const checkAdmin = require("../middlewares/checkAdmin");

const { getUser } = require("../controllers/user/getUserById");
const { getAllUser } = require("../controllers/user/getAllUser");

const { blockUser } = require("../controllers/user/blockUser");

const { getCourseByUser } = require("../controllers/user/getCourseByUser");
const { updateUser } = require("../controllers/user/updateUser");
const { updateSelf } = require("../controllers/user/updateSelf");
const { changePassword } = require("../controllers/user/changePassword");
const { deleteUser } = require("../controllers/user/deleteUser");

router.get("/get/:id", getUser);
router.get("/all", checkAdmin, getAllUser);

router.patch("/block/:id", checkAdmin, blockUser);
router.delete("/delete/:id", checkAdmin, deleteUser);

router.get("/courses/:userId", getCourseByUser);
router.patch("/update/:id", checkAdmin, updateUser);

router.put("/update-profile", updateSelf);
router.put("/change-password", changePassword);

module.exports = router;
