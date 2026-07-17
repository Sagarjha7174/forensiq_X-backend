const express = require("express");
const router = express.Router();
const eventController = require("../../controllers/event/eventController");
const categoryController = require("../../controllers/event/eventCategoryController");
const verifyToken = require("../../middlewares/auth");
const checkAdmin = require("../../middlewares/checkAdmin");

// Public routes
router.get("/public", eventController.getEvents);
router.get("/public/featured", eventController.getFeaturedEvents);
router.get("/public/:slug", eventController.getEventBySlug);
router.get("/categories", categoryController.getCategories);

// Admin routes
router.get("/admin", verifyToken, checkAdmin, eventController.getEvents);
router.get("/admin/:id", verifyToken, checkAdmin, eventController.getEventById);
router.post("/admin", verifyToken, checkAdmin, eventController.createEvent);
router.put("/admin/:id", verifyToken, checkAdmin, eventController.updateEvent);
router.delete("/admin/:id", verifyToken, checkAdmin, eventController.deleteEvent);

router.post("/categories", verifyToken, checkAdmin, categoryController.createCategory);
router.delete("/categories/:id", verifyToken, checkAdmin, categoryController.deleteCategory);

const statsController = require("../../controllers/event/eventStatsController");
router.get("/public/stats", statsController.getStats);
router.post("/admin/stats", verifyToken, checkAdmin, statsController.updateStats);

module.exports = router;
