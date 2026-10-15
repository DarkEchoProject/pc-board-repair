import baseWorker, { ChatRoom as BaseChatRoom } from "./index.js";

const SITE = "https://pc-board-repair.alinasser00001.workers.dev";
const SESSION_COOKIE = "pcbr_session";
const OAUTH_STATE_COOKIE = "pcbr_oauth_state";
const OAUTH_NEXT_COOKIE = "pcbr_oauth_next";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
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
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/api/auth/")) return "/";
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

function authRedirect(url) {
  const next = safeNext(`${url.pathname}${url.search}`);
  return Response.redirect(`${SITE}/login.html?next=${encodeURIComponent(next)}`, 302);
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
  let next = "/";
  try { next = safeNext(decodeURIComponent(getCookie(request, OAUTH_NEXT_COOKIE) || "%2F")); } catch {}

  const headers = new Headers({ location: `${SITE}${next}`, "cache-control": "no-store" });
  setCookie(headers, `${SESSION_COOKIE}=${session}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`);
  setCookie(headers, clearCookie(OAUTH_STATE_COOKIE));
  setCookie(headers, clearCookie(OAUTH_NEXT_COOKIE));
  return new Response(null, { status: 302, headers });
}

class BrandHead {
  element(element) {
    element.prepend(
      `<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any"><link rel="stylesheet" href="/brand.css"><link rel="stylesheet" href="/auth.css"><meta name="theme-color" content="#07111f"><script src="/auth-ui.js" defer></script><script src="/i18n-extra.js" defer></script>`,
      { html: true },
    );
  }
}

function withBrand(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  return new HTMLRewriter().on("head", new BrandHead()).transform(response);
}

export class ChatRoom extends BaseChatRoom {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/admin/")) {
      if (request.headers.get("x-admin-authorized") !== "1") {
        return json({ error: "غير مصرح." }, 403);
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
      return Response.redirect(`${SITE}/admin.html`, 302);
    }

    if (url.pathname === "/admin.html") {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/auth/google" && request.method === "GET") {
      return startGoogleAuth(request, env);
    }

    if (url.pathname === "/api/auth/google/callback" && request.method === "GET") {
      return finishGoogleAuth(request, env);
    }

    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const user = await getSessionUser(request, env);
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
      if (!suppliedToken || suppliedToken !== configuredToken) {
        return json({ error: "كلمة مرور الإدارة غير صحيحة." }, 401);
      }

      const headers = new Headers(request.headers);
      headers.delete("authorization");
      headers.delete("x-admin-token");
      headers.set("x-admin-authorized", "1");
      const room = env.CHAT_ROOM.getByName("repair-main");
      return room.fetch(new Request(request, { headers }));
    }

    if (url.pathname === "/api/chat/send" && request.method === "POST") {
      const user = await getSessionUser(request, env);
      if (!user) return json({ error: "سجّل الدخول للمشاركة في غرفة الصيانة." }, 401);
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

    if ((url.pathname.startsWith("/download/") || url.pathname.startsWith("/downloads/")) && (request.method === "GET" || request.method === "HEAD")) {
      const user = await getSessionUser(request, env);
      if (!user) return authRedirect(url);
      if (url.pathname.startsWith("/downloads/")) return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/sitemap.xml") {
      const response = await baseWorker.fetch(request, env, ctx);
      if (!response.ok) return response;
      let xml = await response.text();
      const additions = [
        `${SITE}/diagnostics/index.html`,
        `${SITE}/diagnostics/no-power.html`,
        `${SITE}/diagnostics/no-display.html`,
        `${SITE}/diagnostics/restarts-shuts-down.html`,
        `${SITE}/diagnostics/short-circuit.html`,
        `${SITE}/diagnostics/post-beep-codes.html`,
        `${SITE}/diagnostics/vrm-cpu-ram.html`,
        `${SITE}/component-testing/index.html`,
      ];
      const extra = additions
        .filter(item => !xml.includes(`<loc>${item}</loc>`))
        .map(item => `  <url><loc>${item}</loc></url>`)
        .join("\n");
      if (extra) xml = xml.replace("</urlset>", `${extra}\n</urlset>`);
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/xml; charset=utf-8");
      return new Response(xml, { status: response.status, headers });
    }

    const response = await baseWorker.fetch(request, env, ctx);
    return withBrand(response);
  },
};