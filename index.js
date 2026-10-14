const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const fileupload = require("express-fileupload");
const os = require("os");
require("dotenv").config();

const { checkConnection } = require("./utils/checkConnection");
const routeTable = require("./routes/routeTable");
const cloudinary = require("./config/cloudinary");
const { buildCorsOptions } = require("./utils/corsPolicy");
const { limiters } = require("./utils/rateLimiters");
const { requestId, errorHandler, notFoundHandler } = require("./utils/httpErrors");
const { tempFileCleanup, MAX_UPLOAD_BYTES } = require("./utils/fileValidation");
const logger = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   0️⃣ PLATFORM
   TRUST_PROXY: number of reverse proxies in front of the app (default 1, e.g. Render /
   Vercel / Nginx). Needed so rate limits key on the real client IP. Set to 0 when the
   app is directly exposed, otherwise clients could spoof X-Forwarded-For.
========================= */
app.disable("x-powered-by");
app.set("trust proxy", Number.parseInt(process.env.TRUST_PROXY ?? "1", 10) || false);

app.use(requestId);
app.use(
  helmet({
    // JSON API: resources (PDF stream, JSON) are fetched cross-origin by the frontend.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
  })
);

/* =========================
   1️⃣ CORS (exact allowlist)
========================= */
const corsOptions = buildCorsOptions();
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* =========================
   2️⃣ CASHFREE WEBHOOK (RAW BODY)
   ⚠️ MUST COME BEFORE express.json() so the exact bytes can be signature-verified.
========================= */
app.use("/api/webhooks", limiters.webhook, require("./routes/webhookRoutes"));

/* =========================
   3️⃣ BODY PARSERS + LIMITS
========================= */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

/* =========================
   4️⃣ FILE UPLOAD (bounded, temp files always cleaned up)
========================= */
app.use(
  fileupload({
    useTempFiles: true,
    tempFileDir: os.tmpdir(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 20, parts: 25 },
    abortOnLimit: true,
    responseOnLimit: JSON.stringify({ error: "File is too large" }), // sent with HTTP 413
    uploadTimeout: 120000,
    safeFileNames: false, // display names are sanitized in fileValidation.safeDisplayName
    parseNested: false,
  })
);
app.use(tempFileCleanup);

/* =========================
   5️⃣ CLOUDINARY
========================= */
cloudinary.cloudinaryConfig();

/* =========================
   6️⃣ HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

/* =========================
   7️⃣ MAIN ROUTES
========================= */
app.use("/api/v1", limiters.global, routeTable);

/* =========================
   8️⃣ 404 + CENTRAL ERROR HANDLER (no stack traces / internals to clients)
========================= */
app.use(notFoundHandler);
app.use(errorHandler);

/* =========================
   9️⃣ DB CHECK + START SERVER
========================= */
if (process.env.NODE_ENV !== "test") {
  checkConnection();
}

if (require.main === module) {
  if (!process.env.JWT_SECRET) {
    logger.error("JWT_SECRET is not set; refusing to start");
    process.exit(1);
  }
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

module.exports = app;
