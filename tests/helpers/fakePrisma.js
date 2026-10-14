/**
 * Minimal in-memory stand-in for PrismaClient used by the security regression tests.
 * Supports the query shapes used by the controllers under test: equality, OR/AND/NOT,
 * in / lt / lte / gt / gte / not / contains / equals (+ mode: "insensitive"), compound
 * unique keys (e.g. userId_courseId), atomic increments, nested `create` for
 * one-to-many children, and $transaction (callback or array).
 *
 * Relations are not resolved generically: tests store rows with the related objects
 * they need already attached (e.g. quiz.course = [...]); select/include are ignored.
 */
const crypto = require("crypto");

const MODELS = [
  "user", "course", "enrollment", "payment", "coupon", "couponUse", "quiz", "question",
  "attempt", "questionAttempt", "portalRequest", "portalMessage", "portalFile",
  "portalRequestActivity", "passwordResetOtp", "staffPendingAction", "event", "eventGallery",
  "notification", "networkEvent", "networkEventRegistration", "notes", "notice", "blog",
  "courseResource", "courseModule", "courseLecture", "courseAssignment", "courseAnnouncement",
  "serviceCatalogItem", "serviceCategory",
];

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
const norm = (v) => (v instanceof Date ? v.getTime() : v);

function matchValue(actual, cond) {
  if (!isPlainObject(cond)) return norm(actual) === norm(cond);
  const insensitive = cond.mode === "insensitive";
  const ci = (v) => (insensitive && typeof v === "string" ? v.toLowerCase() : v);
  for (const [op, expected] of Object.entries(cond)) {
    switch (op) {
      case "mode": break;
      case "equals": if (ci(norm(actual)) !== ci(norm(expected))) return false; break;
      case "in": if (!expected.map(norm).includes(norm(actual))) return false; break;
      case "notIn": if (expected.map(norm).includes(norm(actual))) return false; break;
      case "lt": if (!(norm(actual) < norm(expected))) return false; break;
      case "lte": if (!(norm(actual) <= norm(expected))) return false; break;
      case "gt": if (!(norm(actual) > norm(expected))) return false; break;
      case "gte": if (!(norm(actual) >= norm(expected))) return false; break;
      case "not": if (matchValue(actual, expected)) return false; break;
      case "contains": if (typeof actual !== "string" || !ci(actual).includes(ci(expected))) return false; break;
      case "some": return true; // relation filters are not modelled
      default: return false;
    }
  }
  return true;
}

function matches(row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "OR") { if (!cond.some((w) => matches(row, w))) return false; continue; }
    if (key === "AND") { if (!(Array.isArray(cond) ? cond : [cond]).every((w) => matches(row, w))) return false; continue; }
    if (key === "NOT") { if (matches(row, cond)) return false; continue; }
    if (!(key in row) && isPlainObject(cond) && key.includes("_") && !("equals" in cond)) {
      // compound unique, e.g. userId_courseId: { userId, courseId }
      if (!matches(row, cond)) return false;
      continue;
    }
    if (isPlainObject(cond) && isPlainObject(row[key]) && !Object.keys(cond).some((k) => ["equals", "in", "lt", "lte", "gt", "gte", "not", "contains", "mode", "notIn"].includes(k))) {
      // nested relation filter like course: { status: "ACTIVE" }
      if (!matches(row[key], cond)) return false;
      continue;
    }
    if (!matchValue(row[key], cond)) return false;
  }
  return true;
}

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && ("increment" in value || "decrement" in value)) {
      row[key] = (row[key] || 0) + (value.increment || 0) - (value.decrement || 0);
    } else if (isPlainObject(value) && ("create" in value || "connect" in value || "set" in value || "deleteMany" in value)) {
      if (Array.isArray(value.create)) row[key] = value.create.map((c) => ({ id: crypto.randomUUID(), ...c }));
      else if (isPlainObject(value.create)) row[key] = [{ id: crypto.randomUUID(), ...value.create }];
    } else {
      row[key] = value;
    }
  }
  return row;
}

const INT_ID_MODELS = new Set(["staffPendingAction", "networkEvent", "networkEventRegistration", "notification"]);
let autoId = 1000;
const newId = (name) => (INT_ID_MODELS.has(name) ? ++autoId : crypto.randomUUID());

function createModel(name, store) {
  const rows = () => store[name];
  const clone = (r) => (r ? { ...r } : null);
  return {
    async findUnique({ where }) { return clone(rows().find((r) => matches(r, where))); },
    async findFirst({ where, orderBy } = {}) {
      let list = rows().filter((r) => matches(r, where));
      if (orderBy) list = sortBy(list, orderBy);
      return clone(list[0]);
    },
    async findMany({ where, orderBy, take, skip } = {}) {
      let list = rows().filter((r) => matches(r, where));
      if (orderBy) list = sortBy(list, orderBy);
      if (skip) list = list.slice(skip);
      if (take) list = list.slice(0, take);
      return list.map(clone);
    },
    async count({ where } = {}) { return rows().filter((r) => matches(r, where)).length; },
    async create({ data }) {
      const now = new Date();
      const row = applyData({ id: data.id || newId(name), createdAt: now, updatedAt: now }, data);
      for (const u of store.__unique[name] || []) {
        if (row[u] !== undefined && row[u] !== null && rows().some((r) => r[u] === row[u])) {
          const err = new Error(`Unique constraint failed on ${u}`); err.code = "P2002"; throw err;
        }
      }
      rows().push(row);
      return clone(row);
    },
    async update({ where, data }) {
      const row = rows().find((r) => matches(r, where));
      if (!row) { const err = new Error("Record not found"); err.code = "P2025"; throw err; }
      applyData(row, { ...data, updatedAt: new Date() });
      return clone(row);
    },
    async updateMany({ where, data }) {
      const list = rows().filter((r) => matches(r, where));
      list.forEach((r) => applyData(r, { ...data, updatedAt: new Date() }));
      return { count: list.length };
    },
    async upsert({ where, create, update }) {
      const row = rows().find((r) => matches(r, where));
      if (row) { applyData(row, update); return clone(row); }
      return this.create({ data: create });
    },
    async delete({ where }) {
      const i = rows().findIndex((r) => matches(r, where));
      if (i < 0) { const err = new Error("Record not found"); err.code = "P2025"; throw err; }
      return rows().splice(i, 1)[0];
    },
    async deleteMany({ where } = {}) {
      const keep = rows().filter((r) => !matches(r, where));
      const count = rows().length - keep.length;
      store[name] = keep;
      return { count };
    },
  };
}

function sortBy(list, orderBy) {
  const [[key, dir]] = Object.entries(Array.isArray(orderBy) ? orderBy[0] : orderBy);
  return [...list].sort((a, b) => (norm(a[key]) > norm(b[key]) ? 1 : -1) * (dir === "desc" ? -1 : 1));
}

function createFakePrisma() {
  const store = { __unique: { user: ["email", "phone"], payment: ["cashfreeOrderId"], event: ["slug"], passwordResetOtp: ["email"], coupon: ["code"] } };
  for (const m of MODELS) store[m] = [];
  const prisma = { __store: store, rawQueries: [] };
  for (const m of MODELS) prisma[m] = createModel(m, store);
  prisma.$transaction = async (arg) => (typeof arg === "function" ? arg(prisma) : Promise.all(arg));
  prisma.$queryRaw = async (strings, ...values) => { prisma.rawQueries.push({ sql: strings.join("?"), values }); return []; };
  prisma.$executeRaw = async () => 0;
  prisma.$connect = async () => {};
  prisma.$disconnect = async () => {};
  prisma.reset = () => { for (const m of MODELS) store[m] = []; prisma.rawQueries = []; };
  prisma.seed = (model, row) => {
    const now = new Date();
    const full = { id: newId(model), createdAt: now, updatedAt: now, ...row };
    store[model].push(full);
    return full;
  };
  return prisma;
}

module.exports = { createFakePrisma };
