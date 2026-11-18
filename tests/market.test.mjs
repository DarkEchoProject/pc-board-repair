import test from "node:test";
import assert from "node:assert/strict";
import { makeStorage } from "./sqlite-helper.mjs";
import { MarketStore, forwardMarketRequest, MARKET_TERMS_VERSION } from "../src/market.js";

const alice = { id: "alice", name: "فني الاختبار" }, bob = { id: "bob", name: "مشارك آخر" };
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC2cAAAAASUVORK5CYII=";
function setup() {
  const { db, ctx } = makeStorage();
  const store = new MarketStore(ctx);
  const RAW = (path, method = "GET", body, user = alice, extra = {}) => store.fetch(new Request(`https://market.test${path}`, {
    method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(user ? { "x-pcbr-market-user": encodeURIComponent(JSON.stringify(user)) } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  const consent = RAW("/api/market/consent", "POST", { accepted: true, version: MARKET_TERMS_VERSION }, null).then(r => r.headers.get("set-cookie").split(";")[0]);
  const call = async (path, method = "GET", body, user = alice, extra = {}) => RAW(path, method, body, user, { cookie: await consent, ...extra });
  return { db, store, call, RAW, consent };
}
function listing(extra = {}) { return { requestId: crypto.randomUUID(), kind: "sale", category: "laptop-board", title: "بورد Dell خردة للقطع", description: "بورد للاختبار، توجد عليه بعض القطع الناقصة.", country: "لبنان", city: "طرابلس", condition: "donor", price: "25", currency: "USD", negotiable: true, contactKind: "whatsapp", contact: "+96170123456", photos: [], ...extra }; }
async function create(call, input = listing(), user = alice) { const r = await call("/api/market/listings", "POST", input, user); const data = await r.json(); assert.equal(r.status, 201, JSON.stringify(data)); return data.listing; }

test("public list, persistent SQLite records, filters and private owner fields", async () => {
  const { call, store, db } = setup();
  const item = await create(call);
  const anonymous = await (await call("/api/market/listings?region=tripoli&q=Dell", "GET", null, null)).json();
  assert.equal(anonymous.total, 1); assert.equal(anonymous.items[0].id, item.id); assert.equal(anonymous.items[0].isOwner, false);
  assert.equal("owner_id" in anonymous.items[0], false); assert.equal("ownerId" in anonymous.items[0], false);
  assert.equal((await (await call("/api/market/listings?region=world", "GET", null, null)).json()).total, 0);
  assert.equal((await (await call("/api/market/listings?kind=wanted", "GET", null, null)).json()).total, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM market_listings").get().n, 1);
  assert.equal((await (await call(`/api/market/listings/${item.id}`, "GET", null, null)).json()).listing.title, item.title);
});

test("write requires a session and edit/status require ownership", async () => {
  const { call } = setup(); const body = listing();
  assert.equal((await call("/api/market/listings", "POST", body, null)).status, 401);
  const item = await create(call, body);
  assert.equal((await call(`/api/market/listings/${item.id}`, "PATCH", { ...body, version: item.version }, bob)).status, 403);
  assert.equal((await call(`/api/market/listings/${item.id}/status`, "POST", { action: "delete", version: item.version }, bob)).status, 403);
  assert.equal((await call("/api/market/listings?mine=1", "GET", null, null)).status, 401);
});

test("retries do not duplicate posts; stale edits do not overwrite a newer version", async () => {
  const { call, db } = setup(); const body = listing(); const first = await create(call, body); const retry = await create(call, body);
  assert.equal(first.id, retry.id); assert.equal(db.prepare("SELECT COUNT(*) AS n FROM market_listings").get().n, 1);
  const edit = await call(`/api/market/listings/${first.id}`, "PATCH", { ...body, title: "بورد Dell بعد تحديث التفاصيل", version: 1 });
  assert.equal(edit.status, 200); assert.equal((await edit.json()).listing.version, 2);
  assert.equal((await call(`/api/market/listings/${first.id}`, "PATCH", { ...body, version: 1 })).status, 409);
});

test("closing, reopening and removing a post update public visibility", async () => {
  const { call } = setup(); const item = await create(call);
  assert.equal((await call(`/api/market/listings/${item.id}/status`, "POST", { action: "close", version: 1 })).status, 200);
  assert.equal((await (await call("/api/market/listings", "GET", null, null)).json()).total, 0);
  assert.equal((await (await call("/api/market/listings?mine=1")).json()).total, 1);
  assert.equal((await call(`/api/market/listings/${item.id}/replies`, "POST", { text: "هل القطعة موجودة؟", requestId: crypto.randomUUID() }, bob)).status, 409);
  assert.equal((await call(`/api/market/listings/${item.id}/status`, "POST", { action: "reopen", version: 2 })).status, 200);
  assert.equal((await call(`/api/market/listings/${item.id}/status`, "POST", { action: "delete", version: 3 })).status, 200);
  assert.equal((await call(`/api/market/listings/${item.id}`, "GET", null, null)).status, 404);
});

test("wanted posts, international search and long Arabic searches", async () => {
  const { call } = setup();
  await create(call, listing({ kind: "wanted", price: "", category: "ic", country: "الأردن", city: "عمان", title: "مطلوب آيسي شحن للابتوب", description: "أبحث عن آيسي شحن BQ24780S لإكمال إصلاح بورد لابتوب." }));
  const result = await (await call("/api/market/listings?kind=wanted&region=world&q=" + encodeURIComponent("آيسي شحن BQ24780S لإكمال إصلاح بورد لابتوب"), "GET", null, null)).json();
  assert.equal(result.total, 1); assert.equal(result.items[0].condition, "any");
  assert.equal((await (await call("/api/market/listings?q=" + encodeURIComponent("%' OR 1=1--"), "GET", null, null)).json()).total, 0);
});

test("photo round trip, HEAD/304, size validation and photo ownership", async () => {
  const { call } = setup(); const a = await create(call, listing({ photos: [{ mime: "image/png", data: png }] }));
  const image = await call(a.photos[0].url, "GET", null, null);
  assert.equal(image.status, 200); assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(Buffer.from(await image.arrayBuffer()).toString("base64"), png);
  const head = await call(a.photos[0].url, "HEAD", null, null); assert.equal(head.body, null);
  const cached = await call(a.photos[0].url, "GET", null, null, { "if-none-match": `"${a.photos[0].id}"` }); assert.equal(cached.status, 304); assert.equal(cached.body, null);
  const b = await create(call, listing(), bob);
  assert.equal((await call(`/api/market/listings/${b.id}`, "PATCH", { ...listing(), version: 1, retainedPhotos: [a.photos[0].id] }, bob)).status, 403);
  assert.equal((await call("/api/market/listings", "POST", listing({ photos: [{ mime: "image/svg+xml", data: btoa('<svg onload="alert(1)"></svg>') }] }))).status, 400);
  assert.equal((await call("/api/market/listings", "POST", listing({ photos: [{ mime: "image/png", data: "a".repeat(250000) }] }))).status, 400);
  await call("/api/admin/market/action", "POST", { id: a.id, action: "hide" }, null, { "x-admin-authorized": "1" });
  assert.equal((await call(a.photos[0].url, "GET", null, null)).status, 404);
  const adminImage = "/api/admin/market/images/" + a.photos[0].id;
  assert.equal((await call(adminImage, "GET", null, null)).status, 403);
  const reviewed = await call(adminImage, "GET", null, null, { "x-admin-authorized": "1" });
  assert.equal(reviewed.status, 200); assert.equal(reviewed.headers.get("cache-control"), "no-store");
  assert.equal(Buffer.from(await reviewed.arrayBuffer()).toString("base64"), png);
  assert.equal((await call(`/api/market/listings/${a.id}/status`, "POST", { action: "delete", version: 2 })).status, 200);
  assert.equal((await call(a.photos[0].url, "GET", null, null)).status, 404);
});

test("replies and reports are idempotent and available to admin moderation", async () => {
  const { call } = setup(); const item = await create(call);
  const reply = { text: "عندي بورد مشابه، هل هذا الموديل مناسب؟", requestId: crypto.randomUUID() };
  assert.equal((await call(`/api/market/listings/${item.id}/replies`, "POST", reply, bob)).status, 201);
  assert.equal((await call(`/api/market/listings/${item.id}/replies`, "POST", reply, bob)).status, 201);
  const detail = await (await call(`/api/market/listings/${item.id}`, "GET", null, null)).json(); assert.equal(detail.replies.length, 1); assert.equal(detail.replies[0].isOwner, false);
  await call(`/api/market/listings/${item.id}/report`, "POST", { reason: "معلومات مضللة", details: "فحص تجريبي" }, bob);
  await call(`/api/market/listings/${item.id}/report`, "POST", { reason: "معلومات مضللة" }, bob);
  assert.equal((await call("/api/admin/market/overview", "GET", null, null)).status, 403);
  const overview = await (await call("/api/admin/market/overview", "GET", null, null, { "x-admin-authorized": "1" })).json(); assert.equal(overview.total, 1); assert.equal(overview.items[0].reports.length, 1);
  await call("/api/admin/market/action", "POST", { id: item.id, action: "hide" }, null, { "x-admin-authorized": "1" });
  assert.equal((await call(`/api/market/listings/${item.id}`, "GET", null, null)).status, 404);
  assert.equal((await call(`/api/market/listings/${item.id}`)).status, 200);
  await call("/api/admin/market/action", "POST", { id: item.id, action: "restore" }, null, { "x-admin-authorized": "1" });
  assert.equal((await call(`/api/market/listings/${item.id}`, "GET", null, null)).status, 200);
});

test("validation and rate limits fail cleanly without partially saved records", async () => {
  const { call, db } = setup();
  for (const extra of [{ category: "phones" }, { contact: "javascript:alert(1)" }, { title: "x" }, { price: "-1" }, { condition: "any" }]) assert.equal((await call("/api/market/listings", "POST", listing(extra))).status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM market_listings").get().n, 0);
  for (let i = 0; i < 10; i++) await create(call);
  assert.equal((await call("/api/market/listings", "POST", listing())).status, 429);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM market_listings").get().n, 10);
});

test("proxy rejects forged identity, cross-origin writes and anonymous mine", async () => {
  const { store, consent } = setup(); let received;
  const env = { CHAT_ROOM: { getByName(name) { assert.equal(name, "repair-market"); return { fetch(req) { received = req; return store.fetch(req); } }; } } };
  const forged = new Request("https://market.test/api/market/listings", { method: "POST", headers: { "content-type": "application/json", "x-admin-authorized": "1", "x-pcbr-market-user": encodeURIComponent(JSON.stringify(alice)) }, body: JSON.stringify(listing()) });
  assert.equal((await forwardMarketRequest(forged, env, null)).status, 401);
  const request = new Request("https://market.test/api/market/listings", { headers: { cookie: await consent, "x-admin-authorized": "1", "x-pcbr-market-user": encodeURIComponent(JSON.stringify(alice)) } });
  assert.equal((await forwardMarketRequest(request, env, null)).status, 200); assert.equal(received.headers.has("x-pcbr-market-user"), false); assert.equal(received.headers.has("x-admin-authorized"), false);
  assert.equal((await forwardMarketRequest(new Request("https://market.test/api/market/listings?mine=1"), env, null)).status, 401);
  const cross = new Request("https://market.test/api/market/listings", {method:"POST",headers:{origin:"https://other.test","content-type":"application/json"},body:JSON.stringify(listing())});
  assert.equal((await forwardMarketRequest(cross, env, { sub: "alice", name: "Alice" })).status, 403);
});

test("market consent is mandatory for reads, writes and images and expires on version change", async () => {
  const { RAW, call, db, consent } = setup();
  const item = await create(call, listing({ photos: [{ mime: "image/png", data: png }] }));
  for (const path of ["/api/market/listings", "/api/market/listings?mine=1", "/api/market/listings/" + item.id, item.photos[0].url]) {
    const r = await RAW(path);
    assert.equal(r.status, 403); assert.equal((await r.json()).code, "market_consent_required");
  }
  assert.equal((await RAW("/api/market/listings", "POST", listing())).status, 403);
  assert.equal((await RAW("/api/market/consent", "POST", { accepted: false, version: MARKET_TERMS_VERSION }, null)).status, 403);
  assert.equal((await RAW("/api/market/consent", "POST", { accepted: true, version: "old" }, null)).status, 403);
  assert.equal((await RAW("/api/market/listings", "GET", null, null, { cookie: "pcbr_market_consent=" + crypto.randomUUID() })).status, 403);
  assert.equal((await (await call("/api/market/consent")).json()).accepted, true);
  db.prepare("UPDATE market_consents SET version='old' WHERE token=?").run((await consent).split("=")[1]);
  assert.equal((await call("/api/market/listings")).status, 403);
  assert.equal((await (await call("/api/market/consent")).json()).accepted, false);
});
