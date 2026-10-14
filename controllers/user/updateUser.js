const bcrypt = require("bcrypt");
const { z } = require("zod");
const { PaymentStatus, EnrollmentStatus, EnrollmentSource } = require("@prisma/client");
const prisma = require("../../config/database/prismaClient");
const { PUBLIC_ROLES, normalizeRole, canManageUser, isStaff } = require("../../utils/roles");
const { validatePassword } = require("../../utils/passwordPolicy");
const { serverError } = require("../../utils/httpErrors");
const logger = require("../../utils/logger");

const optionalString = (max) => z.string().trim().max(max).optional();

const updateSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    name: optionalString(120),
    password: z.string().optional(),
    phone: z.union([z.string().trim().max(20), z.null()]).optional(),
    degree: optionalString(120),
    classes: optionalString(120),
    isActive: z.boolean().optional(),
    accountStatus: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
    isVerified: z.boolean().optional(),
    role: z.string().optional(),
    courseIds: z.array(z.string().min(1).max(64)).max(100).optional(),
  })
  .strict(); // rejects is_sub_admin, google_id, auth_provider, ... from the client

/**
 * PATCH /api/v1/user/update/:id — full administrators only (route-level),
 * plus target-level checks (canManageUser) here.
 * Privileged roles can never be assigned through this endpoint.
 */
const updateUser = async (req, res) => {
  const uid = req.params.id;

  const parsed = updateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid update payload", details: parsed.error.issues.map((i) => i.path.join(".") || i.message) });
  }
  const { email, name, password, phone, degree, classes, isActive, accountStatus, isVerified, courseIds } = parsed.data;
  const role = parsed.data.role === undefined ? undefined : normalizeRole(parsed.data.role);

  try {
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!canManageUser(req.user, user)) {
      return res.status(403).json({ error: "You are not allowed to modify this account" });
    }

    if (role !== undefined && role !== normalizeRole(user.role)) {
      if (!PUBLIC_ROLES.includes(role)) {
        return res.status(403).json({ error: "Privileged roles cannot be assigned through this endpoint" });
      }
      if (isStaff(user)) {
        return res.status(403).json({ error: "Staff account roles cannot be changed here" });
      }
    }

    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ error: passwordError });
    }

    if (Array.isArray(courseIds) && courseIds.length > 0) {
      const found = await prisma.course.count({ where: { id: { in: courseIds } } });
      if (found !== new Set(courseIds).size) {
        return res.status(400).json({ error: "One or more courses do not exist" });
      }
    }

    await prisma.$transaction(async (tx) => {
      const updateData = {
        email: email ?? user.email,
        name: name ?? user.name,
        phone: phone === undefined ? user.phone : phone || null,
        degree: degree ?? user.degree,
        classes: classes ?? user.classes,
        isActive: typeof isActive === "boolean" ? isActive : user.isActive,
        accountStatus: accountStatus ?? user.accountStatus,
        isVerified: typeof isVerified === "boolean" ? isVerified : user.isVerified,
        role: role ?? user.role,
      };

      if (typeof isActive === "boolean" && !accountStatus) {
        updateData.accountStatus = isActive ? "ACTIVE" : "INACTIVE";
      }
      if (accountStatus && typeof isActive !== "boolean") {
        updateData.isActive = accountStatus === "ACTIVE";
      }

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      await tx.user.update({ where: { id: uid }, data: updateData });

      // Grant courses (admin action). Existing enrollments are left untouched.
      if (Array.isArray(courseIds) && courseIds.length > 0) {
        for (const courseId of new Set(courseIds)) {
          const existingEnrollment = await tx.enrollment.findUnique({
            where: { userId_courseId: { userId: uid, courseId } },
          });
          if (existingEnrollment) continue;

          const payment = await tx.payment.create({
            data: {
              userId: uid,
              courseId,
              amount: 0,
              status: PaymentStatus.SUCCESS,
              cashfreeOrderId: `ADMIN_${uid}_${courseId}_${Date.now()}`,
            },
          });

          await tx.enrollment.create({
            data: {
              userId: uid,
              courseId,
              paymentId: payment.id,
              source: EnrollmentSource.ADMIN,
              status: EnrollmentStatus.ACTIVE,
              activatedAt: new Date(),
            },
          });
        }
      }
    });

    logger.info("User updated by admin", {
      requestId: req.id,
      actorId: req.user?.id,
      targetId: uid,
      fields: Object.keys(parsed.data).filter((k) => k !== "password"),
      passwordChanged: Boolean(password),
    });

    return res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Email or phone already in use" });
    }
    return serverError(res, error, "An error occurred while updating the user.", req);
  }
};

module.exports = { updateUser };
