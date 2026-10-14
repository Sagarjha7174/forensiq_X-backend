const express = require("express");
const router = express.Router();
const { createOrder } = require("../controllers/cashfree/createOrder");
const { verifyPayment } = require("../controllers/cashfree/verifyPayment");
const verifyToken = require("../middlewares/auth");
const { limiters } = require("../utils/rateLimiters");

// Mounted under verifyToken in routeTable; repeated here as defence in depth (no-op if set).
router.post("/create-order", verifyToken, limiters.payment, createOrder);
router.post("/confirm-transaction", verifyToken, limiters.payment, verifyPayment);

module.exports = router;
