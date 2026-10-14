const prisma = require("../config/database/prismaClient");
const axios = require('axios');
const { serverError } = require("../utils/httpErrors");
const { safeUrl } = require("../utils/sanitize");
const { assertPublicHttpUrl } = require("../utils/publicUrl");
const logger = require("../utils/logger");

// Validate optional URL fields supplied by staff (rendered as links / media sources).
const optionalUrl = (value, field) => (value === undefined ? undefined : safeUrl(value, field));

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
    serverError(res, error, "Course content operation failed", req);
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
    serverError(res, error, "Course content operation failed", req);
  }
};

exports.deleteModule = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseModule.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, "Course content operation failed", req);
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
    serverError(res, error, "Course content operation failed", req);
  }
};

// LECTURES
exports.createLecture = async (req, res) => {
  try {
    const { moduleId, title, description, videoType, duration, isFree } = req.body;
    const videoUrl = optionalUrl(req.body.videoUrl, "videoUrl");

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
    serverError(res, error, "Course content operation failed", req);
  }
};

exports.updateLecture = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, videoType, duration, isFree } = req.body;
    const videoUrl = optionalUrl(req.body.videoUrl, "videoUrl");
    const lecture = await prisma.courseLecture.update({
      where: { id },
      data: { title, description, videoUrl, videoType, duration: Number(duration || 0), isFree: Boolean(isFree) }
    });
    res.json(lecture);
  } catch (error) {
    serverError(res, error, "Course content operation failed", req);
  }
};

exports.deleteLecture = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseLecture.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, "Course content operation failed", req);
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
    serverError(res, error, "Course content operation failed", req);
  }
};

// RESOURCES
exports.createResource = async (req, res) => {
  try {
    const { courseId, title, description, fileType } = req.body;
    const fileUrl = optionalUrl(req.body.fileUrl, "fileUrl");
    if (!fileUrl) return res.status(400).json({ error: "fileUrl is required" });
    const resource = await prisma.courseResource.create({
      data: { courseId, title, description, fileUrl, fileType }
    });
    res.status(201).json(resource);
  } catch (error) {
    serverError(res, error, "Course content operation failed", req);
  }
};

exports.deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseResource.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, "Course content operation failed", req);
  }
};

// ASSIGNMENTS
exports.createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, deadline, totalMarks } = req.body;
    const fileUrl = optionalUrl(req.body.fileUrl, "fileUrl");
    const assignment = await prisma.courseAssignment.create({
      data: { courseId, title, description, fileUrl, deadline: deadline ? new Date(deadline) : null, totalMarks: Number(totalMarks || 100) }
    });
    res.status(201).json(assignment);
  } catch (error) {
    serverError(res, error, "Course content operation failed", req);
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseAssignment.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, "Course content operation failed", req);
  }
};

// ANNOUNCEMENTS
exports.createAnnouncement = async (req, res) => {
  try {
    // Rendered as plain text (React-escaped) in the UI; stored as-is.
    const { courseId, title, content } = req.body;
    const announcement = await prisma.courseAnnouncement.create({
      data: { courseId, title, content }
    });
    res.status(201).json(announcement);
  } catch (error) {
    serverError(res, error, "Course content operation failed", req);
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.courseAnnouncement.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, "Course content operation failed", req);
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
    serverError(res, error, "Course content operation failed", req);
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
    if (typeof req.headers.range === "string" && /^bytes=\d*-\d*(,\s*\d*-\d*){0,4}$/.test(req.headers.range)) {
      headers.Range = req.headers.range;
    }

    // SSRF guard: only public http(s) hosts (re-checked on every redirect hop below).
    await assertPublicHttpUrl(streamUrl);

    const response = await axios({
      method: 'get',
      url: streamUrl,
      responseType: 'stream',
      headers,
      maxRedirects: 5,
      timeout: 30000,
      beforeRedirect: (options) => {
        const target = `${options.protocol}//${options.hostname}`;
        if (!/^https?:$/.test(options.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(options.hostname)) {
          throw new Error(`Blocked redirect to ${target}`);
        }
      },
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
    if (error.expose) return res.status(error.status).json({ error: error.message });
    logger.error("Failed to stream course resource", {
      requestId: req.id,
      courseId: req.params.courseId,
      resourceId: req.params.resourceId,
      upstreamStatus: error.response?.status,
      error,
    });
    if (res.headersSent) return res.end();
    return res.status(502).json({ error: "Failed to load the document. Please try again later." });
  }
};

