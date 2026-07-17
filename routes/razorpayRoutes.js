const express = require("express");
const router = express.Router();


const { createOrder } = require("../controllers/razorpay/createOrder");



// ✅ Create Order (normal JSON)
router.post(
  "/create-order",
  express.json(),
  createOrder
);

module.exports = router;
