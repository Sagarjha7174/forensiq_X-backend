const express = require("express");
const router = express.Router();


const { createOrder } = require("../controllers/razorpay/createOrder");
const { verifyPayment } = require("../controllers/razorpay/verifyPayment");
const verifyToken = require("../middlewares/auth");



// ✅ Create Order (normal JSON)
router.post(
  "/create-order",
  express.json(),
  verifyToken,
  createOrder
);

// ✅ Verify Payment (Frontend synchronous verification)
router.post(
  "/confirm-transaction",
  express.json(),
  verifyToken,
  verifyPayment
);

module.exports = router;
