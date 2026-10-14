const express = require("express");
const router = express.Router();
const { requireFullAdmin } = require("../middlewares/checkAdmin");
const { getUser } = require("../controllers/user/getUserById");
const { getAllUser } = require("../controllers/user/getAllUser");
const { blockUser } = require("../controllers/user/blockUser");
const { getCourseByUser } = require("../controllers/user/getCourseByUser");
const { updateUser } = require("../controllers/user/updateUser");
const { updateSelf } = require("../controllers/user/updateSelf");
const { changePassword } = require("../controllers/user/changePassword");
const { deleteUser } = require("../controllers/user/deleteUser");
const { limiters } = require("../utils/rateLimiters");

// Owner-or-staff checks are enforced inside the controllers.
router.get("/get/:id", getUser);
router.get("/courses/:userId", getCourseByUser);

// User management: full administrators only.
router.get("/all", requireFullAdmin, getAllUser);
router.patch("/block/:id", requireFullAdmin, blockUser);
router.delete("/delete/:id", requireFullAdmin, deleteUser);
router.patch("/update/:id", requireFullAdmin, updateUser);

// Self-service.
router.put("/update-profile", updateSelf);
router.put("/change-password", limiters.passwordChange, changePassword);

module.exports = router;
