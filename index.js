const express = require("express");
const cors = require("cors");
const fileupload = require("express-fileupload");
require("dotenv").config();

const { checkConnection } = require("./utils/checkConnection");
const routeTable = require("./routes/routeTable");
const cloudinary = require("./config/cloudinary");

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   1️⃣ CORS (ONCE)
========================= */
app.use(cors({
  origin: function (origin, callback) {
    if (
      !origin || 
      origin.includes('vercel.app') || 
      origin.includes('localhost') || 
      origin.includes('forensiq.in') || 
      origin === process.env.FRONTEND_URL
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

/* =========================
   2️⃣ RAZORPAY WEBHOOK (RAW BODY)
   ⚠️ MUST COME BEFORE express.json()
========================= */
app.use("/api/webhooks", require("./routes/webhookRoutes"));

/* =========================
   3️⃣ JSON BODY PARSER
========================= */
app.use(express.json());

/* =========================
   4️⃣ FILE UPLOAD
========================= */
app.use(fileupload({
  useTempFiles: true,
  tempFileDir: "/tmp/"
}));

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
app.use("/api/v1", routeTable);

/* =========================
   8️⃣ DB CHECK
========================= */
checkConnection();

/* =========================
   9️⃣ START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
