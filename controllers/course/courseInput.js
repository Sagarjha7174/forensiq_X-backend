const { safeUrl } = require("../../utils/sanitize");
const { AppError } = require("../../utils/httpErrors");

const COURSE_STATUSES = ["ACTIVE", "INACTIVE", "DRAFT", "ARCHIVED"];

/** Validate/normalize staff-supplied course fields. Throws AppError(400) on bad input. */
const parseCourseInput = (body = {}) => {
  const out = {};
  const text = (v, field, max) => {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v !== "string" || v.length > max) throw new AppError(400, `Invalid ${field}`);
    return v.trim();
  };
  out.name = text(body.name, "name", 200);
  out.description = text(body.description, "description", 20000);
  out.class = text(body.courseClass ?? body.class, "courseClass", 120);
  out.teacher = text(body.teacher, "teacher", 200);
  out.degree = text(body.degree, "degree", 120);
  if (body.videoUrl !== undefined && body.videoUrl !== "") out.videoUrl = safeUrl(body.videoUrl, "videoUrl");
  if (body.imageUrl !== undefined && body.imageUrl !== "") out.imageUrl = safeUrl(body.imageUrl, "imageUrl");
  if (body.price !== undefined && body.price !== null && body.price !== "") {
    const price = Number(body.price);
    if (!Number.isInteger(price) || price < 0 || price > 10_000_000) {
      throw new AppError(400, "price must be a whole, non-negative amount");
    }
    out.price = price;
  }
  if (body.status !== undefined && body.status !== null && body.status !== "") {
    if (!COURSE_STATUSES.includes(body.status)) throw new AppError(400, "Invalid status");
    out.status = body.status;
  }
  return out;
};

module.exports = { parseCourseInput, COURSE_STATUSES };
