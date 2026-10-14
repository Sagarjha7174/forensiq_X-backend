const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { prisma, api, stop, resetState, makeUser, uploads } = require("./helpers/setup");
const { sanitizeRichText, safeUrl } = require("../utils/sanitize");
const { isOriginAllowed, normalizeOrigin } = require("../utils/corsPolicy");
const { detectFormat, validateUpload, safeDisplayName, safeFolder } = require("../utils/fileValidation");
const { isPrivateAddress } = require("../utils/publicUrl");

beforeEach(resetState);
after(stop);

/* ------------------------------ XSS ------------------------------ */
test("rich text sanitizer removes active content", () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
    '<svg onload="alert(1)"><circle/></svg>',
    '<iframe src="https://evil.example"></iframe>',
    '<div style="background:url(javascript:alert(1))">x</div>',
    '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    '<form action="https://evil.example"><input name=p></form>',
    '<p onclick="alert(1)">hi</p>',
  ];
  for (const p of payloads) {
    const out = sanitizeRichText(p).toLowerCase();
    for (const bad of ["<script", "onerror", "onload", "onclick", "javascript:", "data:text", "<svg", "<iframe", "style=", "<form", "<math"]) {
      assert.equal(out.includes(bad), false, `${p} -> ${out}`);
    }
  }
  assert.equal(sanitizeRichText('<p><strong>Bold</strong> <a href="https://ok.example">ok</a></p>'),
    '<p><strong>Bold</strong> <a href="https://ok.example" rel="noopener noreferrer nofollow">ok</a></p>');
});

test("URL fields accept only http(s) or site-relative paths", () => {
  for (const bad of ["javascript:alert(1)", " javascript:alert(1)", "data:text/html,x", "vbscript:x", "//evil.example/x", "file:///etc/passwd"]) {
    assert.throws(() => safeUrl(bad), undefined, bad);
  }
  assert.equal(safeUrl("https://ok.example/a"), "https://ok.example/a");
  assert.equal(safeUrl("/images/a.png"), "/images/a.png");
});

test("events: stored XSS is sanitized on write, javascript: links rejected, drafts not public", async () => {
  const staff = makeUser({ role: "ADMIN", is_sub_admin: true });
  const bad = await api("POST", "/api/v1/events/admin", { token: staff.token, body: { title: "E", slug: "e1", registrationLink: "javascript:alert(document.cookie)" } });
  assert.equal(bad.status, 400);

  const created = await api("POST", "/api/v1/events/admin", {
    token: staff.token,
    body: { title: "E", slug: "e2", status: "PUBLISHED", fullDescription: '<p>Hi</p><img src=x onerror=alert(1)><script>steal()</script>' },
  });
  assert.equal(created.status, 201);
  const stored = prisma.__store.event.find((e) => e.slug === "e2");
  assert.equal(/onerror|<script/i.test(stored.fullDescription), false);

  // legacy unsafe row is sanitized on read too
  prisma.seed("event", { title: "Old", slug: "old", status: "PUBLISHED", fullDescription: "<img src=x onerror=alert(1)>", galleries: [], category: null });
  const pub = await api("GET", "/api/v1/events/public/old");
  assert.equal(pub.status, 200);
  assert.equal(/onerror/i.test(pub.body.data.fullDescription), false);

  prisma.seed("event", { title: "Draft", slug: "draft", status: "DRAFT", galleries: [], category: null });
  assert.equal((await api("GET", "/api/v1/events/public/draft")).status, 404);
  const list = await api("GET", "/api/v1/events/public?status=DRAFT");
  assert.equal(list.body.data.some((e) => e.status !== "PUBLISHED"), false);
});

/* ------------------------------ CORS ------------------------------ */
test("CORS allowlist is exact", () => {
  const allowed = new Set(["https://forensiq.in", "https://app.forensiq.example", "http://localhost:3000"]);
  const ok = ["https://forensiq.in", "https://app.forensiq.example", "http://localhost:3000"];
  const bad = [
    "https://evil-forensiq.in", "https://forensiq.in.attacker.com", "https://attacker.vercel.app",
    "https://forensiq-frontend.vercel.app.evil.com", "http://forensiq.in", "https://forensiq.in:8443",
    "http://localhost:3001", "http://localhost.evil.com", "https://FORENSIQ.in", "https://forensiq.in/", "null", "",
  ];
  ok.forEach((o) => assert.equal(isOriginAllowed(o, allowed), true, o));
  bad.forEach((o) => assert.equal(isOriginAllowed(o, allowed), false, o));
  assert.equal(normalizeOrigin("javascript:alert(1)"), null);
});

test("CORS middleware: allowed origin echoed with credentials; others get no CORS headers", async () => {
  const good = await api("GET", "/api/v1/getSimpleCourses", { headers: { Origin: "https://app.forensiq.example" } });
  assert.equal(good.headers.get("access-control-allow-origin"), "https://app.forensiq.example");
  assert.equal(good.headers.get("access-control-allow-credentials"), "true");
  const evil = await api("GET", "/api/v1/getSimpleCourses", { headers: { Origin: "https://app.forensiq.example.evil.com" } });
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  const pre = await api("OPTIONS", "/api/v1/login", { headers: { Origin: "https://attacker.vercel.app", "Access-Control-Request-Method": "POST" } });
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
});

/* ------------------------------ Uploads ------------------------------ */
const tmpFile = (name, content) => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fq-")), "upload.bin");
  fs.writeFileSync(p, content);
  return { name, tempFilePath: p, size: Buffer.byteLength(content), truncated: false, mimetype: "application/pdf" };
};

test("file type is detected from content, not from client MIME or extension", () => {
  assert.equal(detectFormat(Buffer.from("%PDF-1.7\n")), "pdf");
  assert.equal(detectFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.throws(() => validateUpload(tmpFile("evil.pdf", "<html><script>alert(1)</script></html>"), ["document"]), /Unsupported/);
  assert.throws(() => validateUpload(tmpFile("x.svg", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), ["image", "document"]), /Unsupported/);
  assert.throws(() => validateUpload(tmpFile("x.exe", "MZ\x90\x00\x03\x00\x00\x00"), ["document"]), /Unsupported/);
  assert.throws(() => validateUpload(tmpFile("report.exe", "%PDF-1.7"), ["document"]), /extension/);
  assert.throws(() => validateUpload(tmpFile("pic.png", "%PDF-1.7"), ["image"]), /Unsupported/, "PDF not allowed where only images are");
  const big = tmpFile("big.pdf", "%PDF-1.7"); big.size = 50 * 1024 * 1024;
  assert.throws(() => validateUpload(big, ["document"]), /too large/);
  assert.equal(validateUpload(tmpFile("ok.pdf", "%PDF-1.7 content"), ["document"]).mime, "application/pdf");
});

test("display names and folders cannot traverse paths", () => {
  assert.equal(safeDisplayName("../../etc/passwd"), "passwd");
  assert.equal(safeDisplayName("..\\..\\win.ini").includes("\\"), false);
  assert.equal(safeDisplayName("<script>.pdf").includes("<"), false);
  assert.equal(safeFolder("../secrets"), "general");
  assert.equal(safeFolder("blogs"), "blogs");
});

test("upload endpoint: auth required, spoofed content rejected, valid file accepted, temp file removed", async () => {
  const { token } = makeUser();
  const html = new FormData();
  html.append("file", new Blob(["<html><script>alert(1)</script></html>"], { type: "application/pdf" }), "fake.pdf");
  assert.equal((await api("POST", "/api/v1/upload", { body: html })).status, 401);
  const rejected = await api("POST", "/api/v1/upload", { token, body: html });
  assert.equal(rejected.status, 400);

  const pdf = new FormData();
  pdf.append("file", new Blob(["%PDF-1.7\nreal"], { type: "text/plain" }), "../../doc.pdf");
  pdf.append("folder", "../../escape");
  const ok = await api("POST", "/api/v1/upload", { token, body: pdf });
  assert.equal(ok.status, 201, ok.text);
  assert.equal(ok.body.originalName, "doc.pdf");
  assert.equal(uploads.at(-1).options.folder, "forensiq/general");
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fs.existsSync(uploads.at(-1).filePath), false, "temp file cleaned up");

  const video = new FormData();
  video.append("file", new Blob([Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32])]), "v.mp4");
  assert.equal((await api("POST", "/api/v1/upload", { token, body: video })).status, 400, "students cannot upload video");
});

test("upload endpoint rejects files above the hard limit with 413", async () => {
  const { token } = makeUser();
  const big = new FormData();
  big.append("file", new Blob([Buffer.alloc(101 * 1024 * 1024, 0x41)]), "big.csv");
  const res = await api("POST", "/api/v1/upload", { token, body: big });
  assert.equal(res.status, 413);
});

/* ------------------------------ SSRF ------------------------------ */
test("stream proxy SSRF guard classifies private addresses", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.1", "172.16.0.1", "::1", "fd00::1", "::ffff:127.0.0.1", "0.0.0.0"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "142.250.1.1", "2606:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
});

/* ------------------------------ Errors ------------------------------ */
test("errors never leak stack traces or internal messages", async () => {
  const admin = makeUser({ role: "ADMIN" });
  const original = prisma.user.findMany;
  prisma.user.findMany = async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:5432 at /srv/app/node_modules/x.js:1:1"); };
  try {
    const res = await api("GET", "/api/v1/user/all", { token: admin.token });
    assert.equal(res.status, 500);
    assert.equal(/ECONNREFUSED|node_modules|stack|at \//.test(res.text), false, res.text);
    assert.ok(res.body.requestId);
  } finally {
    prisma.user.findMany = original;
  }
  const bad = await api("POST", "/api/v1/login", { body: "{bad json", headers: { "content-type": "application/json" } });
  assert.equal(bad.status, 400);
});

test("security headers are set", async () => {
  const res = await api("GET", "/api/v1/getSimpleCourses");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.ok(res.headers.get("content-security-policy"));
  assert.equal(res.headers.get("x-powered-by"), null);
  assert.ok(res.headers.get("x-request-id"));
});
