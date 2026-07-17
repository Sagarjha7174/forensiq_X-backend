const { PrismaClient } = require("@prisma/client");


const prisma = new PrismaClient();


exports.getAllUser = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        payments: {
          where: { status: "SUCCESS" },
          include: { course: true }
        }
      }
    });

    const formattedUsers = users.map(user => ({
      ...user,
      courses: user.payments.map(p => p.course),
      payments: undefined
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
