import appWorker, { ChatRoom } from "./app.js";
import { boardPath, fileKey, mergeBoards, normalizeBoards } from "./board-catalog.js";
import { companies } from "../.wrangler/pcbr-company-index.js";

const SITE = "https://pc-board-repair.alinasser00001.workers.dev";
const RELEASE_PREFIX = "/DarkEchoProject/pc-board-repair/releases/download/";
let mergedBoardsCache = null;
let largeBoardsCache = null;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
}[c]));

const norm = (value) => String(value ?? "").trim().toLowerCase();
const safeJsonForHtml = (value) => JSON.stringify(value)
  .replace(/</g, "\\u003c")
  .replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");

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

  mergedBoardsCache = mergeBoards(base, large);
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

class IntegrationHead {
  element(element) {
    element.append(
      `<script>(()=>{const p=location.pathname;if(p==='/'||p==='/index.html'||p.startsWith('/boardview/item/')){const s=document.createElement('script');s.src='/tools-integration.js?v=20261015-4';s.defer=true;document.head.append(s)}})();</script>`,
      { html: true },
    );
  }
}

function withIntegrations(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  return new HTMLRewriter()
    .on("head", new IntegrationHead())
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
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com https://*.google-analytics.com https://www.googletagmanager.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://cloudflareinsights.com; font-src 'self' data:; form-action 'self' https://accounts.google.com; upgrade-insecure-requests",
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function finalize(response) {
  return withSecurityHeaders(withIntegrations(response));
}

function similarBoards(board, boards) {
  const identity = norm(board.file);
  const brand = norm(board.brand);
  const model = norm(board.model);
  const boardNo = norm(board.board);
  const platform = norm(board.platform);
  const type = norm(board.type);
  const eligible = boards.filter(item => item && item.file && norm(item.file) !== identity);
  const selected = [];
  const used = new Set([identity]);
  const add = item => {
    if (!item || !item.file || used.has(norm(item.file))) return;
    used.add(norm(item.file));
    selected.push(item);
  };

  // Prefer genuine model/board matches, then other files from the same manufacturer.
  const ranked = eligible.map(item => {
    let score = 0;
    if (brand && norm(item.brand) === brand) score += 3;
    if (boardNo && norm(item.board) === boardNo) score += 20;
    if (model && norm(item.model) === model) score += 16;
    if (platform && norm(item.platform) === platform) score += 5;
    if (type && norm(item.type) === type) score += 1;
    return { item, score };
  }).sort((a, b) => b.score - a.score ||
    String(a.item.model || a.item.board || a.item.file).localeCompare(String(b.item.model || b.item.board || b.item.file), "en"));
  for (const entry of ranked) {
    if (entry.score < 3 || selected.length >= 4) break;
    add(entry.item);
  }

  // Fallback for unique boards: link to neighbouring catalogue entries as well.
  // This ensures each archive item has several real HTML links, even with no close match.
  const sorted = [...boards].filter(item => item && item.file).sort((a, b) =>
    String(a.brand || "").localeCompare(String(b.brand || ""), "en") ||
    String(a.model || a.board || a.file).localeCompare(String(b.model || b.board || b.file), "en") ||
    String(a.file).localeCompare(String(b.file), "en"));
  const position = sorted.findIndex(item => norm(item.file) === identity);
  for (let step = 1; position !== -1 && selected.length < 6 && step < sorted.length; step++) {
    add(sorted[(position + step) % sorted.length]);
    if (selected.length < 6) add(sorted[(position - step + sorted.length) % sorted.length]);
  }
  return selected.slice(0, 6);
}

function boardSeoBlock(board, similar) {
  const brand = escapeHtml(board.brand);
  const model = escapeHtml(board.model || "BoardView");
  const boardNo = escapeHtml(board.board || "");
  const revision = escapeHtml(board.revision || "");
  const platform = escapeHtml(board.platform || "");
  const type = escapeHtml(board.type || "BoardView");
  const file = escapeHtml(board.file || "");
  const companyUrl = `/boardview/company?brand=${encodeURIComponent(board.brand)}`;

  const facts = [
    `هذه الصفحة مخصصة لملف ${type} الخاص بلوحة ${brand}${board.model ? ` ${model}` : ""}.`,
    boardNo ? `رقم البورد المسجل للملف هو ${boardNo}.` : "",
    revision ? `الإصدار المسجل هو ${revision}.` : "",
    platform ? `المنصة المسجلة في قاعدة الملفات هي ${platform}.` : "",
    file ? `اسم الملف الأصلي هو ${file}.` : "",
  ].filter(Boolean).join(" ");

  const similarHtml = similar.length
    ? `<div><h3>ملفات BoardView مرتبطة ومقترحة</h3><div class="grid">${similar.map(item => `<a class="card" href="${boardPath(item)}"><span class="brandTag">${escapeHtml(item.brand)}</span><h3>${escapeHtml(item.model || item.board || "BoardView")}</h3><p class="muted">${escapeHtml([item.board, item.revision, item.type].filter(Boolean).join(" • ") || item.file)}</p></a>`).join("")}</div></div>`
    : "";

  return `<section class="sectionBlock pcbrBoardSeo"><h2>معلومات فنية عن ${brand} ${model}</h2><p>${facts}</p><p class="muted">استخدم بيانات الموديل ورقم البورد وRevision لمقارنة الملف مع اللوحة قبل التحميل. يمكنك أيضًا استعراض <a href="${companyUrl}">ملفات ${brand}</a> أو <a href="/boardview/directory.html">فهرس جميع موديلات BoardView</a> أو <a href="/boardview/featured.html">الملفات المختارة</a> أو العودة إلى <a href="/boardview/index.html">دليل BoardView الكامل</a>.</p>${similarHtml}</section>`;
}

class BoardSeoAfter {
  constructor(html) {
    this.html = html;
  }
  element(element) {
    element.after(this.html, { html: true });
  }
}

class BoardDataHead {
  constructor(board) {
    this.board = board;
  }
  element(element) {
    element.append(
      `<script type="application/json" id="pcbr-board-data">${safeJsonForHtml(this.board)}</script>`,
      { html: true },
    );
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
      .on("head", new BoardDataHead(board))
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

function renderCompanyPage(response, company, isBios, canonical) {
  const title = `${company.brand} ${isBios ? "BIOS" : "BoardView"} | PC Board Repair`;
  const heading = isBios ? `ملفات BIOS — ${company.brand}` : `${company.brand} BoardView`;
  const description = isBios
    ? `تصفح ملفات BIOS الخاصة بشركة ${company.brand} وابحث بالموديل أو رقم اللوحة.`
    : `تصفح خرائط BoardView الخاصة بشركة ${company.brand} حسب الموديل ورقم اللوحة والإصدار.`;
  const count = company.count.toLocaleString("ar-LB");
  const links = company.examples.map(({ label, href }) =>
    `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`,
  ).join("");
  const text = value => ({ element(element) { element.setInnerContent(value); } });

  return new HTMLRewriter()
    .on("title", text(title))
    .on('meta[name="description"]', {
      element(element) { element.setAttribute("content", description); },
    })
    .on("head", {
      element(element) {
        element.append(`<link rel="canonical" href="${escapeHtml(canonical)}">`, { html: true });
      },
    })
    .on(isBios ? "#biosCompanyHeading" : "#title", text(heading))
    .on(isBios ? "#biosCompanyDescription" : "#intro", text(description))
    .on(isBios ? "#biosCrumbBrand" : "#crumbBrand", text(company.brand))
    .on(isBios ? "#biosCompanyTotal" : "#totalStat", text(count))
    .on(isBios ? "#biosResultCount" : "#resultCount", text(`عدد ملفات الشركة ${count}`))
    .on(isBios ? "#biosResults" : "#list", {
      element(element) {
        element.setInnerContent(`<section class="sectionBlock"><h2>نماذج من ملفات الشركة</h2><ul>${links}</ul></section>`, { html: true });
      },
    })
    .transform(response);
}

async function companyPageResponse(request, env, ctx) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/(boardview|bios)\/company(?:\.html)?\/?$/);
  if (!match) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const requestedBrand = url.searchParams.get("brand");
  const section = match[1];
  const company = companies[section].get(norm(requestedBrand));
  const headOnly = request.method === "HEAD";
  if (!company) {
    return new Response(headOnly ? null : "Not Found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  const companyPath = `/${section}/company`;
  if (url.pathname !== companyPath || requestedBrand !== company.brand || url.searchParams.getAll("brand").length !== 1) {
    url.pathname = companyPath;
    url.searchParams.set("brand", company.brand);
    return Response.redirect(url, 301);
  }

  try {
    const templateRequest = new Request(new URL(companyPath, url), { method: request.method });
    const template = await appWorker.fetch(templateRequest, env, ctx);
    if (!template.ok) throw new Error("Company page template unavailable");

    // Asset validators belong to the shared template, while each company has its own HTML.
    const headers = new Headers(template.headers);
    headers.delete("etag");
    headers.delete("last-modified");
    headers.delete("content-length");
    const response = new Response(headOnly ? null : template.body, { headers });
    const canonical = `${SITE}${companyPath}?brand=${encodeURIComponent(company.brand)}`;
    return headOnly ? response : renderCompanyPage(response, company, section === "bios", canonical);
  } catch {
    return new Response(headOnly ? null : "Temporary error", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}

export { ChatRoom };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const companyResponse = await companyPageResponse(request, env, ctx);
    if (companyResponse) {
      const response = await withCustom404(request, companyResponse, env);
      return finalize(response);
    }

    const wrappedEnv = wrappedEnvironment(env);
    let response = await appWorker.fetch(request, wrappedEnv, ctx);
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
