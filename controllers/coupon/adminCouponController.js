const prisma = require("../../config/database/prismaClient");

// List all coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      include: {
        courses: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(coupons);
  } catch (err) {
    console.error("Error fetching coupons:", err);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
};

// Get single coupon
exports.getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        courses: { select: { id: true, name: true } },
        couponUses: {
          include: {
            user: { select: { name: true, email: true } },
            payment: { select: { amount: true, originalAmount: true, discountAmount: true } }
          }
        },
        createdBy: { select: { name: true } }
      }
    });

    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    res.json(coupon);
  } catch (err) {
    console.error("Error fetching coupon:", err);
    res.status(500).json({ error: "Failed to fetch coupon" });
  }
};


const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT", "FREE_COURSE", "FLAT_PRICE"];

/** Returns an error message for invalid coupon numbers/enums, or null. */
const couponInputError = (body, { requireCode }) => {
  const { code, discountType, discountValue, maxDiscountAmount, minimumPurchaseAmount, usageLimit, perUserLimit, applicableTo, courseIds } = body || {};
  if (requireCode && (typeof code !== "string" || !/^[A-Za-z0-9_-]{3,32}$/.test(code))) {
    return "Coupon code must be 3-32 letters, numbers, '-' or '_'";
  }
  if (discountType !== undefined && !DISCOUNT_TYPES.includes(discountType)) return "Invalid discount type";
  if (applicableTo !== undefined && !["ALL_COURSES", "SELECTED_COURSES"].includes(applicableTo)) return "Invalid applicableTo";
  const nonNeg = (v) => v === undefined || v === null || v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0);
  if (![discountValue, maxDiscountAmount, minimumPurchaseAmount, usageLimit, perUserLimit].every(nonNeg)) {
    return "Discount values and limits must be whole, non-negative numbers";
  }
  if (discountType === "PERCENTAGE" && Number(discountValue) > 100) return "Percentage discount cannot exceed 100";
  if (perUserLimit !== undefined && perUserLimit !== null && perUserLimit !== "" && Number(perUserLimit) < 1) return "perUserLimit must be at least 1";
  if (courseIds !== undefined && (!Array.isArray(courseIds) || !courseIds.every((c) => typeof c === "string"))) return "Invalid courseIds";
  return null;
};

// Create coupon
exports.createCoupon = async (req, res) => {
  try {
    const { code, title, description, discountType, discountValue, maxDiscountAmount, minimumPurchaseAmount, applicableTo, validFrom, validUntil, usageLimit, perUserLimit, courseIds } = req.body;
    
    const inputError = couponInputError(req.body, { requireCode: true });
    if (inputError) return res.status(400).json({ error: inputError });

    // Check if code exists
    const existing = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) return res.status(400).json({ error: "Coupon code already exists" });

    const data = {
      code: code.toUpperCase(),
      title,
      description,
      discountType,
      discountValue: parseInt(discountValue) || 0,
      maxDiscountAmount: maxDiscountAmount ? parseInt(maxDiscountAmount) : null,
      minimumPurchaseAmount: minimumPurchaseAmount ? parseInt(minimumPurchaseAmount) : null,
      applicableTo,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      perUserLimit: perUserLimit ? parseInt(perUserLimit) : 1,
      createdById: req.user.id
    };

    if (applicableTo === 'SELECTED_COURSES' && courseIds && courseIds.length > 0) {
      data.courses = {
        connect: courseIds.map(id => ({ id }))
      };
    }

    const coupon = await prisma.coupon.create({ data });
    res.status(201).json(coupon);
  } catch (err) {
    console.error("Error creating coupon:", err);
    res.status(500).json({ error: "Failed to create coupon" });
  }
};

// Update coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, discountType, discountValue, maxDiscountAmount, minimumPurchaseAmount, applicableTo, validFrom, validUntil, usageLimit, perUserLimit, courseIds } = req.body;

    const inputError = couponInputError(req.body, { requireCode: false });
    if (inputError) return res.status(400).json({ error: inputError });

    const updateData = {
      title,
      description,
      discountType,
      discountValue: parseInt(discountValue) || 0,
      maxDiscountAmount: maxDiscountAmount ? parseInt(maxDiscountAmount) : null,
      minimumPurchaseAmount: minimumPurchaseAmount ? parseInt(minimumPurchaseAmount) : null,
      applicableTo,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      perUserLimit: perUserLimit ? parseInt(perUserLimit) : 1,
      updatedById: req.user.id
    };

    if (applicableTo === 'SELECTED_COURSES') {
      updateData.courses = {
        set: (courseIds || []).map(cid => ({ id: cid }))
      };
    } else {
      updateData.courses = { set: [] }; // disconnect all if applicable to all
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: updateData
    });
    res.json(coupon);
  } catch (err) {
    console.error("Error updating coupon:", err);
    res.status(500).json({ error: "Failed to update coupon" });
  }
};

// Delete coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.coupon.delete({ where: { id } });
    res.json({ message: "Coupon deleted successfully" });
  } catch (err) {
    console.error("Error deleting coupon:", err);
    res.status(500).json({ error: "Failed to delete coupon" });
  }
};

// Toggle status
exports.toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });

    const updated = await prisma.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive }
    });
    res.json(updated);
  } catch (err) {
    console.error("Error toggling status:", err);
    res.status(500).json({ error: "Failed to toggle status" });
  }
};
