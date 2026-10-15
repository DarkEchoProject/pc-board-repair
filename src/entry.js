import appWorker, { ChatRoom } from "./app.js";

const SITE = "https://pc-board-repair.alinasser00001.workers.dev";
const RELEASE_PREFIX = "/DarkEchoProject/pc-board-repair/releases/download/";
let mergedBoardsCache = null;
let largeBoardsCache = null;

const normalizeBoards = (all) => (Array.isArray(all) ? all : [])
  .flatMap(item => Array.isArray(item?.value) ? item.value : [item])
  .filter(item => item && typeof item.brand === "string" && item.brand.trim() && typeof item.file === "string" && item.file.trim());

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

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
}[c]));

const norm = (value) => String(value ?? "").trim().toLowerCase();

function sitemapDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function boardLastmod(board) {
  return sitemapDate(
    board.modified_at ??
    board.modifiedAt ??
    board.updated_at ??
    board.updatedAt ??
    board.last_modified ??
    board.lastModified ??
    board.added_at ??
    board.addedAt ??
    board.date_added ??
    board.dateAdded ??
    "",
  );
}

async function readJsonAsset(assets, path, required = false) {
  const response = await assets.fetch(new Request(`${SITE}${path}`));
  if (!response.ok) {
    if (required) throw new Error(`${path} unavailable`);
    return [];
  }
  const text = (await response.text()).replace(/^\uFEFF/, "");
  return normalizeBoards(JSON.parse(text));
}

async function getLargeBoards(env) {
  if (largeBoardsCache) return largeBoardsCache;
  largeBoardsCache = await readJsonAsset(env.ASSETS, "/data/boards-large.json");
  return largeBoardsCache;
}

async function getMergedBoards(env) {
  if (mergedBoardsCache) return mergedBoardsCache;
  const [base, large] = await Promise.all([
    readJsonAsset(env.ASSETS, "/data/boards.json", true),
    getLargeBoards(env),
  ]);

  const merged = [];
  const seen = new Set();
  for (const board of [...base, ...large]) {
    const key = String(board.file || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(board);
  }
  mergedBoardsCache = merged;
  return mergedBoardsCache;
}

function boardsResponse(boards) {
  return new Response(JSON.stringify(boards), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

function safeReleaseUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== "github.com") return "";
    if (!url.pathname.startsWith(RELEASE_PREFIX)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function wrappedEnvironment(env) {
  const originalAssets = env.ASSETS;
  const mergedAssets = {
    async fetch(input) {
      const request = input instanceof Request ? input : new Request(input);
      const url = new URL(request.url);
      if (url.pathname === "/data/boards.json") {
        return boardsResponse(await getMergedBoards(env));
      }
      return originalAssets.fetch(request);
    },
  };
  return { ...env, ASSETS: mergedAssets };
}

class YouTubeHead {
  element(element) {
    element.append(`
      <script src="/youtube-integration.js?v=20261015-5" defer></script>
      <script src="/tools-integration.js?v=20261015-4" defer></script>
      <script>
      (()=>{
        const href='https://www.youtube.com/@PCBoardRepairArabic';
        const ensure=()=>{
          const nav=document.querySelector('header nav');
          if(!nav||nav.querySelector('[data-pcbr-youtube-channel="nav"]'))return;
          const a=document.createElement('a');
          a.href=href;
          a.target='_blank';
          a.rel='noopener noreferrer';
          a.dataset.pcbrYoutubeChannel='nav';
          a.textContent='▶ YouTube';
          a.style.cssText='color:#fff;background:#ff0033;border:1px solid #ff0033;border-radius:10px;padding:6px 10px;text-decoration:none;font-weight:700;white-space:nowrap';
          nav.append(a);
        };
        const start=()=>{
          ensure();
          const header=document.querySelector('header');
          if(!header)return;
          new MutationObserver(ensure).observe(header,{childList:true,subtree:true});
        };
        if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
      })();
      </script>
    `, { html: true });
  }
}

function withYouTube(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  return new HTMLRewriter()
    .on("head", new YouTubeHead())
    .transform(response);
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "SAMEORIGIN");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("strict-transport-security", "max-age=31536000");

  const contentType = headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    headers.set(
      "content-security-policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self'; font-src 'self' data:; form-action 'self' https://accounts.google.com; upgrade-insecure-requests",
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function finalize(response) {
  return withSecurityHeaders(withYouTube(response));
}

async function withSitemapLastmod(response, env) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("xml")) return response;

  const fallback = response.clone();
  try {
    let xml = await response.text();
    const boards = await getMergedBoards(env);
    let latestBoardDate = "";

    for (const board of boards) {
      const lastmod = boardLastmod(board);
      if (!lastmod) continue;
      if (!latestBoardDate || lastmod > latestBoardDate) latestBoardDate = lastmod;

      const loc = `${SITE}${boardPath(board)}`;
      const plain = `<url><loc>${loc}</loc></url>`;
      const enriched = `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
      if (xml.includes(plain)) xml = xml.replace(plain, enriched);
    }

    if (latestBoardDate) {
      for (const path of ["/", "/boardview/index.html"]) {
        const loc = `${SITE}${path}`;
        const plain = `<url><loc>${loc}</loc></url>`;
        const enriched = `<url><loc>${loc}</loc><lastmod>${latestBoardDate}</lastmod></url>`;
        if (xml.includes(plain)) xml = xml.replace(plain, enriched);
      }
    }

    const headers = new Headers(response.headers);
    headers.set("content-type", "application/xml; charset=utf-8");
    headers.set("cache-control", "public, max-age=300");
    return new Response(xml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return fallback;
  }
}

function similarBoards(board, boards) {
  const brand = norm(board.brand);
  const model = norm(board.model);
  const boardNo = norm(board.board);
  const platform = norm(board.platform);
  const type = norm(board.type);

  return boards
    .filter(item => norm(item.file) !== norm(board.file))
    .map(item => {
      let score = 0;
      if (brand && norm(item.brand) === brand) score += 1;
      if (boardNo && norm(item.board) === boardNo) score += 7;
      if (model && norm(item.model) === model) score += 6;
      if (platform && norm(item.platform) === platform) score += 2;
      if (type && norm(item.type) === type) score += 1;
      return { item, score };
    })
    .filter(entry => entry.score >= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(entry => entry.item);
}

function boardSeoBlock(board, similar) {
  const brand = escapeHtml(board.brand);
  const model = escapeHtml(board.model || "BoardView");
  const boardNo = escapeHtml(board.board || "");
  const revision = escapeHtml(board.revision || "");
  const platform = escapeHtml(board.platform || "");
  const type = escapeHtml(board.type || "BoardView");
  const file = escapeHtml(board.file || "");
  const companyUrl = `/boardview/company.html?brand=${encodeURIComponent(board.brand)}`;

  const facts = [
    `هذه الصفحة مخصصة لملف ${type} الخاص بلوحة ${brand}${board.model ? ` ${model}` : ""}.`,
    boardNo ? `رقم البورد المسجل للملف هو ${boardNo}.` : "",
    revision ? `الإصدار المسجل هو ${revision}.` : "",
    platform ? `المنصة المسجلة في قاعدة الملفات هي ${platform}.` : "",
    file ? `اسم الملف الأصلي هو ${file}.` : "",
  ].filter(Boolean).join(" ");

  const similarHtml = similar.length
    ? `<div><h3>ملفات قريبة من نفس الموديل أو رقم البورد</h3><div class="grid">${similar.map(item => `<a class="card" href="${boardPath(item)}"><span class="brandTag">${escapeHtml(item.brand)}</span><h3>${escapeHtml(item.model || item.board || "BoardView")}</h3><p class="muted">${escapeHtml([item.board, item.revision, item.type].filter(Boolean).join(" • ") || item.file)}</p></a>`).join("")}</div></div>`
    : "";

  return `<section class="sectionBlock pcbrBoardSeo"><h2>معلومات فنية عن ${brand} ${model}</h2><p>${facts}</p><p class="muted">استخدم بيانات الموديل ورقم البورد وRevision لمقارنة الملف مع اللوحة قبل التحميل. يمكنك أيضًا استعراض <a href="${companyUrl}">ملفات ${brand}</a> أو العودة إلى <a href="/boardview/index.html">دليل BoardView الكامل</a>.</p>${similarHtml}</section>`;
}

class BoardSeoAfter {
  constructor(html) {
    this.html = html;
  }
  element(element) {
    element.after(this.html, { html: true });
  }
}

async function withBoardSeo(request, response, env) {
  if (!response.ok || request.method !== "GET") return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/boardview\/item\/([a-z0-9]+)(?:\/[^/]*)?\/?$/i);
  if (!match) return response;

  try {
    const boards = await getMergedBoards(env);
    const board = boards.find(item => fileKey(item.file) === match[1].toLowerCase());
    if (!board) return response;
    const html = boardSeoBlock(board, similarBoards(board, boards));
    return new HTMLRewriter()
      .on("article.boardDetail", new BoardSeoAfter(html))
      .transform(response);
  } catch {
    return response;
  }
}

async function withCustom404(request, response, env) {
  if (response.status !== 404 || request.method !== "GET") return response;

  const url = new URL(request.url);
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/download/") ||
    url.pathname.startsWith("/downloads/")
  ) return response;

  const accept = request.headers.get("accept") || "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return response;

  const page = await env.ASSETS.fetch(new Request(`${SITE}/404.html`));
  if (!page.ok) return response;

  const headers = new Headers(page.headers);
  headers.set("cache-control", "no-store");
  return new Response(page.body, {
    status: 404,
    statusText: "Not Found",
    headers,
  });
}

export { ChatRoom };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const wrappedEnv = wrappedEnvironment(env);
    let response = await appWorker.fetch(request, wrappedEnv, ctx);
    if (url.pathname === "/sitemap.xml") response = await withSitemapLastmod(response, env);
    response = await withCustom404(request, response, env);
    response = await withBoardSeo(request, response, env);

    const match = url.pathname.match(/^\/download\/([a-z0-9]+)\/?$/i);
    if (!match || response.status < 300 || response.status >= 400) return finalize(response);

    const location = response.headers.get("location") || "";
    let locationPath = "";
    try { locationPath = new URL(location, SITE).pathname; } catch {}
    if (!locationPath.startsWith("/downloads/")) return finalize(response);

    const largeBoards = await getLargeBoards(env);
    const board = largeBoards.find(item => fileKey(item.file) === match[1].toLowerCase());
    if (!board) return finalize(response);

    const target = safeReleaseUrl(board.download_url);
    if (!target) return finalize(new Response("Invalid download target", { status: 500 }));
    return finalize(Response.redirect(target, 302));
  },
};
