import baseWorker, { ChatRoom as BaseChatRoom } from "./index.js";
import { forwardMarketRequest, MarketStore, MARKET_ROOM } from "./market.js";
import { backupPage } from "./backup.js";

const SITE = "https://pc-board-repair.alinasser00001.workers.dev";
const SESSION_COOKIE = "pcbr_session";
const OAUTH_STATE_COOKIE = "pcbr_oauth_state";
const OAUTH_NEXT_COOKIE = "pcbr_oauth_next";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const SITE_ADMIN_ROOM = "site-admin";
const SITE_ADMIN_PATH = "/api/admin/site/";
const ADMIN_ATTEMPT_LIMIT = 5;
const ADMIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
function adminTooMany(retryAfter) {
  return new Response(JSON.stringify({error:"محاولات كثيرة. أعد المحاولة بعد " + Math.max(1,Math.ceil(retryAfter/60)) + " دقيقة."}), {
    status:429,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","retry-after":String(retryAfter)}
  });
}
async function checkAdminAccess(request,env,url,configuredToken,suppliedToken) {
  if (!suppliedToken) return json({error:"كلمة مرور الإدارة غير صحيحة."},401);
  const ip=(request.headers.get("CF-Connecting-IP")||"local").slice(0,128);
  const key=bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC",await hmacKey(configuredToken),encoder.encode(ip))));
  return internalSite(env,url.origin,"admin-auth-check",{key,valid:suppliedToken===configuredToken});
}
function internalSite(env, origin, action, data) {
  return env.CHAT_ROOM.getByName(SITE_ADMIN_ROOM).fetch(new Request(new URL(SITE_ADMIN_PATH+action,origin),{
    method:data?"POST":"GET",headers:{"content-type":"application/json","x-admin-authorized":"1"},...(data?{body:JSON.stringify(data)}:{})
  }));
}
async function observeUser(env,origin,user) {
  try {await internalSite(env,origin,"observe",{id:user.sub,name:user.name});} catch {}
}
async function canParticipate(env,origin,user) {
  const r=await internalSite(env,origin,"participation",{id:user.sub});
  if(!r.ok)throw Error("Participation check unavailable");
  return !(await r.json()).suspended;
}
function sameSite(request,url) {
  const origin=request.headers.get("origin");
  return (!origin||origin===url.origin)&&request.headers.get("sec-fetch-site")!=="cross-site";
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

const cleanId = value => String(value ?? "").trim().slice(0, 80);
const cleanText = (value, max = 120) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const item = part.trim();
    const eq = item.indexOf("=");
    if (eq < 0) continue;
    if (item.slice(0, eq) === name) return item.slice(eq + 1);
  }
  return "";
}

function safeNext(value) {
  const next = String(value || "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.startsWith("/api/auth/")) return "/";
  return next.slice(0, 1000);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function textToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToText(value) {
  return decoder.decode(base64UrlToBytes(value));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function sessionSigningSecret(env) {
  return String(env.SESSION_SECRET || "").trim();
}

function sessionVerificationSecrets(env) {
  const current = String(env.SESSION_SECRET || "").trim();
  return current ? [current] : [];
}

async function createSession(user, env) {
  const secret = sessionSigningSecret(env);
  if (!secret) throw new Error("Session secret unavailable");
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: cleanText(user.sub, 160),
    email: cleanText(user.email, 254),
    name: cleanText(user.name || user.email?.split("@")[0] || "مستخدم", 80),
    iat: now,
    exp: now + SESSION_SECONDS,
  };
  const body = textToBase64Url(JSON.stringify(payload));
  const key = await hmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${bytesToBase64Url(signature)}`;
}

async function getSessionUser(request, env) {
  const secrets = sessionVerificationSecrets(env);
  if (!secrets.length) return null;
  const token = getCookie(request, SESSION_COOKIE);
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    let valid = false;
    for (const secret of secrets) {
      const key = await hmacKey(secret);
      valid = await crypto.subtle.verify(
        "HMAC",
        key,
        base64UrlToBytes(parts[1]),
        encoder.encode(parts[0]),
      );
      if (valid) break;
    }
    if (!valid) return null;
    const payload = JSON.parse(base64UrlToText(parts[0]));
    if (!payload?.sub || !payload?.email || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
    return {
      sub: cleanText(payload.sub, 160),
      email: cleanText(payload.email, 254),
      name: cleanText(payload.name || payload.email.split("@")[0], 80),
    };
  } catch {
    return null;
  }
}

function setCookie(headers, value) {
  headers.append("set-cookie", value);
}

function clearCookie(name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function authConfigured(env) {
  return Boolean(String(env.GOOGLE_CLIENT_ID || "").trim() && String(env.GOOGLE_CLIENT_SECRET || "").trim());
}

async function startGoogleAuth(request, env) {
  if (!authConfigured(env)) {
    return new Response("تسجيل الدخول غير مفعّل بعد. يجب إعداد GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في Cloudflare.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next") || "/");
  const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const redirectUri = `${SITE}/api/auth/google/callback`;
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", String(env.GOOGLE_CLIENT_ID).trim());
  google.searchParams.set("redirect_uri", redirectUri);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("prompt", "select_account");

  const headers = new Headers({ location: google.toString(), "cache-control": "no-store" });
  setCookie(headers, `${OAUTH_STATE_COOKIE}=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
  setCookie(headers, `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
  return new Response(null, { status: 302, headers });
}

async function finishGoogleAuth(request, env) {
  if (!authConfigured(env)) {
    return new Response("تسجيل الدخول غير مفعّل بعد.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const expectedState = getCookie(request, OAUTH_STATE_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response("تعذر التحقق من عملية تسجيل الدخول. حاول مرة أخرى.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const redirectUri = `${SITE}/api/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: String(env.GOOGLE_CLIENT_ID).trim(),
      client_secret: String(env.GOOGLE_CLIENT_SECRET).trim(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return new Response("فشل تسجيل الدخول بواسطة Google. حاول مرة أخرى.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const tokenData = await tokenResponse.json();
  const accessToken = String(tokenData.access_token || "");
  if (!accessToken) {
    return new Response("لم يتم استلام بيانات الدخول من Google.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) {
    return new Response("تعذر قراءة بيانات حساب Google.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const googleUser = await userResponse.json();
  if (!googleUser?.sub || !googleUser?.email || googleUser.email_verified === false) {
    return new Response("يجب استخدام حساب Google ببريد إلكتروني موثّق.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const session = await createSession(googleUser, env);
  await observeUser(env,new URL(request.url).origin,googleUser);
  let next = "/";
  try { next = safeNext(decodeURIComponent(getCookie(request, OAUTH_NEXT_COOKIE) || "%2F")); } catch {}

  const headers = new Headers({ location: `${SITE}${next}`, "cache-control": "no-store" });
  setCookie(headers, `${SESSION_COOKIE}=${session}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`);
  setCookie(headers, clearCookie(OAUTH_STATE_COOKIE));
  setCookie(headers, clearCookie(OAUTH_NEXT_COOKIE));
  return new Response(null, { status: 302, headers });
}

class BrandHead {
  constructor(pathname) {
    this.isHomePage = pathname === "/" || pathname === "/index.html";
  }

  element(element) {
    const favicon = ""; // canonical favicon is applied by seo-entry.js
    element.prepend(
      `${favicon}<link rel="stylesheet" href="/brand.css"><link rel="stylesheet" href="/auth.css"><meta name="theme-color" content="#07111f"><script src="/auth-ui.js?v=20261119-1" defer></script><script src="/i18n-extra.js" defer></script>`,
      { html: true },
    );
  }
}

function withBrand(response, pathname) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  return new HTMLRewriter().on("head", new BrandHead(pathname)).transform(response);
}

export class ChatRoom extends BaseChatRoom {
  async siteAdmin(request,url) {
    const sql=this.ctx.storage.sql;
    if(!this.siteSchemaReady){
    sql.exec("CREATE TABLE IF NOT EXISTS site_accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL,first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL,suspended INTEGER NOT NULL DEFAULT 0)");
    sql.exec("CREATE TABLE IF NOT EXISTS site_issues(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,user_name TEXT NOT NULL,kind TEXT NOT NULL,page TEXT NOT NULL,description TEXT NOT NULL,created INTEGER NOT NULL,resolved INTEGER NOT NULL DEFAULT 0)");
    sql.exec("CREATE INDEX IF NOT EXISTS site_issues_user_created ON site_issues(user_id,created)");
    sql.exec("CREATE TABLE IF NOT EXISTS site_config(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS site_admin_attempts(key TEXT PRIMARY KEY,failures INTEGER NOT NULL,expires INTEGER NOT NULL)");
    sql.exec("CREATE INDEX IF NOT EXISTS site_admin_attempts_expiry ON site_admin_attempts(expires)");
    sql.exec("CREATE TABLE IF NOT EXISTS site_admin_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,created INTEGER NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL)");
    sql.exec("CREATE INDEX IF NOT EXISTS site_admin_audit_created ON site_admin_audit(created)");
    this.siteSchemaReady=true;
    }
    const rows=(q,...a)=>sql.exec(q,...a).toArray(),one=(q,...a)=>rows(q,...a)[0];
    const settings=()=>{try{return JSON.parse(one("SELECT value FROM site_config WHERE key='settings'")?.value||"{}");}catch{return {};}};
    const action=url.pathname.slice(SITE_ADMIN_PATH.length),now=Date.now();
    const pruneAudit=()=>{
      sql.exec("DELETE FROM site_admin_audit WHERE created<?",now-180*86400000);
      sql.exec("DELETE FROM site_admin_audit WHERE id IN (SELECT id FROM site_admin_audit ORDER BY id DESC LIMIT -1 OFFSET 10000)");
    };
    if(request.method==="GET"){
      if(action==="notice"||action==="settings"){
        const s=settings();return json({enabled:s.enabled===true,text:action==="notice"&&!s.enabled?"":s.text||"",tone:s.tone||"info"});
      }
      if(action==="summary")return json({users:one("SELECT COUNT(*) AS n FROM site_accounts").n,suspended:one("SELECT COUNT(*) AS n FROM site_accounts WHERE suspended=1").n,openIssues:one("SELECT COUNT(*) AS n FROM site_issues WHERE resolved=0").n,totalIssues:one("SELECT COUNT(*) AS n FROM site_issues").n,noticeEnabled:settings().enabled===true});
      const page=Math.max(1,Math.min(100000,parseInt(url.searchParams.get("page"),10)||1)),limit=30,offset=(page-1)*limit;
      if(action==="backup"){
        const data=backupPage(sql,"site",url);return data?json(data):json({error:"طلب تصدير غير صالح."},400);
      }
      if(action==="audit"){
        pruneAudit();
        return json({items:rows("SELECT id,created,action,target FROM site_admin_audit ORDER BY id DESC LIMIT ? OFFSET ?",limit,offset),total:one("SELECT COUNT(*) AS n FROM site_admin_audit").n,page,limit});
      }
      if(action==="users")return json({items:rows("SELECT id,name,first_seen,last_seen,suspended FROM site_accounts ORDER BY last_seen DESC LIMIT ? OFFSET ?",limit,offset),total:one("SELECT COUNT(*) AS n FROM site_accounts").n,page,limit});
      if(action==="issues"){
        const filter=url.searchParams.get("filter"),where=filter==="all"?"":filter==="resolved"?" WHERE resolved=1":" WHERE resolved=0";
        return json({items:rows("SELECT id,user_name,kind,page,description,created,resolved FROM site_issues"+where+" ORDER BY created DESC LIMIT ? OFFSET ?",limit,offset),total:one("SELECT COUNT(*) AS n FROM site_issues"+where).n,page,limit});
      }
    }
    if(request.method!=="POST")return json({error:"غير موجود."},404);
    const body=await readBody(request);
    if(!body||typeof body!=="object")return json({error:"طلب غير صالح."},400);
    if(action==="audit-record"){
      const code=String(body.action||""),target=cleanText(body.target,160);
      if(!["market.hide","market.restore","market.dismiss","chat.delete","chat.dismiss","user.suspend","user.resume","issue.resolve","issue.reopen","notice.enable","notice.disable"].includes(code)||!target)return json({error:"طلب غير صالح."},400);
      sql.exec("INSERT INTO site_admin_audit(created,action,target) VALUES(?,?,?)",now,code,target);
      pruneAudit();
      return json({ok:true});
    }
    if(action==="admin-auth-check"){
      const key=String(body.key||"");
      if(!/^[A-Za-z0-9_-]{43}$/.test(key)||typeof body.valid!=="boolean")return json({error:"طلب غير صالح."},400);
      const row=one("SELECT failures,expires FROM site_admin_attempts WHERE key=?",key);
      if(row&&row.expires>now&&row.failures>=ADMIN_ATTEMPT_LIMIT)return adminTooMany(Math.max(1,Math.ceil((row.expires-now)/1000)));
      if(body.valid){
        if(row)sql.exec("DELETE FROM site_admin_attempts WHERE key=?",key);
        return json({ok:true});
      }
      sql.exec("DELETE FROM site_admin_attempts WHERE expires<=?",now);
      const failures=row&&row.expires>now?row.failures+1:1;
      const expires=failures>=ADMIN_ATTEMPT_LIMIT?now+ADMIN_ATTEMPT_WINDOW_MS:(row&&row.expires>now?row.expires:now+ADMIN_ATTEMPT_WINDOW_MS);
      sql.exec("INSERT INTO site_admin_attempts(key,failures,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,expires=excluded.expires",key,failures,expires);
      if(failures>=ADMIN_ATTEMPT_LIMIT)return adminTooMany(Math.max(1,Math.ceil((expires-now)/1000)));
      return json({error:"كلمة مرور الإدارة غير صحيحة."},401);
    }
    const id=cleanText(body.id,160),name=cleanText(body.name,80)||"مستخدم";
    if(action==="observe"||action==="participation"){
      if(!id)return json({error:"حساب غير صالح."},400);
      if(action==="observe")sql.exec("INSERT INTO site_accounts(id,name,first_seen,last_seen) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,last_seen=excluded.last_seen WHERE site_accounts.last_seen<? OR site_accounts.name!=excluded.name",id,name,now,now,now-3600000);
      return json({suspended:!!one("SELECT suspended FROM site_accounts WHERE id=?",id)?.suspended});
    }
    if(action==="user-action"){
      if(!id||typeof body.suspended!=="boolean"||!one("SELECT id FROM site_accounts WHERE id=?",id))return json({error:"حساب غير موجود أو طلب غير صالح."},400);
      sql.exec("UPDATE site_accounts SET suspended=? WHERE id=?",body.suspended?1:0,id);return json({ok:true});
    }
    if(action==="submit-issue"){
      const kind=cleanText(body.kind,100),page=cleanText(body.page,500),description=cleanText(body.description,700);
      if(!id||!["رابط أو تنزيل لا يعمل","ملف غير مطابق أو معلومة خاطئة","مشكلة في تسجيل الدخول","مشكلة في عرض الموقع","شكوى أو اقتراح"].includes(kind)||!description)return json({error:"أكمل نوع المشكلة ووصفها."},400);
      if(page){try{const u=new URL(page);if(!["https:","http:"].includes(u.protocol))throw 0;}catch{return json({error:"رابط غير صالح."},400);}}
      if(one("SELECT COUNT(*) AS n FROM site_issues WHERE user_id=? AND created>?",id,now-86400000).n>=5)return json({error:"وصلت إلى حد البلاغات اليومية."},429);
      sql.exec("INSERT INTO site_issues(id,user_id,user_name,kind,page,description,created) VALUES(?,?,?,?,?,?,?)",crypto.randomUUID(),id,name,kind,page,description,now);
      return json({ok:true},201);
    }
    if(action==="issue-action"){
      if(!id||typeof body.resolved!=="boolean"||!one("SELECT id FROM site_issues WHERE id=?",id))return json({error:"البلاغ غير موجود."},404);
      sql.exec("UPDATE site_issues SET resolved=? WHERE id=?",body.resolved?1:0,id);return json({ok:true});
    }
    if(action==="settings"){
      const text=cleanText(body.text,300),tone=["info","warning","success"].includes(body.tone)?body.tone:"info";
      if(typeof body.enabled!=="boolean"||(body.enabled&&!text))return json({error:"اكتب نص التنبيه قبل تفعيله."},400);
      const value={enabled:body.enabled,text,tone};
      sql.exec("INSERT INTO site_config(key,value) VALUES('settings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify(value));return json(value);
    }
    return json({error:"غير موجود."},404);
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/market/") || url.pathname.startsWith("/api/admin/market/")) {
      this.marketStore ||= new MarketStore(this.ctx);
      return this.marketStore.fetch(request);
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (request.headers.get("x-admin-authorized") !== "1") {
        return json({ error: "غير مصرح." }, 403);
      }

      if (url.pathname.startsWith(SITE_ADMIN_PATH)) return this.siteAdmin(request,url);

      if(request.method==="GET"&&url.pathname==="/api/admin/chat/backup"){
        const messages=(await this.ctx.storage.get("messages"))||[],reportCounts=(await this.ctx.storage.get("reportCounts"))||{};
        return json({messages,reportCounts});
      }
      if (request.method === "GET" && url.pathname === "/api/admin/overview") {
        const messages = (await this.ctx.storage.get("messages")) || [];
        const reports = (await this.ctx.storage.get("reportCounts")) || {};
        const items = messages.map(message => ({
          ...message,
          reportCount: Number(reports[message.id]) || 0,
        }));
        const reported = items
          .filter(item => item.reportCount > 0)
          .sort((a, b) => b.reportCount - a.reportCount || String(b.time || "").localeCompare(String(a.time || "")));
        const totalReports = reported.reduce((sum, item) => sum + item.reportCount, 0);
        return json({
          messages: items,
          reported,
          summary: {
            messages: items.length,
            reportedMessages: reported.length,
            totalReports,
          },
        });
      }

      if (request.method === "POST" && url.pathname === "/api/admin/delete-message") {
        const body = await readBody(request);
        if (!body) return json({ error: "طلب غير صالح." }, 400);
        const id = cleanId(body.id);
        const messages = (await this.ctx.storage.get("messages")) || [];
        const exists = messages.some(item => item.id === id);
        if (!exists) return json({ error: "الرسالة غير موجودة." }, 404);

        const updated = messages.filter(item => item.id !== id);
        const reports = (await this.ctx.storage.get("reportCounts")) || {};
        delete reports[id];
        await this.ctx.storage.put("messages", updated);
        await this.ctx.storage.put("reportCounts", reports);
        return json({ ok: true, remaining: updated.length });
      }

      if (request.method === "POST" && url.pathname === "/api/admin/dismiss-report") {
        const body = await readBody(request);
        if (!body) return json({ error: "طلب غير صالح." }, 400);
        const id = cleanId(body.id);
        const reports = (await this.ctx.storage.get("reportCounts")) || {};
        delete reports[id];
        await this.ctx.storage.put("reportCounts", reports);
        return json({ ok: true });
      }

      return json({ error: "Not found" }, 404);
    }

    return super.fetch(request);
  }
}

function getAdminToken(request) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return (request.headers.get("x-admin-token") || "").trim();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/admin.html") {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname.startsWith("/api/market/")) {
      const user=await getSessionUser(request,env);
      if(user&&!["GET","HEAD"].includes(request.method)&&url.pathname!=="/api/market/consent"){
        try{if(!await canParticipate(env,url.origin,user))return json({error:"تم تعليق مشاركتك في السوق."},403);}catch{return json({error:"تعذر التحقق من صلاحية المشاركة."},503);}
      }
      return forwardMarketRequest(request,env,user);
    }

    if(url.pathname==="/api/site/notice"&&request.method==="GET")return internalSite(env,url.origin,"notice");
    if(url.pathname==="/api/site/issue"&&request.method==="POST"){
      if(!sameSite(request,url))return json({error:"طلب غير مسموح."},403);
      const user=await getSessionUser(request,env);
      if(!user)return json({error:"سجّل الدخول لإرسال البلاغ إلى الإدارة، أو استخدم البريد."},401);
      const reader=request.body?.getReader();
      if(!reader)return json({error:"طلب غير صالح."},400);
      const dec=new TextDecoder();let raw="",size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return json({error:"البلاغ طويل جدًا."},413);}raw+=dec.decode(value,{stream:true});}raw+=dec.decode();}finally{reader.releaseLock();}
      if(raw.length>4000)return json({error:"البلاغ طويل جدًا."},413);
      let body;try{body=JSON.parse(raw);}catch{return json({error:"طلب غير صالح."},400);}
      return internalSite(env,url.origin,"submit-issue",{kind:body?.kind,page:body?.page,description:body?.description,id:user.sub,name:user.name});
    }

    if (url.pathname === "/api/auth/google" && request.method === "GET") {
      return startGoogleAuth(request, env);
    }

    if (url.pathname === "/api/auth/google/callback" && request.method === "GET") {
      return finishGoogleAuth(request, env);
    }

    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const user = await getSessionUser(request, env);
      if(user)await observeUser(env,url.origin,user);
      return user ? json({ authenticated: true, user }) : json({ authenticated: false }, 401);
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      setCookie(headers, clearCookie(SESSION_COOKIE));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    if (url.pathname.startsWith("/api/admin/")) {
      const configuredToken = String(env.ADMIN_TOKEN || "").trim();
      if (!configuredToken) {
        return json({ error: "لوحة الإدارة لم تُفعّل بعد. يجب إعداد ADMIN_TOKEN في Cloudflare." }, 503);
      }
      const suppliedToken = getAdminToken(request);
      let access;
      try { access=await checkAdminAccess(request,env,url,configuredToken,suppliedToken); }
      catch { return json({error:"تعذر التحقق من حماية الإدارة. أعد المحاولة لاحقًا."},503); }
      if (!access.ok) return access;

      if(url.pathname.startsWith(SITE_ADMIN_PATH)&&!["summary","users","issues","settings","user-action","issue-action","audit","backup"].includes(url.pathname.slice(SITE_ADMIN_PATH.length)))return json({error:"غير موجود."},404);
      if(!["GET","HEAD"].includes(request.method)&&!sameSite(request,url))return json({error:"طلب غير مسموح."},403);
      if(url.pathname==="/api/admin/security"&&request.method==="GET")return json({adminConfigured:true,googleConfigured:authConfigured(env),sessionConfigured:!!sessionSigningSecret(env)});
      if(request.method==="GET"&&["/api/admin/stats/periods","/api/admin/stats/backup","/api/admin/stats/backup-legacy"].includes(url.pathname)){
        const target=new URL(url);target.pathname=url.pathname.replace("/api/admin/","/api/");
        return env.CHAT_ROOM.getByName("site-stats").fetch(new Request(target,{method:"GET"}));
      }
      const headers = new Headers(request.headers);
      headers.delete("authorization");
      headers.delete("x-admin-token");
      headers.set("x-admin-authorized", "1");
      const room = env.CHAT_ROOM.getByName(url.pathname.startsWith("/api/admin/market/") ? MARKET_ROOM : url.pathname.startsWith(SITE_ADMIN_PATH) ? SITE_ADMIN_ROOM : "repair-main");
      let entry=null;
      if(request.method==="POST"){
        const routes={
          "/api/admin/market/action":body=>["hide","restore","dismiss"].includes(body?.action)?{action:"market."+body.action,target:cleanText(body.id,160)}:null,
          "/api/admin/delete-message":body=>({action:"chat.delete",target:cleanId(body?.id)}),
          "/api/admin/dismiss-report":body=>({action:"chat.dismiss",target:cleanId(body?.id)}),
          "/api/admin/site/user-action":body=>({action:body?.suspended?"user.suspend":"user.resume",target:cleanText(body?.id,160)}),
          "/api/admin/site/issue-action":body=>({action:body?.resolved?"issue.resolve":"issue.reopen",target:cleanText(body?.id,160)}),
          "/api/admin/site/settings":body=>({action:body?.enabled?"notice.enable":"notice.disable",target:"notice"})
        };
        const makeEntry=routes[url.pathname];
        if(makeEntry){try{entry=makeEntry(await request.clone().json());}catch{}}
      }
      const response=await room.fetch(new Request(request, { headers }));
      if(entry&&entry.target&&response.ok){
        try{
          const logged=await internalSite(env,url.origin,"audit-record",entry);
          if(!logged.ok)throw Error("audit unavailable");
        }catch{
          console.warn("Administration action completed but audit storage failed.");
          const h=new Headers(response.headers);h.set("x-pcbr-audit-status","failed");
          return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
        }
      }
      return response;
    }

    if (url.pathname === "/api/chat/send" && request.method === "POST") {
      const user = await getSessionUser(request, env);
      if (!user) return json({ error: "سجّل الدخول للمشاركة في غرفة الصيانة." }, 401);
      try{if(!await canParticipate(env,url.origin,user))return json({error:"تم تعليق مشاركتك في غرفة الصيانة."},403);}catch{return json({error:"تعذر التحقق من صلاحية المشاركة."},503);}
      const body = await readBody(request);
      if (!body) return json({ error: "طلب غير صالح." }, 400);
      body.name = user.name || user.email.split("@")[0] || "مستخدم";
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      headers.set("content-type", "application/json");
      const forwarded = new Request(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      return baseWorker.fetch(forwarded, env, ctx);
    }

    const response = await baseWorker.fetch(request, env, ctx);
    return withBrand(response, url.pathname);
  },
};
