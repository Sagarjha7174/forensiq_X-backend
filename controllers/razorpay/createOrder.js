const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const razorpay = require("./../../utils/razorpay");

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.body;


    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    /* =========================
       1️⃣ Block if already purchased
    ========================= */
    const alreadyPurchased = await prisma.payment.findFirst({
      where: {
        userId,
        courseId,
        status: "SUCCESS"
      }
    });

    if (alreadyPurchased) {
      return res.status(400).json({
        message: "Course already purchased"
      });
    }

    /* =========================
       2️⃣ Cleanup old attempts
    ========================= */
    await prisma.payment.deleteMany({
      where: {
        userId,
        courseId,
        status: { in: ["CREATED", "FAILED"] }
      }
    });

    /* =========================
       3️⃣ Create fresh Razorpay order
    ========================= */
    const order = await razorpay.orders.create({
      amount: course.price*100, // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    });

    /* =========================
       4️⃣ Store payment attempt
    ========================= */
    await prisma.payment.create({
      data: {
        userId,
        courseId,
        razorpayOrderId: order.id,
        amount: course.price,
        status: "CREATED"
      }
    });

    /* =========================
       5️⃣ Send to frontend
    ========================= */
    res.json({
      orderId: order.id,
      amount: course.price,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
};
