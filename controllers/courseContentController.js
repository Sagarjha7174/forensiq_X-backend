const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
