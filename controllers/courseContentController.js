const prisma = require("../config/database/prismaClient");
const axios = require('axios');

const extractDriveId = (url) => {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

// MODULES
exports.createModule = async (req, res) => {
  try {
    const { courseId, title, description } = req.body;
    
    // Find highest order
    const lastModule = await prisma.courseModule.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' }
    });
    const order = lastModule ? lastModule.order + 1 : 0;

    const module = await prisma.courseModule.create({
      data: { courseId, title, description, order }
    });
    res.status(201).json(module);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const module = await prisma.courseModule.update({
      where: { id },
      data: { title, description }
    });
    res.json(module);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteModule = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseModule.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.reorderModules = async (req, res) => {
  try {
    const { items } = req.body; // array of { id, order }
    await prisma.$transaction(
      items.map((item) => 
        prisma.courseModule.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LECTURES
exports.createLecture = async (req, res) => {
  try {
    const { moduleId, title, description, videoUrl, videoType, duration, isFree } = req.body;
    
    const lastLecture = await prisma.courseLecture.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' }
    });
    const order = lastLecture ? lastLecture.order + 1 : 0;

    const lecture = await prisma.courseLecture.create({
      data: { moduleId, title, description, videoUrl, videoType, duration: Number(duration || 0), isFree: Boolean(isFree), order }
    });
    res.status(201).json(lecture);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateLecture = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, videoUrl, videoType, duration, isFree } = req.body;
    const lecture = await prisma.courseLecture.update({
      where: { id },
      data: { title, description, videoUrl, videoType, duration: Number(duration || 0), isFree: Boolean(isFree) }
    });
    res.json(lecture);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteLecture = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseLecture.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.reorderLectures = async (req, res) => {
  try {
    const { items } = req.body; // array of { id, order }
    await prisma.$transaction(
      items.map((item) => 
        prisma.courseLecture.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RESOURCES
exports.createResource = async (req, res) => {
  try {
    const { courseId, title, description, fileUrl, fileType } = req.body;
    const resource = await prisma.courseResource.create({
      data: { courseId, title, description, fileUrl, fileType }
    });
    res.status(201).json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseResource.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ASSIGNMENTS
exports.createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, fileUrl, deadline, totalMarks } = req.body;
    const assignment = await prisma.courseAssignment.create({
      data: { courseId, title, description, fileUrl, deadline: deadline ? new Date(deadline) : null, totalMarks: Number(totalMarks || 100) }
    });
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseAssignment.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ANNOUNCEMENTS
exports.createAnnouncement = async (req, res) => {
  try {
    const { courseId, title, content } = req.body;
    const announcement = await prisma.courseAnnouncement.create({
      data: { courseId, title, content }
    });
    res.status(201).json(announcement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseAnnouncement.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// FETCH COURSE FULL CONTENT
exports.getCourseContent = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lectures: {
              orderBy: { order: 'asc' }
            }
          }
        },
        resources: true,
        assignments: true,
        announcements: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// STREAM SECURE PDF RESOURCE
exports.streamResource = async (req, res) => {
  try {
    const { courseId, resourceId } = req.params;
    const { type } = req.query; // 'cms' or 'legacy'
    
    let fileUrl = null;

    if (type === 'legacy') {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: { notes: true }
      });
      if (course && course.notes) {
        const note = course.notes.find(n => n.id === resourceId);
        if (note) {
          fileUrl = note.url;
        }
      }
    } else {
      const resource = await prisma.courseResource.findFirst({
        where: { id: resourceId, courseId: courseId }
      });
      if (resource) {
        fileUrl = resource.fileUrl;
      }
    }

    if (!fileUrl) {
      return res.status(404).json({ error: "Resource not found" });
    }

    let streamUrl = fileUrl;
    const driveId = extractDriveId(fileUrl);
    
    if (driveId) {
      // Force Google Drive download URL format for raw bytes
      streamUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
    }

    // Support HTTP Range Requests for chunked fast loading
    const headers = {};
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const response = await axios({
      method: 'get',
      url: streamUrl,
      responseType: 'stream',
      headers,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300 // Allow 200 and 206
    });

    res.status(response.status); // 200 or 206
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Accept-Ranges', 'bytes'); // Tell PDF.js we support chunking

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
    }

    response.data.pipe(res);
  } catch (error) {
    console.error("=== STREAM RESOURCE FATAL ERROR ===");
    console.error(error);
    
    let errorDetails = error.message;
    if (error.response) {
      console.error("6. Error response from external server:");
      console.error(`Status: ${error.response.status}`);
      console.error(`Headers:`, error.response.headers);
      
      // Attempt to read stream to log body
      if (error.response.data && typeof error.response.data.read === 'function') {
        const bodyBuffer = error.response.data.read();
        if (bodyBuffer) {
           console.error(`Body:`, bodyBuffer.toString());
           errorDetails += ` | Body: ${bodyBuffer.toString()}`;
        } else {
           console.error("Body could not be read synchronously from stream.");
        }
      } else {
        console.error(`Body:`, error.response.data);
      }
    }

    res.status(500).json({ 
      error: "Failed to stream resource securely.", 
      message: errorDetails,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
};

