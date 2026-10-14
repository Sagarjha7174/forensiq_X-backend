const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { z } = require("zod");
const prisma = require("../../config/database/prismaClient");
const { sendSubAdminCredentialsEmail } = require("../../utils/mailService");
const { getPrimaryFrontendUrl } = require("../../utils/frontendUrls");
const { PUBLIC_ROLES, normalizeRole } = require("../../utils/roles");
const { validatePassword } = require("../../utils/passwordPolicy");
const { serverError } = require("../../utils/httpErrors");
const logger = require("../../utils/logger");

const optionalText = (max) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().max(max).optional());

const registrationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(120),
  password: z.string(),
  phone: optionalText(20),
  course: optionalText(120),
  classes: optionalText(120),
  role: z.preprocess((v) => (v === undefined || v === null || v === "" ? "STUDENT" : normalizeRole(v)), z.string()),
});

/**
 * Public self-registration. The role is NEVER trusted: only the public roles are
 * accepted, anything else (ADMIN, SUPERADMIN, SUBADMIN, unknown) is rejected.
 */
const createUser = async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid registration details", details: parsed.error.issues.map((i) => i.path.join(".")) });
  }
  const { email, name, password, phone, course, classes, role } = parsed.data;

  if (!PUBLIC_ROLES.includes(role)) {
    logger.warn("Rejected registration with non-public role", { requestId: req.id, role });
    return res.status(400).json({ error: "Invalid role selected" });
  }
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (phone && !/^\+?\d{7,15}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        phone: phone || null,
        degree: course,
        classes,
        role,
        is_sub_admin: false,
      },
    });

    return res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      phone: newUser.phone,
      degree: newUser.degree,
      classes: newUser.classes,
      role: newUser.role,
      createdAt: newUser.createdAt,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Email or Phone already exists" });
    }
    return serverError(res, error, "An error occurred while creating the user.", req);
  }
};

const subAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  first_name: z.string().trim().min(1).max(60),
  last_name: optionalText(60),
  password: z.string().optional(),
  phone: optionalText(20),
});

/**
 * Create a sub-administrator. Route is restricted to full administrators
 * (requireFullAdmin); sub-admins cannot create other administrators.
 * The created account is always role ADMIN + is_sub_admin = true.
 */
const createSubAdmin = async (req, res) => {
  const parsed = subAdminSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid sub-admin details" });
  }
  const { email, first_name, last_name, phone } = parsed.data;
  // Generate a strong temporary password when none is supplied.
  const password = parsed.data.password || `${crypto.randomBytes(9).toString("base64url")}9a`;
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ message: passwordError });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        name: `${first_name} ${last_name || ""}`.trim(),
        password: hashedPassword,
        phone: phone || null,
        degree: "Admin",
        classes: "Admin",
        role: "ADMIN",
        is_sub_admin: true,
        profileCompleted: true,
      },
    });

    const loginUrl = `${getPrimaryFrontendUrl()}/login`;
    let emailSent = false;
    try {
      await sendSubAdminCredentialsEmail({
        to: newUser.email,
        fullName: newUser.name,
        tempPassword: password,
        loginUrl,
      });
      emailSent = true;
    } catch (mailError) {
      logger.error("Failed to send sub-admin credentials email", { requestId: req.id, error: mailError });
    }

    logger.info("Sub-admin created", { requestId: req.id, actorId: req.user?.id, subAdminId: newUser.id });

    return res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      is_sub_admin: newUser.is_sub_admin,
      emailSent,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Email or Phone already exists" });
    }
    return serverError(res, error, "An error occurred while creating sub-admin.", req);
  }
};

const listSubAdmins = async (req, res) => {
  try {
    const subAdmins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        is_sub_admin: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        is_sub_admin: true,
        isActive: true,
        accountStatus: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json(subAdmins);
  } catch (error) {
    return serverError(res, error, "Failed to list sub-admins", req);
  }
};

module.exports = { createUser, createSubAdmin, listSubAdmins };
