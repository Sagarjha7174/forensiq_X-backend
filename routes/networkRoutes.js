const express = require('express');
const {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  registerEvent,
  getMyRegistrations,
  getEventRegistrations
} = require('../controllers/network/networkController');
const checkAdmin = require('../middlewares/checkAdmin');

const router = express.Router();

router.get('/events', getEvents);
router.post('/events', checkAdmin, createEvent);
router.put('/events/:id', checkAdmin, updateEvent);
router.delete('/events/:id', checkAdmin, deleteEvent);

router.post('/events/:id/register', registerEvent);
router.get('/my-registrations', getMyRegistrations);
router.get('/events/:id/registrations', checkAdmin, getEventRegistrations);

module.exports = router;
