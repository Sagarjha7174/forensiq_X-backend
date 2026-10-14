const dns = require("dns").promises;
const net = require("net");
const { AppError } = require("./httpErrors");

/**
 * SSRF guard for server-side fetches of admin-configured URLs (e.g. the PDF stream proxy).
 * Only http(s) to hosts that resolve exclusively to public addresses are allowed.
 */
const isPrivateIPv4 = (ip) => {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
};

const isPrivateIPv6 = (ip) => {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
};

const isPrivateAddress = (ip) => (net.isIPv4(ip) ? isPrivateIPv4(ip) : isPrivateIPv6(ip));

async function assertPublicHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, "Invalid resource URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new AppError(400, "Invalid resource URL");
  if (url.username || url.password) throw new AppError(400, "Invalid resource URL");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new AppError(400, "Resource URL is not allowed");
  }
  return url.toString();
}

module.exports = { assertPublicHttpUrl, isPrivateAddress };
