const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
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

  for (const user of users) {
    try {
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
    } catch (err) {
      console.log("FAILED FOR USER:", user.id);
      console.log(err.message);
      return;
    }
  }
  console.log("All users formatted successfully");
}
main().finally(() => prisma.$disconnect());
