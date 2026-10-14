const { PaymentStatus, EnrollmentStatus, EnrollmentSource } = require("@prisma/client");
const prisma = require("../config/database/prismaClient");
const logger = require("../utils/logger");

/**
 * Mark a payment SUCCESS and grant the enrollment — exactly once.
 *
 * Shared by the Cashfree webhook and the browser confirmation endpoint. Both callers must
 * have verified the payment with Cashfree (signed webhook or server-side API lookup) and
 * matched amount/currency BEFORE calling this.
 *
 * Idempotency / concurrency:
 *  - a transaction-scoped advisory lock serializes fulfilment per payment row
 *  - SUCCESS payments are never processed again (duplicate / out-of-order deliveries are no-ops)
 *  - an existing enrollment (unique userId+courseId) is never duplicated
 *
 * @returns {Promise<{ alreadyProcessed: boolean, payment: object, enrollmentCreated: boolean }>}
 */
async function fulfillPayment({ paymentId, cashfreePaymentId, via }) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${paymentId}`}))`;

    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error(`Payment ${paymentId} not found`);
    if (payment.status === PaymentStatus.SUCCESS) {
      return { alreadyProcessed: true, payment, enrollmentCreated: false };
    }

    // CREATED -> SUCCESS, and FAILED -> SUCCESS (a failed attempt can be followed by a
    // successful retry on the same Cashfree order).
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCESS,
        cashfreePaymentId: cashfreePaymentId ? String(cashfreePaymentId) : payment.cashfreePaymentId,
      },
    });

    let enrollmentCreated = false;
    const existing = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
    });
    if (!existing) {
      await tx.enrollment.create({
        data: {
          userId: payment.userId,
          courseId: payment.courseId,
          paymentId: payment.id,
          source: EnrollmentSource.PURCHASE,
          status: EnrollmentStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });
      enrollmentCreated = true;
    } else {
      // Paid while an enrollment already existed (double purchase or suspended access).
      // Do not silently change an admin's suspension; flag for manual review / refund.
      logger.warn("Payment captured for an existing enrollment; needs manual review", {
        paymentId: payment.id,
        enrollmentId: existing.id,
        enrollmentStatus: existing.status,
      });
    }

    if (payment.couponId) {
      await tx.coupon.update({
        where: { id: payment.couponId },
        data: { usedCount: { increment: 1 } },
      });
      await tx.couponUse.create({
        data: { couponId: payment.couponId, userId: payment.userId, paymentId: payment.id },
      });
    }

    return { alreadyProcessed: false, payment: updated, enrollmentCreated };
  }, { timeout: 15000, maxWait: 5000 });

  logger.info("Payment fulfilment processed", {
    paymentId,
    via,
    alreadyProcessed: result.alreadyProcessed,
    enrollmentCreated: result.enrollmentCreated,
  });
  return result;
}

/** True when a Cashfree amount (rupees, may be a float) equals our integer rupee amount. */
const amountMatches = (cashfreeAmount, expectedRupees) =>
  Number.isFinite(Number(cashfreeAmount)) && Math.round(Number(cashfreeAmount) * 100) === Math.round(Number(expectedRupees) * 100);

module.exports = { fulfillPayment, amountMatches };
