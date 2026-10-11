import { DurableObject } from "cloudflare:workers";

const GA_ID = "G-V8YQEDWLDP";
const SITE = "https://pc-board-repair.alinasser00001.workers.dev";
let boardsCache = null;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

const cleanText = (value, max) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
}[c]));

const escapeXml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
}[c]));

const fileKey = (value) => {
  const s = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};

const textSlug = (value) => {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || "boardview";
};

const boardPath = (board) => {
  const readable = textSlug([board.brand, board.model, board.board, board.revision].filter(Boolean).join("-"));
  return `/boardview/item/${fileKey(board.file)}/${readable}`;
};

const normalizeBoards = (all) => (Array.isArray(all) ? all : [])
  .flatMap(x => Array.isArray(x?.value) ? x.value : [x])
  .filter(x => x && typeof x.brand === "string" && x.brand.trim() && typeof x.file === "string" && x.file.trim());

async function getBoards(env) {
  if (boardsCache) return boardsCache;
  const response = await env.ASSETS.fetch(new Request(`${SITE}/data/boards.json`));
  if (!response.ok) throw new Error("boards.json unavailable");
  const text = (await response.text()).replace(/^\uFEFF/, "");
  boardsCache = normalizeBoards(JSON.parse(text));
  return boardsCache;
}

const allowedCategories = new Set([
  "طلب مخطط",
  "مناقشة عطل",
  "BoardView",
  "BIOS",
  "عام",
]);

async function hashValue(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

class AnalyticsHead {
  element(element) {
    element.prepend(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>`,
      { html: true },
    );
  }
}

function withAnalytics(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  return new HTMLRewriter().on("head", new AnalyticsHead()).transform(response);
}

function boardPage(board, related) {
  const brand = escapeHtml(board.brand);
  const model = escapeHtml(board.model || "BoardView");
  const boardNo = escapeHtml(board.board || "");
  const revision = escapeHtml(board.revision || "");
  const platform = escapeHtml(board.platform || "");
  const type = escapeHtml(board.type || "BoardView");
  const note = board.note && !/^Imported automatically/i.test(board.note) ? escapeHtml(board.note) : "";
  const canonical = `${SITE}${boardPath(board)}`;
  const downloadUrl = `/downloads/${encodeURIComponent(board.file)}`;
  const imageBlock = board.image
    ? `<a class="boardImageLink" href="/images/${encodeURIComponent(board.image)}" target="_blank" rel="noopener"><img class="boardImage" src="/images/${encodeURIComponent(board.image)}" alt="لوحة ${brand} ${model}"></a>`
    : `<div class="boardPlaceholder">🧩<span>لا توجد صورة متاحة حاليًا</span></div>`;
  const description = `تحميل ${board.type || "BoardView"} للوحة ${board.brand} ${board.model || ""}${board.board ? ` رقم ${board.board}` : ""}${board.revision ? ` ${board.revision}` : ""} من PC Board Repair.`;
  const details = [
    ["الشركة", brand],
    ["الموديل", model],
    ["رقم البورد", boardNo],
    ["Revision", revision],
    ["المنصة", platform],
    ["نوع الملف", type],
    ["اسم الملف", escapeHtml(board.file)],
  ].filter(([, value]) => value).map(([label, value]) => `<div class="detailRow"><span>${label}</span><strong>${value}</strong></div>`).join("");
  const relatedHtml = related.length ? `<section class="sectionBlock"><h2>ملفات أخرى من ${brand}</h2><div class="grid">${related.map(item => `<a class="card" href="${boardPath(item)}"><span class="brandTag">${escapeHtml(item.brand)}</span><h3>${escapeHtml(item.model || item.board || "BoardView")}</h3><p class="muted">${escapeHtml([item.board, item.revision].filter(Boolean).join(" • ") || item.type || "BoardView")}</p></a>`).join("")}</div></section>` : "";
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${board.brand} ${board.model || ""} BoardView`,
    url: canonical,
    description,
    isPartOf: { "@type": "WebSite", name: "PC Board Repair", url: `${SITE}/` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "الرئيسية", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "BoardView", item: `${SITE}/boardview/index.html` },
        { "@type": "ListItem", position: 3, name: `${board.brand} ${board.model || ""}`, item: canonical },
      ],
    },
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand} ${model}${boardNo ? ` ${boardNo}` : ""} BoardView | PC Board Repair</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${brand} ${model} BoardView">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/boardview-extra.css">
<script type="application/ld+json">${structured}</script>
</head>
<body>
<header><a class="logo" href="/index.html">⚙️ PC Board Repair</a><nav><a href="/index.html">الرئيسية</a><a href="/boardview/index.html">BoardView</a><a href="/bios/index.html">BIOS</a><a href="/community.html">غرفة الصيانة</a><a href="/contact.html">اتصل بنا</a></nav></header>
<main class="wrap">
<div class="crumb"><a href="/index.html">الرئيسية</a> ← <a href="/boardview/index.html">BoardView</a> ← <a href="/boardview/company.html?brand=${encodeURIComponent(board.brand)}">${brand}</a> ← ${model}</div>
<article class="boardDetail">
  <div>${imageBlock}</div>
  <div class="boardInfo">
    <span class="brandTag">${brand}</span>
    <h1>${brand} ${model}</h1>
    <p class="muted">صفحة مستقلة لملف الصيانة. تحقق من رقم البورد وRevision قبل التحميل والاستخدام.</p>
    <div class="detailList">${details}</div>
    ${note ? `<p class="fileMeta">${note}</p>` : ""}
    <div class="boardActions"><a class="btn" href="${downloadUrl}" download>⬇️ تحميل الملف</a>${board.image ? `<a class="imageBtn" href="/images/${encodeURIComponent(board.image)}" target="_blank" rel="noopener">🖼️ فتح صورة اللوحة</a>` : ""}</div>
  </div>
</article>
<div class="warn"><b>تنبيه:</b> تأكد من تطابق الشركة والموديل ورقم اللوحة وRevision قبل استخدام الملف. احتفظ بنسخة احتياطية قبل أي تعديل أو برمجة.</div>
${relatedHtml}
</main>
<footer><div class="footerLinks"><a href="/community.html">غرفة الصيانة</a><a href="/about.html">من نحن</a><a href="/contact.html">اتصل بنا</a><a href="/privacy.html">سياسة الخصوصية</a><a href="/terms.html">شروط الاستخدام</a><a href="/disclaimer.html">إخلاء المسؤولية</a></div><div>© 2026 PC Board Repair</div></footer>
</body></html>`;
}

function notFoundPage() {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>الملف غير موجود | PC Board Repair</title><link rel="stylesheet" href="/style.css"></head><body><main class="wrap"><div class="emptyState"><h1>الملف غير موجود</h1><p>قد يكون الرابط قديمًا أو تم تغيير بيانات الملف.</p><a class="btn" href="/boardview/index.html">العودة إلى BoardView</a></div></main></body></html>`;
}

async function sitemapResponse(env) {
  const boards = await getBoards(env);
  const staticPaths = [
    "/",
    "/boardview/index.html",
    "/bios/index.html",
    "/bios/intel.html",
    "/community.html",
    "/about.html",
    "/contact.html",
    "/privacy.html",
    "/terms.html",
    "/disclaimer.html",
    "/copyright.html",
  ];
  const urls = [...staticPaths, ...boards.map(boardPath)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(path => `  <url><loc>${escapeXml(`${SITE}${path}`)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

export class ChatRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rate = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/chat/messages") {
      const messages = (await this.ctx.storage.get("messages")) || [];
      return json({ messages });
    }

    if (request.method === "POST" && url.pathname === "/api/chat/send") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "طلب غير صالح." }, 400);
      }

      const name = cleanText(body.name, 32);
      const text = cleanText(body.text, 500);
      const category = allowedCategories.has(body.category) ? body.category : "عام";
      const website = cleanText(body.website, 100);

      if (website) return json({ ok: true });
      if (name.length < 2) return json({ error: "اكتب اسمًا أو لقبًا من حرفين على الأقل." }, 400);
      if (text.length < 2) return json({ error: "الرسالة قصيرة جدًا." }, 400);

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const key = await hashValue(ip);
      const now = Date.now();
      const last = this.rate.get(key) || 0;
      if (now - last < 4000) {
        return json({ error: "انتظر بضع ثوانٍ قبل إرسال رسالة أخرى." }, 429);
      }
      this.rate.set(key, now);
      if (this.rate.size > 500) {
        const cutoff = now - 60 * 60 * 1000;
        for (const [k, t] of this.rate) if (t < cutoff) this.rate.delete(k);
      }

      const messages = (await this.ctx.storage.get("messages")) || [];
      const message = {
        id: crypto.randomUUID(),
        name,
        category,
        text,
        time: new Date(now).toISOString(),
      };
      messages.push(message);
      const trimmed = messages.slice(-200);
      await this.ctx.storage.put("messages", trimmed);
      return json({ ok: true, message }, 201);
    }

    return json({ error: "Not found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/chat/")) {
      const room = env.CHAT_ROOM.getByName("repair-main");
      return room.fetch(request);
    }

    if (url.pathname === "/sitemap.xml") {
      try {
        return await sitemapResponse(env);
      } catch {
        return new Response("Sitemap temporarily unavailable", { status: 503 });
      }
    }

    const match = url.pathname.match(/^\/boardview\/item\/([a-z0-9]+)(?:\/[^/]*)?\/?$/i);
    if (match) {
      try {
        const boards = await getBoards(env);
        const board = boards.find(item => fileKey(item.file) === match[1].toLowerCase());
        if (!board) {
          return withAnalytics(new Response(notFoundPage(), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }));
        }
        const canonicalPath = boardPath(board);
        if (url.pathname.replace(/\/$/, "") !== canonicalPath) {
          return Response.redirect(`${SITE}${canonicalPath}`, 301);
        }
        const related = boards.filter(item => item.file !== board.file && item.brand.toLowerCase() === board.brand.toLowerCase()).slice(0, 6);
        return withAnalytics(new Response(boardPage(board, related), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        }));
      } catch {
        return new Response("Temporary error", { status: 503 });
      }
    }

    const response = await env.ASSETS.fetch(request);
    return withAnalytics(response);
  },
};
