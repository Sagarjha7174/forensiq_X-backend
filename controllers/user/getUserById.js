const prisma = require("../../config/database/prismaClient");

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
        updatedAt: true,
        isActive: true, // Keep for backward compatibility
        accountStatus: true,
        isVerified: true,
        role: true,
        degree: true,
        classes: true,
        profile_image: true,
        enrollments: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
                description: true,
                status: true
              }
            }
          },
          orderBy: { enrolledAt: 'desc' }
        },
        _count: {
          select: {
            portalRequests: true,
            payments: true,
            enrollments: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const formattedUser = {
      ...user,
      courses: user.enrollments.filter(e => e.status === 'ACTIVE').map(e => e.course), // backward compatibility for frontend
      stats: {
        requestCount: user._count.portalRequests,
        coursesCount: user._count.enrollments,
        paymentsCount: user._count.payments
      }
    };
    delete formattedUser._count;

    res.status(200).json(formattedUser);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "An error occurred while fetching the user.", details: error.message, stack: error.stack });
  }
};

module.exports = { getUser };
