const express = require("express");
const bodyParser = require("body-parser");
const router = express.Router();

const { cashfreeWebhook } = require("../controllers/cashfree/webhookCashfree");

// ❗ NO verifyToken here
router.post(
  "/cashfree",
  bodyParser.raw({ type: "application/json" }),
  cashfreeWebhook
);

module.exports = router;
