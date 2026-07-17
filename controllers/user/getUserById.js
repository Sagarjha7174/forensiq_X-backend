const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        isActive: true,
        degree: true,
        classes: true,
        payments: {
          where: {
            status: "SUCCESS"
          },
          select: {
            course: {
              select: {
                id: true,
                name: true,
                description: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Convert payments → courses (to keep frontend unchanged)
    const formattedUser = {
      ...user,
      courses: user.payments.map(p => p.course),
      payments: undefined
    };

    res.status(200).json(formattedUser);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      error: "An error occurred while fetching the user."
    });
  }
};

module.exports = { getUser };
