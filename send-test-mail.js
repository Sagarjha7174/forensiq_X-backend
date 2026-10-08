const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { orderConfirmationEmail } = require('./utils/mailService');

async function main() {
  const email = "letscode2007@gmail.com";
  
  // Find the user
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    return;
  }

  // Find their last successful payment
  const payment = await prisma.payment.findFirst({
    where: { userId: user.id, status: 'SUCCESS' },
    orderBy: { createdAt: 'desc' },
    include: { course: true, coupon: true }
  });

  if (!payment) {
    console.error(`No successful payment found for user ${email}.`);
    return;
  }

  console.log('Found Payment ID:', payment.id);
  console.log('Course:', payment.course.name);

  // Send the email
  try {
    await orderConfirmationEmail({
      to: user.email,
      fullName: user.name,
      details: {
        courseName: payment.course.name,
        amount: payment.amount,
        originalAmount: payment.originalAmount || payment.amount,
        discountAmount: payment.discountAmount || 0,
        paymentId: payment.cashfreePaymentId || 'N/A',
        orderId: payment.cashfreeOrderId || 'N/A',
        couponCode: payment.coupon ? payment.coupon.code : null,
      }
    });
    console.log('Successfully sent the order confirmation email!');
  } catch (err) {
    console.error('Failed to send email:', err);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error(err);
    prisma.$disconnect();
  });
