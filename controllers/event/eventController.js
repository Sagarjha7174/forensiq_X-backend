const prisma = require("../../config/database/prismaClient");
const { sanitizeRichText, safeUrl } = require("../../utils/sanitize");
const { AppError, serverError } = require("../../utils/httpErrors");

const EVENT_TYPES = ["PUBLIC", "MEMBERSHIP"];
const EVENT_PHASES = ["UPCOMING", "PAST"];
const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const text = (v, field, max) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || v.length > max) throw new AppError(400, `Invalid ${field}`);
  return v;
};
const oneOf = (v, field, allowed) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (!allowed.includes(v)) throw new AppError(400, `Invalid ${field}`);
  return v;
};
const url = (v, field) => (v === undefined ? undefined : v === null || v === "" ? null : safeUrl(v, field));
const date = (v, field) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new AppError(400, `Invalid ${field}`);
  return d;
};

/**
 * Validate + sanitize staff-supplied event fields.
 * fullDescription is rich HTML: sanitized with a strict allowlist (no scripts, handlers,
 * inline styles, iframes, SVG; links limited to http/https/mailto/tel).
 * Link/media fields must be http(s) URLs (blocks javascript:/data: payloads).
 */
const parseEventInput = (body = {}) => {
  const slug = text(body.slug, "slug", 255);
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new AppError(400, "Slug may only contain lowercase letters, numbers and hyphens");

  let galleries;
  if (body.galleries !== undefined) {
    if (!Array.isArray(body.galleries) || body.galleries.length > 100) throw new AppError(400, "Invalid galleries");
    galleries = body.galleries.map((g, i) => ({
      url: safeUrl(g?.url, "gallery url"),
      caption: text(g?.caption, "gallery caption", 500) ?? null,
      order: Number.isInteger(g?.order) ? g.order : i,
    })).filter((g) => g.url);
  }

  return {
    title: text(body.title, "title", 255),
    slug,
    shortDescription: text(body.shortDescription, "shortDescription", 2000),
    fullDescription: body.fullDescription === undefined ? undefined : sanitizeRichText(text(body.fullDescription, "fullDescription", 100000)),
    type: oneOf(body.type, "type", EVENT_TYPES),
    phase: oneOf(body.phase, "phase", EVENT_PHASES),
    status: oneOf(body.status, "status", EVENT_STATUSES),
    date: date(body.date, "date"),
    startTime: text(body.startTime, "startTime", 40),
    endTime: text(body.endTime, "endTime", 40),
    venue: text(body.venue, "venue", 500),
    onlineLink: url(body.onlineLink, "onlineLink"),
    registrationLink: url(body.registrationLink, "registrationLink"),
    registrationEnd: date(body.registrationEnd, "registrationEnd"),
    coverImage: url(body.coverImage, "coverImage"),
    thumbnail: url(body.thumbnail, "thumbnail"),
    banner: url(body.banner, "banner"),
    isFeatured: body.isFeatured === undefined ? undefined : Boolean(body.isFeatured),
    seoTitle: text(body.seoTitle, "seoTitle", 255),
    seoDescription: text(body.seoDescription, "seoDescription", 1000),
    keywords: text(body.keywords, "keywords", 1000),
    organizer: text(body.organizer, "organizer", 255),
    tags: text(body.tags, "tags", 1000),
    categoryId: body.categoryId === undefined ? undefined : (typeof body.categoryId === "string" && body.categoryId ? body.categoryId : null),
    galleries,
  };
};

const handleError = (res, error, message, req) => {
  if (error.code === "P2002") return res.status(400).json({ success: false, message: "Slug must be unique" });
  if (error.code === "P2025") return res.status(404).json({ success: false, message: "Event not found" });
  if (error instanceof AppError) return res.status(error.status).json({ success: false, message: error.message });
  return serverError(res, error, message, req);
};

// Create Event
exports.createEvent = async (req, res) => {
  try {
    const { galleries, ...input } = parseEventInput(req.body);

    if (!input.title || !input.slug) {
      return res.status(400).json({ success: false, message: "Title and slug are required" });
    }

    const event = await prisma.event.create({
      data: {
        ...input,
        type: input.type || "PUBLIC",
        phase: input.phase || "UPCOMING",
        status: input.status || "DRAFT",
        isFeatured: input.isFeatured || false,
        categoryId: input.categoryId || null,
        galleries: { create: galleries || [] },
      },
      include: {
        galleries: true,
        category: true
      }
    });

    return res.status(201).json({ success: true, data: event });
  } catch (error) {
    return handleError(res, error, "Server error creating event", req);
  }
};

// Update Event
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { galleries, ...input } = parseEventInput(req.body);

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...input,
        // Only replace the gallery when the client sent one.
        ...(galleries ? { galleries: { deleteMany: {}, create: galleries } } : {}),
      },
      include: {
        galleries: true,
        category: true
      }
    });

    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    return handleError(res, error, "Server error updating event", req);
  }
};

// Delete Event
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.event.delete({ where: { id } });
    return res.status(200).json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    return handleError(res, error, "Server error deleting event", req);
  }
};

const buildFilters = (query, { publicOnly }) => {
  const { type, phase, status, search, categoryId, featured } = query;
  const where = {};
  if (typeof type === "string" && EVENT_TYPES.includes(type)) where.type = type;
  if (typeof phase === "string" && EVENT_PHASES.includes(phase)) where.phase = phase;
  if (publicOnly) {
    where.status = "PUBLISHED"; // drafts / archived events are never public
  } else if (typeof status === "string" && EVENT_STATUSES.includes(status)) {
    where.status = status;
  }
  if (typeof categoryId === "string" && categoryId) where.categoryId = categoryId;
  if (featured === "true") where.isFeatured = true;
  if (typeof search === "string" && search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { shortDescription: { contains: search, mode: "insensitive" } },
      { tags: { contains: search, mode: "insensitive" } }
    ];
  }
  return where;
};

// Public listing: published events only.
exports.getPublicEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: buildFilters(req.query, { publicOnly: true }),
      orderBy: { date: 'desc' },
      include: { category: true }
    });
    return res.status(200).json({ success: true, data: events });
  } catch (error) {
    return handleError(res, error, "Server error fetching events", req);
  }
};

// Admin listing: any status.
exports.getEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: buildFilters(req.query, { publicOnly: false }),
      orderBy: { date: 'desc' },
      include: { category: true }
    });
    return res.status(200).json({ success: true, data: events });
  } catch (error) {
    return handleError(res, error, "Server error fetching events", req);
  }
};

// Get Featured Events for Homepage
exports.getFeaturedEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED', isFeatured: true, type: 'PUBLIC' },
      orderBy: { date: 'desc' },
      take: 3,
      include: { category: true }
    });
    return res.status(200).json({ success: true, data: events });
  } catch (error) {
    return handleError(res, error, "Server error", req);
  }
};

// Public event page: published events only.
exports.getEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const event = await prisma.event.findUnique({
      where: { slug },
      include: { galleries: true, category: true }
    });

    if (!event || event.status !== "PUBLISHED") {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // Defence in depth: re-sanitize on the way out (covers rows stored before sanitization).
    event.fullDescription = sanitizeRichText(event.fullDescription);
    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    return handleError(res, error, "Server error", req);
  }
};

// Get Single Event By ID (Admin)
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: { galleries: true, category: true }
    });
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    return handleError(res, error, "Server error", req);
  }
};

exports.parseEventInput = parseEventInput;
