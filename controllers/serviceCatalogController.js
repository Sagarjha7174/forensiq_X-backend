const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get active categories with active services (public)
exports.getPublicCatalog = async (req, res) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Create category
exports.createCategory = async (req, res) => {
  try {
    const category = await prisma.serviceCategory.create({
      data: req.body
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Update category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await prisma.serviceCategory.update({
      where: { id },
      data: req.body
    });
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.serviceCategory.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get all services
exports.getAllServices = async (req, res) => {
  try {
    const services = await prisma.serviceCatalogItem.findMany({
      include: { category: true },
      orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }]
    });
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Create service
exports.createService = async (req, res) => {
  try {
    const service = await prisma.serviceCatalogItem.create({
      data: req.body
    });
    res.status(201).json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Update service
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await prisma.serviceCatalogItem.update({
      where: { id },
      data: req.body
    });
    res.status(200).json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Delete service
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.serviceCatalogItem.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Service deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
