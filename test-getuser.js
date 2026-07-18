const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst({
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
      console.log("User not found");
      return;
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
    
    console.log("Success!");
  } catch (err) {
    console.error("FORMAT ERROR:");
    console.error(err);
  }
}
main().finally(() => prisma.$disconnect());
