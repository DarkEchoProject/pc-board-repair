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

export { ChatRoom };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const wrappedEnv = wrappedEnvironment(env);
    const response = await appWorker.fetch(request, wrappedEnv, ctx);

    const match = url.pathname.match(/^\/download\/([a-z0-9]+)\/?$/i);
    if (!match || response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location") || "";
    let locationPath = "";
    try { locationPath = new URL(location, SITE).pathname; } catch {}
    if (!locationPath.startsWith("/downloads/")) return response;

    const largeBoards = await getLargeBoards(env);
    const board = largeBoards.find(item => fileKey(item.file) === match[1].toLowerCase());
    if (!board) return response;

    const target = safeReleaseUrl(board.download_url);
    if (!target) return new Response("Invalid download target", { status: 500 });
    return Response.redirect(target, 302);
  },
};
