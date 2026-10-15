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
      <script src="/tools-integration.js?v=20261015-3" defer></script>
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
    response = await withCustom404(request, response, env);

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
