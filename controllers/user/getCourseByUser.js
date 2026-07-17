const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


const getCourseByUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        payments: {
          where: {
            status: "SUCCESS"
          },
          include: {
            course: {
              include: {
                quizess: true,
                notes: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Transform response to return courses directly
    const courses = user.payments.map(payment => payment.course);

    res.status(200).json({
      userId: user.id,
      courses
    });
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getCourseByUser };


