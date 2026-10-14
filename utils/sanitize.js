const sanitizeHtml = require("sanitize-html");
const { AppError } = require("./httpErrors");

/**
 * Allowlist for admin-authored rich text (event descriptions, blog posts, announcements).
 * No scripts, no event handlers, no inline styles, no SVG/MathML, no forms, no iframes.
 * Links are forced to http(s)/mailto/tel and get rel="noopener noreferrer nofollow".
 */
const RICH_TEXT_OPTIONS = {
  allowedTags: [
    "p", "br", "hr", "span", "div", "blockquote", "pre", "code",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "mark", "small",
    "ul", "ol", "li",
    "a", "img",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    "*": ["class"],
  },
  allowedClasses: {
    // Quill editor formatting classes only
    "*": [/^ql-[a-z0-9-]+$/],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "noopener noreferrer nofollow",
        ...(attribs.target ? { target: "_blank" } : {}),
      },
    }),
  },
};

const sanitizeRichText = (html) => {
  if (html === null || html === undefined) return html;
  return sanitizeHtml(String(html), RICH_TEXT_OPTIONS);
};

/** Plain text: strip every tag. */
const sanitizePlainText = (value) => {
  if (value === null || value === undefined) return value;
  return sanitizeHtml(String(value), { allowedTags: [], allowedAttributes: {} });
};

/**
 * Validate a URL field that will be rendered as a link / media source.
 * Accepts absolute http(s) URLs or site-relative paths ("/images/x.png").
 * Rejects javascript:, data:, vbscript:, protocol-relative and malformed values.
 * Empty strings / null / undefined pass through unchanged.
 */
const safeUrl = (value, field = "url") => {
  if (value === null || value === undefined || value === "") return value;
  if (typeof value !== "string" || value.length > 2048) {
    throw new AppError(400, `Invalid ${field}`);
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError(400, `Invalid ${field}: must be an http(s) URL`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AppError(400, `Invalid ${field}: must be an http(s) URL`);
  }
  return parsed.toString();
};

module.exports = { sanitizeRichText, sanitizePlainText, safeUrl, RICH_TEXT_OPTIONS };
