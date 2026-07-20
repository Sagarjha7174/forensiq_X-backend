const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const createRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { module_type, title, serviceId, ...formData } = req.body;

    if (!module_type) {
      return res.status(400).json({ error: "module_type is required" });
    }

    let serviceSnapshot = {};
    if (serviceId) {
      const service = await prisma.serviceCatalogItem.findUnique({
        where: { id: serviceId },
        include: { category: true }
      });
      if (service) {
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
    console.error("Error creating portal request:", error);
    res.status(500).json({ error: "Failed to create portal request" });
  }
};

module.exports = { createRequest };
