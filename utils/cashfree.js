const { Cashfree, CFEnvironment } = require("cashfree-pg");

const cashfreeInstance = new Cashfree(
  CFEnvironment.PRODUCTION, // Switch to CFEnvironment.SANDBOX for testing
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY
);

module.exports = cashfreeInstance;
