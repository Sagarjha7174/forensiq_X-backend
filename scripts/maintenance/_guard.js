/**
 * Guard for maintenance scripts that WRITE to the database.
 * Requires an explicit confirmation and refuses to run with NODE_ENV=production unless
 * ALLOW_PRODUCTION_WRITE=yes is also set. Always review DB_URL before running.
 *
 *   CONFIRM_DB_WRITE=yes node scripts/maintenance/seed-catalog.js
 */
module.exports = function requireWriteConfirmation(scriptName) {
  if (process.env.CONFIRM_DB_WRITE !== "yes") {
    console.error(`[${scriptName}] Refusing to run: this script writes to the database.\n` +
      `Re-run with CONFIRM_DB_WRITE=yes after checking which database DB_URL points to.`);
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_WRITE !== "yes") {
    console.error(`[${scriptName}] Refusing to run against NODE_ENV=production without ALLOW_PRODUCTION_WRITE=yes.`);
    process.exit(1);
  }
};
