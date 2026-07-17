const prisma = require('../../config/database/prismaClient');
const { queueIfSubAdmin } = require('../../utils/staffWriteGate');

exports.getEvents = async (req, res) => {
  try {
    const rows = await prisma.networkEvent.findMany({
      orderBy: { date: 'asc' }
    });
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch events', error: error.message });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { title, summary, details, date, mode, location, capacity, image_url } = req.body;

    if (!title || !date) {
      return res.status(400).json({ message: 'title and date are required' });
    }

    const pend = await queueIfSubAdmin(req, 'network.create_event', {
      body: { title, summary, details, date, mode, location, capacity, image_url },
      uploaded_files: []
    });
    if (pend) {
      return res.status(202).json({
        pending_approval: true,
        request_id: pend.id,
        message: 'Submitted for primary administrator approval.'
      });
    }

    const row = await prisma.networkEvent.create({
      data: {
        title, summary, details, date: new Date(date), mode, location, capacity: capacity ? parseInt(capacity) : null, image_url
      }
    });
    return res.status(201).json(row);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create event', error: error.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.networkEvent.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ message: 'Event not found' });

    const { title, summary, details, date, mode, location, capacity, image_url } = req.body;

    const pend = await queueIfSubAdmin(req, 'network.update_event', {
      id: row.id,
      body: { title, summary, details, date, mode, location, capacity, image_url },
      uploaded_files: []
    });
    if (pend) {
      return res.status(202).json({
        pending_approval: true,
        request_id: pend.id,
        message: 'Submitted for primary administrator approval.'
      });
    }

    const updatedRow = await prisma.networkEvent.update({
      where: { id },
      data: {
        title: title ?? row.title,
        summary: summary ?? row.summary,
        details: details ?? row.details,
        date: date ? new Date(date) : row.date,
        mode: mode ?? row.mode,
        location: location ?? row.location,
        capacity: capacity !== undefined ? (capacity ? parseInt(capacity) : null) : row.capacity,
        image_url: image_url ?? row.image_url
      }
    });

    return res.json(updatedRow);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update event', error: error.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.networkEvent.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ message: 'Event not found' });

    const pend = await queueIfSubAdmin(req, 'network.delete_event', { id: row.id, uploaded_files: [] });
    if (pend) {
      return res.status(202).json({
        pending_approval: true,
        request_id: pend.id,
        message: 'Submitted for primary administrator approval.'
      });
    }

    await prisma.networkEvent.delete({ where: { id } });
    return res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete event', error: error.message });
  }
};

exports.registerEvent = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.networkEvent.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (req.user?.role !== 'member') {
      return res.status(403).json({ message: 'Only members can register for events' });
    }

    const existing = await prisma.networkEventRegistration.findUnique({ 
      where: { event_id_user_id: { event_id: id, user_id: req.user.id } } 
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    const currentCount = await prisma.networkEventRegistration.count({ where: { event_id: id } });
    if (event.capacity && currentCount >= event.capacity) {
      return res.status(400).json({ message: 'Event has reached full capacity' });
    }

    await prisma.networkEventRegistration.create({
      data: { event_id: id, user_id: req.user.id }
    });

    return res.status(201).json({ message: 'Successfully registered for event' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register', error: error.message });
  }
};

exports.getMyRegistrations = async (req, res) => {
  try {
    const rows = await prisma.networkEventRegistration.findMany({
      where: { user_id: req.user.id },
      include: { event: true },
      orderBy: { created_at: 'desc' }
    });
    return res.json(rows.map(r => r.event));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch registrations', error: error.message });
  }
};

exports.getEventRegistrations = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await prisma.networkEventRegistration.findMany({
      where: { event_id: id },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { created_at: 'desc' }
    });
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch event registrations', error: error.message });
  }
};
