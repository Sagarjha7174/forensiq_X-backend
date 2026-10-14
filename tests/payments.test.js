const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { prisma, api, stop, resetState, makeUser } = require("./helpers/setup");
const Cashfree = require("../utils/cashfree");

beforeEach(resetState);
after(stop);

const sign = (timestamp, raw) =>
  crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(timestamp + raw).digest("base64");

async function postWebhook(payload, { tamper = false, signature } = {}) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const ts = String(Date.now());
  const sig = signature ?? sign(ts, raw);
  const body = tamper ? raw.replace('"payment_amount":499', '"payment_amount":1') : raw;
  const base = await require("./helpers/setup").start();
  const res = await fetch(`${base}/api/webhooks/cashfree`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", "x-webhook-signature": sig, "x-webhook-timestamp": ts },
    body,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function seedOrder({ amount = 499, status = "CREATED" } = {}) {
  const { user, token } = makeUser();
  const course = prisma.seed("course", { name: "Course", description: "d", price: 499, status: "ACTIVE" });
  const payment = prisma.seed("payment", { userId: user.id, courseId: course.id, cashfreeOrderId: `cf_${crypto.randomUUID().slice(0, 8)}`, amount, status, couponId: null });
  return { user, token, course, payment };
}

const successEvent = (orderId, amount = 499, currency = "INR") => ({
  type: "PAYMENT_SUCCESS_WEBHOOK",
  data: {
    order: { order_id: orderId, order_amount: amount, order_currency: currency },
    payment: { cf_payment_id: 123456, payment_status: "SUCCESS", payment_amount: amount, payment_currency: currency },
  },
});

test("webhook: valid signature fulfils exactly once (idempotent on duplicates)", async () => {
  const { payment } = seedOrder();
  const ev = successEvent(payment.cashfreeOrderId);
  assert.equal((await postWebhook(ev)).status, 200);
  assert.equal((await postWebhook(ev)).status, 200);
  assert.equal(prisma.__store.payment[0].status, "SUCCESS");
  assert.equal(prisma.__store.enrollment.length, 1);
});

test("webhook: invalid or missing signature is rejected without state change", async () => {
  const { payment } = seedOrder();
  const ev = successEvent(payment.cashfreeOrderId);
  assert.equal((await postWebhook(ev, { signature: "AAAA" })).status, 401);
  assert.equal((await postWebhook(ev, { tamper: true })).status, 401, "body modified after signing");
  const base = await require("./helpers/setup").start();
  const noHeaders = await fetch(`${base}/api/webhooks/cashfree`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ev) });
  assert.equal(noHeaders.status, 400);
  assert.equal(prisma.__store.payment[0].status, "CREATED");
  assert.equal(prisma.__store.enrollment.length, 0);
});

test("webhook: amount or currency mismatch is not fulfilled", async () => {
  const { payment } = seedOrder();
  assert.equal((await postWebhook(successEvent(payment.cashfreeOrderId, 1))).status, 200);
  assert.equal((await postWebhook(successEvent(payment.cashfreeOrderId, 499, "USD"))).status, 200);
  assert.equal(prisma.__store.payment[0].status, "CREATED");
  assert.equal(prisma.__store.enrollment.length, 0);
});

test("webhook: malformed JSON with a valid signature is rejected", async () => {
  // cashfree-pg parses the body as part of signature verification, so this surfaces as 401.
  const res = await postWebhook("{not json");
  assert.ok([400, 401].includes(res.status), `got ${res.status}`);
});

test("webhook: failed payment never downgrades a successful one", async () => {
  const { payment } = seedOrder({ status: "SUCCESS" });
  const ev = { type: "PAYMENT_FAILED_WEBHOOK", data: { order: { order_id: payment.cashfreeOrderId }, payment: { payment_status: "FAILED" } } };
  assert.equal((await postWebhook(ev)).status, 200);
  assert.equal(prisma.__store.payment[0].status, "SUCCESS");
});

test("browser confirmation cannot mark an unpaid order as paid", async () => {
  const { token, payment } = seedOrder();
  const original = Cashfree.PGOrderFetchPayments;
  try {
    Cashfree.PGOrderFetchPayments = async () => ({ data: [{ payment_status: "PENDING", payment_amount: 499 }] });
    assert.equal((await api("POST", "/api/v1/cashfree/confirm-transaction", { token, body: { orderId: payment.cashfreeOrderId } })).status, 400);

    Cashfree.PGOrderFetchPayments = async () => ({ data: [{ payment_status: "SUCCESS", payment_amount: 1, cf_payment_id: 9 }] });
    assert.equal((await api("POST", "/api/v1/cashfree/confirm-transaction", { token, body: { orderId: payment.cashfreeOrderId } })).status, 400, "amount mismatch");
    assert.equal(prisma.__store.enrollment.length, 0);

    Cashfree.PGOrderFetchPayments = async () => ({ data: [{ payment_status: "SUCCESS", payment_amount: 499, payment_currency: "INR", cf_payment_id: 9 }] });
    const other = makeUser();
    assert.equal((await api("POST", "/api/v1/cashfree/confirm-transaction", { token: other.token, body: { orderId: payment.cashfreeOrderId } })).status, 404, "not your order");
    assert.equal((await api("POST", "/api/v1/cashfree/confirm-transaction", { token, body: { orderId: payment.cashfreeOrderId } })).status, 200);
    assert.equal(prisma.__store.enrollment.length, 1);
  } finally {
    Cashfree.PGOrderFetchPayments = original;
  }
});

test("checkout: unpublished courses, existing and suspended enrollments are rejected", async () => {
  const { user, token } = makeUser();
  const draft = prisma.seed("course", { name: "D", description: "d", price: 100, status: "DRAFT" });
  assert.equal((await api("POST", "/api/v1/cashfree/create-order", { token, body: { courseId: draft.id } })).status, 400);

  const live = prisma.seed("course", { name: "L", description: "d", price: 0, status: "ACTIVE" });
  prisma.seed("enrollment", { userId: user.id, courseId: live.id, status: "ACTIVE" });
  assert.equal((await api("POST", "/api/v1/cashfree/create-order", { token, body: { courseId: live.id } })).status, 400);

  const live2 = prisma.seed("course", { name: "L2", description: "d", price: 0, status: "ACTIVE" });
  prisma.seed("enrollment", { userId: user.id, courseId: live2.id, status: "INACTIVE" });
  assert.equal((await api("POST", "/api/v1/cashfree/create-order", { token, body: { courseId: live2.id } })).status, 403);
});

test("checkout: free course enrols once; repeat purchase is rejected", async () => {
  const { token } = makeUser();
  const free = prisma.seed("course", { name: "F", description: "d", price: 0, status: "ACTIVE" });
  const first = await api("POST", "/api/v1/cashfree/create-order", { token, body: { courseId: free.id } });
  assert.equal(first.status, 200);
  assert.equal(first.body.isFree, true);
  const second = await api("POST", "/api/v1/cashfree/create-order", { token, body: { courseId: free.id } });
  assert.equal(second.status, 400);
  assert.equal(prisma.__store.enrollment.length, 1);
});

test("checkout: exhausted coupon cannot be redeemed", async () => {
  const { token } = makeUser();
  const course = prisma.seed("course", { name: "P", description: "d", price: 500, status: "ACTIVE" });
  prisma.seed("coupon", { code: "FREEALL", isActive: true, discountType: "FREE_COURSE", discountValue: 0, usageLimit: 1, usedCount: 1, perUserLimit: 1, applicableTo: "ALL_COURSES", courses: [] });
  const res = await api("POST", "/api/v1/cashfree/create-order", { token, body: { courseId: course.id, couponCode: "freeall" } });
  assert.equal(res.status, 400);
  assert.equal(prisma.__store.enrollment.length, 0);
});

test("checkout: paid order is persisted before calling Cashfree and old pending orders are kept", async () => {
  const { user, token } = makeUser();
  const course = prisma.seed("course", { name: "P", description: "d", price: 500, status: "ACTIVE" });
  prisma.seed("payment", { userId: user.id, courseId: course.id, cashfreeOrderId: "cf_old", amount: 500, status: "CREATED" });
  const original = Cashfree.PGCreateOrder;
  let recordExistedAtCall = false;
  try {
    process.env.PUBLIC_API_URL = "https://api.forensiq.example/";
    Cashfree.PGCreateOrder = async (req) => {
      recordExistedAtCall = prisma.__store.payment.some((p) => p.cashfreeOrderId === req.order_id);
      assert.equal(req.order_meta?.notify_url, "https://api.forensiq.example/api/webhooks/cashfree", "per-order webhook URL");
      return { data: { payment_session_id: "sess_1" } };
    };
    const res = await api("POST", "/api/v1/cashfree/create-order", { token, body: { courseId: course.id, amount: 1 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.amount, 500, "client-supplied amount is ignored");
    assert.ok(recordExistedAtCall);
    assert.ok(prisma.__store.payment.some((p) => p.cashfreeOrderId === "cf_old"));
  } finally {
    delete process.env.PUBLIC_API_URL;
    Cashfree.PGCreateOrder = original;
  }
});
