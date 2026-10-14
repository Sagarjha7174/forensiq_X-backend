const { z } = require("zod");
const prisma = require("../../config/database/prismaClient");
const { serverError } = require("../../utils/httpErrors");

// Only harmless profile fields; role / email / flags can never be self-edited.
const selfSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().regex(/^\+?\d{7,15}$/, "Invalid phone number").optional(),
  degree: z.string().trim().max(120).optional(),
  classes: z.string().trim().max(120).optional(),
});

const updateSelf = async (req, res) => {
  const uid = req.user.id; // from verifyToken middleware
  const parsed = selfSchema.safeParse({
    name: req.body?.name ?? undefined,
    phone: req.body?.phone || undefined,
    degree: req.body?.degree ?? undefined,
    classes: req.body?.classes ?? undefined,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid profile data" });
  }
  const { name, phone, degree, classes } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: uid },
      data: {
        name: name ?? user.name,
        phone: phone ?? user.phone,
        degree: degree ?? user.degree,
        classes: classes ?? user.classes,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        degree: true,
        classes: true
      }
    });

    return res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "This phone number is already registered" });
    }
    return serverError(res, error, "Internal server error", req);
  }
};

module.exports = { updateSelf };
