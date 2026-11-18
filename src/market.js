// Market data uses a separate named instance of the existing SQLite-backed binding.
export const MARKET_ROOM = "repair-market";
// Bump this value and the client terms version whenever the displayed terms change.
export const MARKET_TERMS_VERSION = "2026-11-18-v1";
const CONSENT_COOKIE = "pcbr_market_consent", CONSENT_SECONDS = 30 * 24 * 60 * 60;
const CONSENT_PATH = "/api/market/consent";
function consentToken(request) {
  const value = (request.headers.get("cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(CONSENT_COOKIE + "="))?.slice(CONSENT_COOKIE.length + 1) || "";
  return UUID.test(value) ? value : "";
}
export const MARKET_CATEGORIES = {
  "desktop-board": "بورد كمبيوتر مكتبي", "laptop-board": "بورد لابتوب",
  "graphics-board": "بورد كرت شاشة", ic: "آيسي", mosfet: "MOSFET وقطع تغذية",
  connector: "موصل أو منفذ", "computer-part": "قطعة كمبيوتر", "other-part": "قطعة صيانة أخرى",
};
const CONDITIONS = new Set(["working", "faulty", "donor", "untested", "new", "any"]);
const MAX_PHOTOS = 3, MAX_PHOTO_BYTES = 180 * 1024, MAX_BODY = 900000, PAGE_SIZE = 18;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v, max = 120) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
const line = (v, max) => text(v, max).replace(/\s+/g, " ");
const norm = v => String(v ?? "").normalize("NFKC").toLowerCase().replace(/[\u064b-\u065f\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim();
const digits = v => String(v ?? "").replace(/[٠-٩]/g, x => String(x.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, x => String(x.charCodeAt(0) - 1776));
const pageNumber = value => Math.min(10000, Math.max(1, Number.parseInt(value, 10) || 1));
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra } });
class MarketError extends Error {
  constructor(message, status = 400, code = "invalid_request") { super(message); this.status = status; this.code = code; }
}
function fail(message, status, code) { throw new MarketError(message, status, code); }
function userFrom(request) {
  try {
    const user = JSON.parse(decodeURIComponent(request.headers.get("x-pcbr-market-user") || ""));
    return typeof user.id === "string" && user.id.length > 0 && user.id.length <= 160
      ? { id: user.id, name: line(user.name, 60) || "مستخدم" } : null;
  } catch { return null; }
}
function signedIn(user) { if (!user) fail("سجّل الدخول لإضافة إعلان أو المشاركة في السوق.", 401, "sign_in_required"); return user; }

export async function forwardMarketRequest(request, env, user) {
  const url = new URL(request.url);
  const write = !["GET", "HEAD"].includes(request.method);
  if (!["GET", "HEAD", "POST", "PATCH", "DELETE"].includes(request.method)) return json({ error: "الطريقة غير مدعومة." }, 405);
  if (write && ((request.headers.get("origin") && request.headers.get("origin") !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site")) return json({ error: "طلب غير مسموح من هذا المصدر." }, 403);
  if (url.pathname !== CONSENT_PATH && (write || url.searchParams.get("mine") === "1") && !user) return json({ error: "سجّل الدخول لإضافة إعلان أو إدارته.", code: "sign_in_required" }, 401);
  // Never forward identity/admin headers supplied by a visitor.
  const headers = new Headers();
  for (const key of ["content-type", "if-none-match"]) if (request.headers.has(key)) headers.set(key, request.headers.get(key));
  const token = consentToken(request);
  if (token) headers.set("cookie", CONSENT_COOKIE + "=" + token);
  if (user) headers.set("x-pcbr-market-user", encodeURIComponent(JSON.stringify({ id: user.sub, name: user.name || "مستخدم" })));
  return env.CHAT_ROOM.getByName(MARKET_ROOM).fetch(new Request(request, { headers }));
}

async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || "")) fail("صيغة الطلب غير صحيحة.", 415);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) fail("حجم الصور أكبر من المسموح.", 413);
  if (!request.body) fail("الطلب فارغ.");
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); fail("حجم الصور أكبر من المسموح.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { const data = JSON.parse(new TextDecoder().decode(bytes)); if (!data || Array.isArray(data) || typeof data !== "object") throw 0; return data; }
  catch { fail("تعذّر قراءة البيانات المرسلة."); }
}

function photoDimensions(bytes, mime) {
  if (mime === "image/png") {
    if (bytes.length < 45 || ![137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (mime !== "image/jpeg" || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return null;
  let p = 2;
  while (p + 8 < bytes.length) {
    if (bytes[p++] !== 255) return null;
    while (bytes[p] === 255) p++;
    const marker = bytes[p++];
    if (marker === 218 || marker === 217) return null;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const length = (bytes[p] << 8) | bytes[p + 1];
    if (length < 2 || p + length > bytes.length) return null;
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) return [(bytes[p + 5] << 8) | bytes[p + 6], (bytes[p + 3] << 8) | bytes[p + 4]];
    p += length;
  }
  return null;
}
function decodePhotos(input) {
  if (!Array.isArray(input) || input.length > MAX_PHOTOS) fail("يمكن إضافة ثلاث صور كحد أقصى.");
  return input.map(photo => {
    if (!photo || typeof photo.data !== "string" || photo.data.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(photo.data)) fail("بيانات الصورة غير صالحة.");
    let bytes;
    try { bytes = Uint8Array.from(atob(photo.data), c => c.charCodeAt(0)); } catch { fail("تعذّر قراءة الصورة."); }
    if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) fail("إحدى الصور أكبر من الحجم المسموح.", 413);
    const dimensions = photoDimensions(bytes, photo.mime);
    if (!dimensions || dimensions.some(n => !n || n > 1600) || dimensions[0] * dimensions[1] > 2560000) fail("صيغة الصورة أو أبعادها غير مدعومة. اختر صورة عادية للقطعة.");
    return { id: crypto.randomUUID(), mime: photo.mime, bytes };
  });
}
function contact(value, kind) {
  let v = line(value, 100);
  if (kind === "telegram") {
    v = v.replace(/^https?:\/\/(?:www\.)?t\.me\//i, "").replace(/^@/, "").replace(/\/$/, "");
    if (!/^[A-Za-z0-9_]{3,32}$/.test(v)) fail("اكتب اسم مستخدم تلغرام صحيحًا.");
    return { value: v, url: `https://t.me/${encodeURIComponent(v)}` };
  }
  if (!["whatsapp", "phone"].includes(kind)) fail("اختر وسيلة تواصل صحيحة.");
  v = digits(v).replace(/[\s()\-]/g, "").replace(/^00/, "+");
  if (!/^\+[1-9][0-9]{7,14}$/.test(v)) fail("اكتب الرقم مع مفتاح الدولة، مثل ‎+96170123456.");
  return { value: v, url: kind === "whatsapp" ? `https://wa.me/${v.slice(1)}` : `tel:${v}` };
}
function fields(body, user) {
  const kind = body.kind;
  if (!["sale", "wanted"].includes(kind)) fail("اختر للبيع أو مطلوب.");
  if (!Object.hasOwn(MARKET_CATEGORIES, body.category)) fail("اختر تصنيفًا لبورد كمبيوتر أو قطعة صيانة.");
  const title = line(body.title, 120), description = text(body.description, 2500), country = line(body.country, 60), city = line(body.city, 60);
  if (title.length < 6) fail("اكتب عنوانًا واضحًا من ستة أحرف على الأقل.");
  if (description.length < 12) fail("أضف تفاصيل القطعة وحالتها أو ما تحتاجه.");
  if (country.length < 2 || city.length < 2) fail("أضف الدولة والمدينة.");
  const condition = kind === "wanted" ? "any" : body.condition;
  if (!CONDITIONS.has(condition) || (kind === "sale" && condition === "any")) fail("اختر حالة البورد أو القطعة.");
  const currency = ["USD", "LBP", "EUR"].includes(body.currency) ? body.currency : "USD";
  const priceInput = digits(body.price ?? "").trim();
  const negotiable = body.negotiable === true;
  if (priceInput && !/^\d{1,12}(?:\.\d{1,2})?$/.test(priceInput)) fail("اكتب سعرًا صحيحًا وغير سالب.");
  if (kind === "sale" && !priceInput && !negotiable) fail("أدخل السعر أو اختر أن السعر على الاتفاق.");
  const c = contact(body.contact, body.contactKind);
  const delivery = ["pickup", "shipping", "agreement"].includes(body.delivery) ? body.delivery : "agreement";
  const ownerName = line(body.displayName, 60) || user.name;
  const model = line(body.model, 120), partNumber = line(body.partNumber, 80);
  const countryKey = ["لبنان", "lebanon", "lb"].includes(norm(country)) ? "LB" : "OTHER";
  const cityKey = /طرابلس|tripoli/.test(norm(city)) ? "tripoli" : norm(city);
  return { kind, category: body.category, title, description, country, city, condition, currency, price: priceInput || null, negotiable: negotiable ? 1 : 0, delivery, ownerName, model, partNumber, contactKind: body.contactKind, contact: c.value, contactUrl: c.url, countryKey, cityKey, searchText: norm([title, description, model, partNumber, country, city].join(" ")) };
}

export class MarketStore {
  constructor(ctx) {
    this.storage = ctx.storage;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS market_listings (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, owner_name TEXT NOT NULL, request_key TEXT NOT NULL,
      kind TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      model TEXT NOT NULL, part_number TEXT NOT NULL, condition TEXT NOT NULL, price TEXT, currency TEXT NOT NULL,
      negotiable INTEGER NOT NULL, country TEXT NOT NULL, city TEXT NOT NULL, country_key TEXT NOT NULL, city_key TEXT NOT NULL,
      delivery TEXT NOT NULL, contact_kind TEXT NOT NULL, contact_value TEXT NOT NULL, contact_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', moderated INTEGER NOT NULL DEFAULT 0, search_text TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(owner_id, request_key)
    )`);
    this.sql.exec("CREATE INDEX IF NOT EXISTS market_public ON market_listings(moderated, status, created_at)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS market_owner ON market_listings(owner_id, created_at)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS market_photos (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, mime TEXT NOT NULL, data BLOB NOT NULL, position INTEGER NOT NULL)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS market_photo_listing ON market_photos(listing_id, position)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS market_replies (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, owner_id TEXT NOT NULL, owner_name TEXT NOT NULL, request_key TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, UNIQUE(owner_id, request_key))");
    this.sql.exec("CREATE INDEX IF NOT EXISTS market_reply_listing ON market_replies(listing_id, deleted, created_at)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS market_reports (listing_id TEXT NOT NULL, owner_id TEXT NOT NULL, reason TEXT NOT NULL, details TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(listing_id, owner_id))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS market_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS market_limit_expiry ON market_limits(expires)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS market_consents (token TEXT PRIMARY KEY, version TEXT NOT NULL, expires INTEGER NOT NULL)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS market_consent_expiry ON market_consents(expires)");
  }
  accepted(request) {
    const token = consentToken(request);
    return !!(token && this.one("SELECT token FROM market_consents WHERE token=? AND version=? AND expires>?", token, MARKET_TERMS_VERSION, Date.now()));
  }
  async consent(request, url) {
    if (request.method === "GET") return json({ accepted: this.accepted(request), version: MARKET_TERMS_VERSION });
    if (request.method !== "POST") return json({ error: "الطريقة غير مدعومة." }, 405);
    const body = await readJson(request);
    if (body.accepted !== true || body.version !== MARKET_TERMS_VERSION) fail("اقرأ الشروط الحالية ووافق عليها أولًا.", 403, "market_consent_required");
    if (this.accepted(request)) return json({ accepted: true, version: MARKET_TERMS_VERSION });
    const token = crypto.randomUUID(), now = Date.now();
    this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM market_consents WHERE expires<=?", now);
      this.sql.exec("INSERT INTO market_consents(token,version,expires) VALUES(?,?,?)", token, MARKET_TERMS_VERSION, now + CONSENT_SECONDS * 1000);
    });
    const secure = url.protocol === "https:" ? "; Secure" : "";
    return json({ accepted: true, version: MARKET_TERMS_VERSION }, 200, { "set-cookie": CONSENT_COOKIE + "=" + token + "; Path=/api/market/; Max-Age=" + CONSENT_SECONDS + "; HttpOnly; SameSite=Lax" + secure });
  }
  rows(query, ...args) { return this.sql.exec(query, ...args).toArray(); }
  one(query, ...args) { return this.rows(query, ...args)[0]; }
  listing(id) { return this.one("SELECT * FROM market_listings WHERE id=? AND status!='deleted'", id); }
  visible(row, user) { return row && (!row.moderated || row.owner_id === user?.id); }
  own(row, user) { signedIn(user); if (!row) fail("الإعلان غير موجود.", 404); if (row.owner_id !== user.id) fail("يمكنك تعديل إعلاناتك فقط.", 403); }
  rate(user, action, max, window) {
    const now = Date.now(), key = `${action}:${user.id}`;
    this.sql.exec("DELETE FROM market_limits WHERE expires < ?", now);
    const current = this.one("SELECT count, expires FROM market_limits WHERE key=?", key);
    if (current && current.count >= max) fail("وصلت إلى حد المحاولات لهذه الفترة. حاول لاحقًا.", 429, "rate_limited");
    this.sql.exec("INSERT INTO market_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1", key, now + window);
  }
  output(row, user) {
    return {
      id: row.id, kind: row.kind, category: row.category, title: row.title, description: row.description,
      model: row.model, partNumber: row.part_number, condition: row.condition, price: row.price, currency: row.currency,
      negotiable: !!row.negotiable, country: row.country, city: row.city, delivery: row.delivery,
      contactKind: row.contact_kind, contact: row.contact_value, contactUrl: row.contact_url, ownerName: row.owner_name,
      status: row.status, moderated: !!row.moderated, isOwner: row.owner_id === user?.id, version: row.version,
      createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
      photos: this.rows("SELECT id FROM market_photos WHERE listing_id=? ORDER BY position", row.id).map(p => ({ id: p.id, url: `/api/market/images/${p.id}` })),
      replyCount: this.one("SELECT COUNT(*) AS n FROM market_replies WHERE listing_id=? AND deleted=0", row.id).n,
    };
  }
  list(url, user) {
    const mine = url.searchParams.get("mine") === "1";
    if (mine) signedIn(user);
    const where = ["status!='deleted'"], args = [];
    if (mine) { where.push("owner_id=?"); args.push(user.id); }
    else where.push("moderated=0", "status='active'");
    const kind = url.searchParams.get("kind"), category = url.searchParams.get("category"), region = url.searchParams.get("region");
    if (["sale", "wanted"].includes(kind)) { where.push("kind=?"); args.push(kind); }
    if (Object.hasOwn(MARKET_CATEGORIES, category)) { where.push("category=?"); args.push(category); }
    if (region === "tripoli") where.push("country_key='LB'", "city_key='tripoli'");
    if (region === "lebanon") where.push("country_key='LB'");
    if (region === "world") where.push("country_key!='LB'");
    const query = norm(text(url.searchParams.get("q"), 100));
    if (query) { where.push("instr(search_text,?)>0"); args.push(query); }
    const filter = where.join(" AND "), page = pageNumber(url.searchParams.get("page"));
    const total = this.one(`SELECT COUNT(*) AS n FROM market_listings WHERE ${filter}`, ...args).n;
    const rows = this.rows(`SELECT * FROM market_listings WHERE ${filter} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, ...args, PAGE_SIZE, (page - 1) * PAGE_SIZE);
    return json({ items: rows.map(row => this.output(row, user)), total, page, pages: Math.ceil(total / PAGE_SIZE), pageSize: PAGE_SIZE });
  }
  detail(id, url, user) {
    const row = this.listing(id);
    if (!this.visible(row, user)) fail("الإعلان غير موجود أو لم يعد متاحًا.", 404);
    const page = pageNumber(url.searchParams.get("replyPage")), size = 20;
    const total = this.one("SELECT COUNT(*) AS n FROM market_replies WHERE listing_id=? AND deleted=0", id).n;
    const replies = this.rows("SELECT * FROM market_replies WHERE listing_id=? AND deleted=0 ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?", id, size, (page - 1) * size).reverse().map(r => ({ id: r.id, name: r.owner_name, text: r.body, createdAt: new Date(r.created_at).toISOString(), isOwner: r.owner_id === user?.id }));
    return json({ listing: this.output(row, user), replies, replyPage: page, replyPages: Math.ceil(total / size) });
  }
  async save(request, id, user) {
    signedIn(user);
    const body = await readJson(request), value = fields(body, user);
    const requestKey = line(body.requestId, 36);
    if (!id && !UUID.test(requestKey)) fail("أعد فتح نافذة الإعلان ثم حاول مجددًا.");
    const retained = body.retainedPhotos ?? [];
    if (!Array.isArray(retained) || retained.length > MAX_PHOTOS || retained.some(p => typeof p !== "string" || !UUID.test(p)) || new Set(retained).size !== retained.length) fail("قائمة الصور غير صحيحة.");
    if (!id && retained.length) fail("لا يمكن إرفاق صور إعلان آخر.");
    const photos = decodePhotos(body.photos ?? []);
    if (retained.length + photos.length > MAX_PHOTOS) fail("يمكن إضافة ثلاث صور كحد أقصى.");
    const now = Date.now(); let savedId = id || crypto.randomUUID();
    this.storage.transactionSync(() => {
      if (!id) {
        const previous = this.one("SELECT id,status FROM market_listings WHERE owner_id=? AND request_key=?", user.id, requestKey);
        if (previous) { if (previous.status === "deleted") fail("هذا الإعلان أزيل سابقًا.", 409); savedId = previous.id; return; }
      }
      let current;
      if (id) {
        current = this.listing(id); this.own(current, user);
        if (Number(body.version) !== current.version) fail("تغيّر الإعلان. أعد فتحه قبل حفظ تعديل جديد.", 409, "version_conflict");
        const allowed = new Set(this.rows("SELECT id FROM market_photos WHERE listing_id=?", id).map(p => p.id));
        if (retained.some(p => !allowed.has(p))) fail("لا يمكن إرفاق صور إعلان آخر.", 403);
      }
      this.rate(user, id ? "edit" : "create", id ? 60 : 10, 3600000);
      const vals = [value.ownerName, value.kind, value.category, value.title, value.description, value.model, value.partNumber, value.condition, value.price, value.currency, value.negotiable, value.country, value.city, value.countryKey, value.cityKey, value.delivery, value.contactKind, value.contact, value.contactUrl, value.searchText, now];
      if (id) {
        this.sql.exec("UPDATE market_listings SET owner_name=?,kind=?,category=?,title=?,description=?,model=?,part_number=?,condition=?,price=?,currency=?,negotiable=?,country=?,city=?,country_key=?,city_key=?,delivery=?,contact_kind=?,contact_value=?,contact_url=?,search_text=?,updated_at=?,version=version+1 WHERE id=?", ...vals, id);
        for (const p of this.rows("SELECT id FROM market_photos WHERE listing_id=?", id)) if (!retained.includes(p.id)) this.sql.exec("DELETE FROM market_photos WHERE id=?", p.id);
      } else {
        this.sql.exec("INSERT INTO market_listings(id,owner_id,request_key,owner_name,kind,category,title,description,model,part_number,condition,price,currency,negotiable,country,city,country_key,city_key,delivery,contact_kind,contact_value,contact_url,search_text,updated_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", savedId, user.id, requestKey, ...vals, now);
      }
      retained.forEach((p, i) => this.sql.exec("UPDATE market_photos SET position=? WHERE id=? AND listing_id=?", i, p, savedId));
      photos.forEach((p, i) => this.sql.exec("INSERT INTO market_photos(id,listing_id,mime,data,position) VALUES(?,?,?,?,?)", p.id, savedId, p.mime, p.bytes.buffer.slice(p.bytes.byteOffset, p.bytes.byteOffset + p.bytes.byteLength), retained.length + i));
    });
    return json({ listing: this.output(this.listing(savedId), user) }, id ? 200 : 201);
  }
  async change(request, id, user) {
    const body = await readJson(request);
    this.storage.transactionSync(() => {
      const row = this.listing(id); this.own(row, user);
      if (Number(body.version) !== row.version) fail("تغيّر الإعلان. أعد فتحه وحاول مجددًا.", 409, "version_conflict");
      if (!["close", "reopen", "delete"].includes(body.action)) fail("اختر إجراءً صحيحًا.");
      this.rate(user, "edit", 60, 3600000);
      this.sql.exec("UPDATE market_listings SET status=?,updated_at=?,version=version+1 WHERE id=?", { close: "closed", reopen: "active", delete: "deleted" }[body.action], Date.now(), id);
    });
    return json({ ok: true });
  }
  async reply(request, id, user) {
    signedIn(user); const body = await readJson(request), message = text(body.text, 1200), key = line(body.requestId, 36);
    if (message.length < 2 || !UUID.test(key)) fail("أضف ردًا واضحًا ثم حاول مجددًا.");
    let replyId = crypto.randomUUID();
    this.storage.transactionSync(() => {
      const row = this.listing(id);
      if (!row || row.moderated) fail("الإعلان غير متاح.", 404);
      if (row.status !== "active") fail("أغلق صاحب الإعلان الطلب أو العرض.", 409);
      const previous = this.one("SELECT id FROM market_replies WHERE owner_id=? AND request_key=?", user.id, key);
      if (previous) { replyId = previous.id; return; }
      this.rate(user, "reply", 30, 900000);
      this.sql.exec("INSERT INTO market_replies(id,listing_id,owner_id,owner_name,request_key,body,created_at) VALUES(?,?,?,?,?,?,?)", replyId, id, user.id, user.name, key, message, Date.now());
    });
    return json({ ok: true, id: replyId }, 201);
  }
  async report(request, id, user) {
    signedIn(user); const body = await readJson(request), reason = line(body.reason, 100), details = text(body.details, 500);
    if (reason.length < 3) fail("اختر سبب الإبلاغ.");
    this.storage.transactionSync(() => {
      if (!this.listing(id)) fail("الإعلان غير موجود.", 404);
      if (this.one("SELECT listing_id FROM market_reports WHERE listing_id=? AND owner_id=?", id, user.id)) return;
      this.rate(user, "report", 10, 86400000);
      this.sql.exec("INSERT INTO market_reports(listing_id,owner_id,reason,details,created_at) VALUES(?,?,?,?,?)", id, user.id, reason, details, Date.now());
    });
    return json({ ok: true });
  }
  image(request, id, user, admin = false) {
    const photo = this.one("SELECT p.*,l.moderated,l.status,l.owner_id FROM market_photos p JOIN market_listings l ON l.id=p.listing_id WHERE p.id=? AND l.status!='deleted'", id);
    if (!photo || (!admin && photo.moderated && photo.owner_id !== user?.id)) fail("الصورة غير موجودة.", 404);
    const headers = { "content-type": photo.mime, "cache-control": admin ? "no-store" : "private, no-store", "x-content-type-options": "nosniff", etag: `"${id}"` };
    if (!admin && request.headers.get("if-none-match") === headers.etag) return new Response(null, { status: 304, headers });
    const data = photo.data instanceof ArrayBuffer ? new Uint8Array(photo.data) : photo.data;
    return new Response(request.method === "HEAD" ? null : data, { headers: { ...headers, "content-length": String(data.byteLength) } });
  }
  async admin(request, url) {
    if (request.headers.get("x-admin-authorized") !== "1") fail("غير مصرح.", 403);
    const image = url.pathname.match(/^\/api\/admin\/market\/images\/([a-f0-9-]{36})$/i);
    if (image && ["GET", "HEAD"].includes(request.method)) return this.image(request, image[1], null, true);
    if (request.method === "GET" && url.pathname === "/api/admin/market/overview") {
      const filter = url.searchParams.get("filter") || "reported", page = pageNumber(url.searchParams.get("page"));
      const where = ["l.status!='deleted'"];
      if (filter === "reported") where.push("EXISTS(SELECT 1 FROM market_reports r WHERE r.listing_id=l.id)");
      if (filter === "hidden") where.push("l.moderated=1");
      const total = this.one(`SELECT COUNT(*) AS n FROM market_listings l WHERE ${where.join(" AND ")}`).n;
      const rows = this.rows(`SELECT l.* FROM market_listings l WHERE ${where.join(" AND ")} ORDER BY l.created_at DESC LIMIT 20 OFFSET ?`, (page - 1) * 20);
      return json({ items: rows.map(row => ({ ...this.output(row, null), reports: this.rows("SELECT reason,details,created_at AS time FROM market_reports WHERE listing_id=? ORDER BY created_at DESC LIMIT 20", row.id) })), total, page, pages: Math.ceil(total / 20) });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/market/action") {
      const body = await readJson(request);
      if (!UUID.test(String(body.id)) || !["hide", "restore", "dismiss"].includes(body.action)) fail("إجراء غير صحيح.");
      this.storage.transactionSync(() => {
        if (!this.listing(body.id)) fail("الإعلان غير موجود.", 404);
        if (body.action === "dismiss") this.sql.exec("DELETE FROM market_reports WHERE listing_id=?", body.id);
        else this.sql.exec("UPDATE market_listings SET moderated=?,updated_at=?,version=version+1 WHERE id=?", body.action === "hide" ? 1 : 0, Date.now(), body.id);
      });
      return json({ ok: true });
    }
    fail("غير موجود.", 404);
  }
  async fetch(request) {
    try {
      const url = new URL(request.url), user = userFrom(request);
      if (url.pathname.startsWith("/api/admin/market/")) return await this.admin(request, url);
      if (url.pathname === CONSENT_PATH) return await this.consent(request, url);
      if (!this.accepted(request)) fail("يجب قراءة شروط السوق وإخلاء المسؤولية والموافقة عليها أولًا.", 403, "market_consent_required");
      if (url.pathname === "/api/market/listings") {
        if (request.method === "GET") return this.list(url, user);
        if (request.method === "POST") return await this.save(request, null, user);
      }
      const image = url.pathname.match(/^\/api\/market\/images\/([a-f0-9-]{36})$/i);
      if (image && ["GET", "HEAD"].includes(request.method)) return this.image(request, image[1], user);
      const match = url.pathname.match(/^\/api\/market\/listings\/([a-f0-9-]{36})(?:\/(status|replies|report))?$/i);
      if (match) {
        const [, id, action] = match;
        if (!UUID.test(id)) fail("غير موجود.", 404);
        if (!action && request.method === "GET") return this.detail(id, url, user);
        if (!action && request.method === "PATCH") return await this.save(request, id, user);
        if (action === "status" && request.method === "POST") return await this.change(request, id, user);
        if (action === "replies" && request.method === "POST") return await this.reply(request, id, user);
        if (action === "report" && request.method === "POST") return await this.report(request, id, user);
      }
      fail("غير موجود.", 404);
    } catch (error) {
      if (error instanceof MarketError) return json({ error: error.message, code: error.code }, error.status);
      console.error("Market storage request failed", error?.name || "Error", String(error?.message || "").slice(0, 160));
      return json({ error: "تعذّر تنفيذ الطلب الآن. حاول مجددًا بعد قليل." }, 503);
    }
  }
}
