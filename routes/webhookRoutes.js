const express = require("express");
const router = express.Router();
const { cashfreeWebhook } = require("../controllers/cashfree/webhookCashfree");

/* =========================
   CASHFREE WEBHOOK
   Raw body (Buffer) is required: the signature covers the exact bytes sent.
   Accept any content-type so a charset suffix cannot bypass the raw parser.
========================= */
router.post(
  "/cashfree",
  express.raw({ type: () => true, limit: "256kb" }),
  cashfreeWebhook
);

module.exports = router;
