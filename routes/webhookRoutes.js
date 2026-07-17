const express = require("express");
const bodyParser = require("body-parser");
const router = express.Router();

const { razorpayWebhook } = require("../controllers/razorpay/webhookRazor");

// ❗ NO verifyToken here
router.post(
  "/razorpay",
  bodyParser.raw({ type: "application/json" }),
  razorpayWebhook
);

module.exports = router;
