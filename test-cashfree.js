require('dotenv').config();
const { Cashfree, CFEnvironment } = require('cashfree-pg');

async function testConnection(env) {
  try {
    const environment = env === 'SANDBOX' ? CFEnvironment.SANDBOX : CFEnvironment.PRODUCTION;
    const cf = new Cashfree(
      environment,
      process.env.CASHFREE_APP_ID,
      process.env.CASHFREE_SECRET_KEY
    );

    console.log(`Testing Cashfree connection with env: ${env}...`);
    // Try to fetch a random non-existent order. 
    await cf.PGOrderFetchPayments("2023-08-01", "dummy_order_123");
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`✅ SUCCESS in ${env}: Successfully authenticated with Cashfree. (Received expected 404 for dummy order)`);
      return true;
    } else if (error.response && error.response.status === 401) {
      console.error(`❌ FAILED in ${env}: Authentication Error.`);
      return false;
    } else {
      console.error(`❌ FAILED in ${env}: Unexpected error:`, error.response?.data || error.message);
      return false;
    }
  }
}

async function run() {
  const isProd = await testConnection('PRODUCTION');
  if (!isProd) {
    const isSandbox = await testConnection('SANDBOX');
    if (isSandbox) {
       console.log("Keys are valid for SANDBOX environment.");
    } else {
       console.log("Keys are invalid for both environments.");
    }
  }
}

run();
