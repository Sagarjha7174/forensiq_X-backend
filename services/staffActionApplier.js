const prisma = require('../config/database/prismaClient');
const fs = require('fs');
const path = require('path');

const isUploadPath = (value) => typeof value === 'string' && value.startsWith('/uploads/');

const safelyDeleteFile = async (value) => {
  if (!isUploadPath(value)) return;
  const absolutePath = path.join(__dirname, '..', value.replace(/^\//, ''));
  try {
    await fs.promises.unlink(absolutePath);
  } catch {
    // ignore
  }
};

const cleanupOrphanUploads = async (payload) => {
  const files = Array.isArray(payload?.uploaded_files) ? payload.uploaded_files : [];
  for (const f of files) {
    await safelyDeleteFile(f);
  }
};

async function applyStaffAction(row) {
  const { action_type: type, payload } = row;

  switch (type) {
    case 'network.create_event': {
      const b = payload.body || {};
      if (!b.title || !b.date) throw new Error('title and date are required');
      const event = await prisma.networkEvent.create({
        data: {
          title: b.title,
          summary: b.summary,
          details: b.details,
          date: new Date(b.date),
          mode: b.mode,
          location: b.location,
          capacity: b.capacity,
          image_url: b.image_url
        }
      });
      return { event_id: event.id };
    }

    case 'network.update_event': {
      const b = payload.body || {};
      const row = await prisma.networkEvent.findUnique({ where: { id: payload.id } });
      if (!row) throw new Error('Event not found');
      
      const event = await prisma.networkEvent.update({
        where: { id: payload.id },
        data: {
          title: b.title ?? row.title,
          summary: b.summary ?? row.summary,
          details: b.details ?? row.details,
          date: b.date ? new Date(b.date) : row.date,
          mode: b.mode ?? row.mode,
          location: b.location ?? row.location,
          capacity: b.capacity ?? row.capacity,
          image_url: b.image_url ?? row.image_url
        }
      });
      return { event_id: event.id };
    }

    case 'network.delete_event': {
      const row = await prisma.networkEvent.findUnique({ where: { id: payload.id } });
      if (!row) throw new Error('Event not found');
      await prisma.networkEvent.delete({ where: { id: payload.id } });
      return { deleted: payload.id };
    }

    default:
      throw new Error(`Unknown action_type: ${type}`);
  }
}

module.exports = { applyStaffAction, cleanupOrphanUploads };
