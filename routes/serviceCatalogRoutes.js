const express = require("express");
const router = express.Router();
const catalogController = require("../controllers/serviceCatalogController");
const verifyToken = require("../middlewares/auth");
const checkAdmin = require("../middlewares/checkAdmin");

// Public endpoints
router.get("/public/categories", catalogController.getPublicCatalog);

// Admin Category endpoints
router.get("/admin/categories", verifyToken, checkAdmin, catalogController.getAllCategories);
router.post("/admin/categories", verifyToken, checkAdmin, catalogController.createCategory);
router.put("/admin/categories/:id", verifyToken, checkAdmin, catalogController.updateCategory);
router.delete("/admin/categories/:id", verifyToken, checkAdmin, catalogController.deleteCategory);

// Admin Service endpoints
router.get("/admin/services", verifyToken, checkAdmin, catalogController.getAllServices);
router.post("/admin/services", verifyToken, checkAdmin, catalogController.createService);
router.put("/admin/services/:id", verifyToken, checkAdmin, catalogController.updateService);
router.delete("/admin/services/:id", verifyToken, checkAdmin, catalogController.deleteService);

module.exports = router;
