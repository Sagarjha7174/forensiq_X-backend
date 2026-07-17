const prisma = require("../../config/database/prismaClient");

exports.createEvent = async (req, res) => {
  try {
    const { title, slug, shortDescription, fullDescription, type, phase, status, date, startTime, endTime, venue, onlineLink, registrationLink, registrationEnd, coverImage, thumbnail, banner, isFeatured, seoTitle, seoDescription, keywords, organizer, tags, categoryId, galleries } = req.body;

    if (!title || !slug) {
      return res.status(400).json({ success: false, message: "Title and slug are required" });
    }

    const event = await prisma.event.create({
      data: {
        title,
        slug,
        shortDescription,
        fullDescription,
        type: type || "PUBLIC",
        phase: phase || "UPCOMING",
        status: status || "DRAFT",
        date: date ? new Date(date) : null,
        startTime,
        endTime,
        venue,
        onlineLink,
        registrationLink,
        registrationEnd: registrationEnd ? new Date(registrationEnd) : null,
        coverImage,
        thumbnail,
        banner,
        isFeatured: isFeatured || false,
        seoTitle,
        seoDescription,
        keywords,
        organizer,
        tags,
        categoryId: categoryId || null,
        galleries: {
          create: galleries?.map((g) => ({ url: g.url, caption: g.caption, order: g.order })) || []
        }
      },
      include: {
        galleries: true,
        category: true
      }
    });

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: "Slug must be unique" });
    }
    console.error("Error creating event:", error);
    res.status(500).json({ success: false, message: "Server error creating event" });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, shortDescription, fullDescription, type, phase, status, date, startTime, endTime, venue, onlineLink, registrationLink, registrationEnd, coverImage, thumbnail, banner, isFeatured, seoTitle, seoDescription, keywords, organizer, tags, categoryId, galleries } = req.body;

    const event = await prisma.event.update({
      where: { id },
      data: {
        title,
        slug,
        shortDescription,
        fullDescription,
        type,
        phase,
        status,
        date: date ? new Date(date) : null,
        startTime,
        endTime,
        venue,
        onlineLink,
        registrationLink,
        registrationEnd: registrationEnd ? new Date(registrationEnd) : null,
        coverImage,
        thumbnail,
        banner,
        isFeatured,
        seoTitle,
        seoDescription,
        keywords,
        organizer,
        tags,
        categoryId: categoryId || null,
        galleries: {
          deleteMany: {},
          create: galleries?.map((g) => ({ url: g.url, caption: g.caption, order: g.order })) || []
        }
      },
      include: {
        galleries: true,
        category: true
      }
    });

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ success: false, message: "Server error updating event" });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.event.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ success: false, message: "Server error deleting event" });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const { type, phase, status, search, categoryId, featured } = req.query;

    const where = {};
    if (type) where.type = type;
    if (phase) where.phase = phase;
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (featured === 'true') where.isFeatured = true;

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { shortDescription: { contains: search } },
        { tags: { contains: search } }
      ];
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { category: true }
    });

    res.status(200).json({ success: true, data: events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ success: false, message: "Server error fetching events" });
  }
};

exports.getFeaturedEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED', isFeatured: true, type: 'PUBLIC' },
      orderBy: { date: 'desc' },
      take: 3,
      include: { category: true }
    });

    res.status(200).json({ success: true, data: events });
  } catch (error) {
    console.error("Error fetching featured events:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const event = await prisma.event.findUnique({
      where: { slug },
      include: { galleries: true, category: true }
    });

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    console.error("Error fetching event by slug:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: { galleries: true, category: true }
    });

    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    console.error("Error fetching event by id:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
