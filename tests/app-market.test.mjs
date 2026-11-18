import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { makeStorage } from "./sqlite-helper.mjs";
import { MarketStore, forwardMarketRequest, MARKET_ROOM, MARKET_TERMS_VERSION } from "../src/market.js";

test("real signed sessions and existing admin token protect the market routes", async () => {
  class BaseChatRoom { constructor(ctx) { this.ctx = ctx; } async fetch() { return Response.json({ messages: [] }); } }
  const context = vm.createContext({ URL, URLSearchParams, Request, Response, Headers, TextEncoder, TextDecoder, crypto, atob, btoa, console, BaseChatRoom, MarketStore, forwardMarketRequest, MARKET_ROOM, baseWorker: { fetch: async () => Response.json({ ok: true }) } });
  const source = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/^import .*;\n/gm, "").replace("export class ChatRoom", "class ChatRoom").replace("export default", "const worker =");
  vm.runInContext(source + "\nglobalThis.sut = {worker, ChatRoom, createSession};", context);
  const { sut } = context, objects = new Map(), rooms = [];
  const env = { SESSION_SECRET: "test-only-session-secret", ADMIN_TOKEN: "test-only-admin-token", CHAT_ROOM: { getByName(name) { rooms.push(name); if (!objects.has(name)) objects.set(name, new sut.ChatRoom(makeStorage().ctx)); return objects.get(name); } } };
  const alice = await sut.createSession({ sub: "a", name: "صاحب الإعلان", email: "a@example.invalid" }, env);
  const bob = await sut.createSession({ sub: "b", name: "شخص آخر", email: "b@example.invalid" }, env);
  let consentCookie = "";
  async function request(path, { method = "GET", body, token, headers = {} } = {}) {
    return sut.worker.fetch(new Request("https://market.test" + path, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...((token || consentCookie) ? { cookie: [token && "pcbr_session=" + token, consentCookie].filter(Boolean).join("; ") } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), env, {});
  }
  const body = { requestId: crypto.randomUUID(), kind: "wanted", category: "ic", title: "مطلوب آيسي شحن للاختبار", description: "حالة تجريبية لطلب آيسي وإثبات صلاحيات الجلسات.", country: "لبنان", city: "طرابلس", contactKind: "telegram", contact: "test_user", price: "", photos: [] };
  const forged = { "x-admin-authorized": "1", "x-pcbr-market-user": encodeURIComponent(JSON.stringify({ id: "a", name: "Fake" })) };
  assert.equal((await request("/api/market/listings", { method: "POST", body, headers: forged })).status, 401);
  assert.equal((await request("/api/market/listings")).status, 403);
  assert.equal((await request("/api/market/listings", { method: "POST", body, token: alice })).status, 403);
  const agreement = await request("/api/market/consent", { method: "POST", body: { accepted: true, version: MARKET_TERMS_VERSION } });
  assert.equal(agreement.status, 200);
  consentCookie = agreement.headers.get("set-cookie").split(";")[0];
  assert.equal((await (await request("/api/market/consent")).json()).accepted, true);
  const saved = await request("/api/market/listings", { method: "POST", body, token: alice });
  assert.equal(saved.status, 201); const item = (await saved.json()).listing;
  assert.equal(item.ownerName, "صاحب الإعلان"); assert.equal(item.isOwner, true);
  assert.equal((await (await request("/api/market/listings?mine=1", { token: bob })).json()).total, 0);
  assert.equal((await request(`/api/market/listings/${item.id}`, { method: "PATCH", token: bob, body: { ...body, version: 1 } })).status, 403);
  assert.equal((await request("/api/admin/market/overview", { headers: forged })).status, 401);
  const admin = { authorization: "Bearer " + env.ADMIN_TOKEN };
  assert.equal((await request("/api/admin/market/action", { method: "POST", headers: admin, body: { id: item.id, action: "hide" } })).status, 200);
  assert.equal((await request(`/api/market/listings/${item.id}`)).status, 404);
  assert.equal((await request(`/api/market/listings/${item.id}`, { token: alice })).status, 200);
  assert.equal((await request("/api/admin/overview", { headers: admin })).status, 200);
  assert.ok(rooms.includes("repair-market")); assert.ok(rooms.includes("repair-main"));
});
