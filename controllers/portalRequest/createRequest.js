const prisma = require("../../config/database/prismaClient");
const { serverError } = require("../../utils/httpErrors");

const MAX_FORM_BYTES = 50 * 1024;

const createRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { module_type, title, serviceId, ...formData } = req.body;

    if (typeof module_type !== "string" || !/^[A-Za-z0-9 _-]{1,50}$/.test(module_type)) {
      return res.status(400).json({ error: "module_type is required" });
    }
    if (title !== undefined && (typeof title !== "string" || title.length > 200)) {
      return res.status(400).json({ error: "Invalid title" });
    }
    if (Buffer.byteLength(JSON.stringify(formData || {}), "utf8") > MAX_FORM_BYTES) {
      return res.status(413).json({ error: "Request details are too large" });
    }
    if (serviceId !== undefined && serviceId !== null && typeof serviceId !== "string") {
      return res.status(400).json({ error: "Invalid serviceId" });
    }

    let serviceSnapshot = {};
    if (serviceId) {
      const service = await prisma.serviceCatalogItem.findUnique({
        where: { id: serviceId },
        include: { category: true }
      });
      if (service && service.isActive) {
        serviceSnapshot = {
          serviceId: service.id,
          serviceName: service.title,
          serviceCategory: service.category ? service.category.name : null,
          estimatedPrice: service.pricingLabel || (service.estimatedMinPrice ? `₹${service.estimatedMinPrice} - ₹${service.estimatedMaxPrice}` : null)
        };
      }
    }

    const newRequest = await prisma.portalRequest.create({
      data: {
        userId,
        moduleType: module_type,
        title: title || `${module_type} Request`,
        formData: formData || {},
        status: "submitted",
        ...serviceSnapshot
      },
    });

    res.status(201).json({
      message: "Request created successfully",
      data: newRequest,
    });
  } catch (error) {
    return serverError(res, error, "Failed to create portal request", req);
  }
};

module.exports = { createRequest };
