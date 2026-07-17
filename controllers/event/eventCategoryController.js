const prisma = require("../../config/database/prismaClient");

exports.createCategory = async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ success: false, message: "Name and slug required" });

    const category = await prisma.eventCategory.create({ data: { name, slug } });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ success: false, message: "Category name or slug already exists" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.eventCategory.findMany({ orderBy: { name: 'asc' } });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.eventCategory.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
