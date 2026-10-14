const fs = require("fs");
const path = require("path");
const { AppError } = require("./httpErrors");
const logger = require("./logger");

/**
 * Upload validation based on file *content* (magic bytes) plus extension.
 * Client-supplied MIME types and filenames are never trusted.
 * SVG, HTML and other active/scriptable formats are deliberately not supported.
 */
const MB = 1024 * 1024;

const FORMATS = {
  jpeg: { category: "image", mime: "image/jpeg", exts: [".jpg", ".jpeg"] },
  png: { category: "image", mime: "image/png", exts: [".png"] },
  gif: { category: "image", mime: "image/gif", exts: [".gif"] },
  webp: { category: "image", mime: "image/webp", exts: [".webp"] },
  mp4: { category: "video", mime: "video/mp4", exts: [".mp4", ".m4v"] },
  mov: { category: "video", mime: "video/quicktime", exts: [".mov"] },
  webm: { category: "video", mime: "video/webm", exts: [".webm"] },
  pdf: { category: "document", mime: "application/pdf", exts: [".pdf"] },
  // ZIP container: docx/pptx/xlsx and plain zip archives
  zip: {
    category: "document",
    mime: "application/zip",
    exts: [".zip", ".docx", ".pptx", ".xlsx"],
  },
  // Legacy OLE compound files: doc/xls/ppt
  ole: { category: "document", mime: "application/x-ole-storage", exts: [".doc", ".xls", ".ppt"] },
  csv: { category: "document", mime: "text/csv", exts: [".csv"] },
};

const MAX_FILE_SIZES = { image: 10 * MB, document: 20 * MB, video: 100 * MB };
const MAX_UPLOAD_BYTES = 100 * MB; // must match the express-fileupload limit in index.js

const EXT_MIME = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
  ".xls": "application/vnd.ms-excel",
  ".ppt": "application/vnd.ms-powerpoint",
};

const readHead = (file, bytes = 4096) => {
  if (file.tempFilePath) {
    const fd = fs.openSync(file.tempFilePath, "r");
    try {
      const buf = Buffer.alloc(bytes);
      const read = fs.readSync(fd, buf, 0, bytes, 0);
      return buf.subarray(0, read);
    } finally {
      fs.closeSync(fd);
    }
  }
  return Buffer.isBuffer(file.data) ? file.data.subarray(0, bytes) : Buffer.alloc(0);
};

const startsWith = (buf, sig, offset = 0) =>
  buf.length >= offset + sig.length && sig.every((b, i) => buf[offset + i] === b);

/** Detect a supported format from magic bytes. Returns a FORMATS key or null. */
const detectFormat = (head) => {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";
  if (head.subarray(0, 6).toString("latin1") === "GIF87a" || head.subarray(0, 6).toString("latin1") === "GIF89a") return "gif";
  if (head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (head.subarray(4, 8).toString("latin1") === "ftyp") {
    return head.subarray(8, 12).toString("latin1") === "qt  " ? "mov" : "mp4";
  }
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  // CSV / plain text: no NUL bytes and decodes as UTF-8 without replacement chars
  if (head.length > 0 && !head.includes(0x00)) {
    const text = head.toString("utf8");
    if (!text.includes("�") && !/<\s*(script|html|svg|iframe)/i.test(text)) return "csv";
  }
  return null;
};

/** Strip directories, control characters and odd punctuation from a display filename. */
const safeDisplayName = (name, fallback = "attachment") => {
  const base = path.basename(String(name || "")).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "_").trim();
  const cleaned = base.replace(/^\.+/, "").slice(0, 150);
  return cleaned || fallback;
};

/**
 * Validate an express-fileupload file object.
 * @param {object} file
 * @param {string[]} categories allowed categories: "image" | "video" | "document"
 * @returns {{ format: string, category: string, mime: string, ext: string, displayName: string }}
 */
const validateUpload = (file, categories) => {
  if (!file || Array.isArray(file)) throw new AppError(400, "Exactly one file must be provided");
  if (file.truncated) throw new AppError(413, "File is too large");

  const ext = path.extname(String(file.name || "")).toLowerCase();
  const format = detectFormat(readHead(file));
  const spec = format ? FORMATS[format] : null;

  if (!spec || !categories.includes(spec.category)) {
    throw new AppError(400, "Unsupported file type");
  }
  if (!spec.exts.includes(ext)) {
    throw new AppError(400, "File extension does not match its content");
  }
  const size = Number(file.size) || 0;
  if (size > MAX_FILE_SIZES[spec.category]) {
    throw new AppError(413, `File is too large. Max allowed size for ${spec.category} is ${MAX_FILE_SIZES[spec.category] / MB}MB.`);
  }

  return {
    format,
    category: spec.category,
    mime: EXT_MIME[ext] || spec.mime,
    ext,
    displayName: safeDisplayName(file.name),
  };
};

/** Remove express-fileupload temp files; safe to call multiple times. */
const cleanupTempFiles = (files) => {
  if (!files) return;
  const list = Object.values(files).flatMap((f) => (Array.isArray(f) ? f : [f]));
  for (const f of list) {
    if (f?.tempFilePath) {
      fs.promises.unlink(f.tempFilePath).catch((err) => {
        if (err.code !== "ENOENT") logger.warn("Failed to remove temp upload", { error: err });
      });
    }
  }
};

/** Middleware: always delete temp upload files once the response is finished or aborted. */
const tempFileCleanup = (req, res, next) => {
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    cleanupTempFiles(req.files);
  };
  res.on("finish", cleanup);
  res.on("close", cleanup);
  next();
};

/** Cloudinary folder names: lowercase slug only, prevents path tricks like "../". */
const safeFolder = (value, fallback = "general") => {
  const v = String(value || "").trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(v) ? v : fallback;
};

module.exports = {
  validateUpload,
  detectFormat,
  safeDisplayName,
  safeFolder,
  cleanupTempFiles,
  tempFileCleanup,
  MAX_FILE_SIZES,
  MAX_UPLOAD_BYTES,
};
