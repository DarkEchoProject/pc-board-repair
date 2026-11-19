export const normalizeBoards = (all) => (Array.isArray(all) ? all : [])
  .flatMap(item => Array.isArray(item?.value) ? item.value : [item])
  .filter(item => item && typeof item.brand === "string" && item.brand.trim() && typeof item.file === "string" && item.file.trim());

export function mergeBoards(base, large) {
  const merged = [];
  const seen = new Set();
  for (const board of [...base, ...large]) {
    const key = boardFileIdentity(board.file);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(board);
  }
  return merged;
}

export const fileKey = (value) => {
  const s = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};

export const textSlug = (value) => {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || "boardview";
};

const boardRoute = (board, key) => {
  const readable = textSlug([board.brand, board.model, board.board, board.revision].filter(Boolean).join("-"));
  return `/boardview/item/${key}/${readable}`;
};

export const boardPath = board => boardRoute(board, fileKey(board.file));

export function boardCard(board) {
  return {
    key: fileKey(board.file),
    path: boardPath(board),
    brand: String(board.brand ?? "").trim(),
    model: String(board.model ?? "").trim(),
    board: String(board.board ?? "").trim(),
    revision: String(board.revision ?? "").trim(),
    type: String(board.type ?? "").trim(),
  };
}

export const BOARD_DATA_PATHS = Object.freeze(["/data/boards.json", "/data/boards-large.json"]);
export const boardFileIdentity = value => String(value ?? "").trim().toLowerCase();
export function normalizeSearchText(value) {
  return String(value ?? "").toLowerCase().normalize("NFKD")
    .replace(/[\p{M}ـ]/gu, "").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}
export const compactSearchText = value => normalizeSearchText(value).replace(/\s+/g, "");
export const boardKey = board => String(board?.key || fileKey(board?.file || ""));
export const boardCardPath = board => board.path || boardRoute(board, boardKey(board));

export async function fetchBoardCatalog({ fetcher = fetch, cache = "default", allowPartial = false } = {}) {
  const results = await Promise.allSettled(BOARD_DATA_PATHS.map(async path => {
    const response = await fetcher(path, { cache });
    if (!response.ok) throw new Error("HTTP " + response.status + " " + path);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error("Invalid BoardView catalog: " + path);
    return normalizeBoards(payload);
  }));
  const failures = results.filter(result => result.status === "rejected");
  if (failures.length === results.length || (failures.length && !allowPartial)) throw failures[0].reason;
  return mergeBoards(...results.map(result => result.status === "fulfilled" ? result.value : []));
}
export function getInjectedBoard(expectedKey, doc = document) {
  const node = doc.getElementById("pcbr-board-data");
  if (!node) return null;
  try {
    const board = JSON.parse(node.textContent || "null");
    return board && typeof board.file === "string" && fileKey(board.file) === String(expectedKey || "").toLowerCase() ? board : null;
  } catch { return null; }
}
let pageCatalogPromise;
export async function findBoardForPage(expectedKey) {
  const injected = getInjectedBoard(expectedKey);
  if (injected) return injected;
  if (!pageCatalogPromise) {
    pageCatalogPromise = fetchBoardCatalog({ allowPartial: true }).finally(() => { pageCatalogPromise = null; });
  }
  const boards = await pageCatalogPromise;
  return boards.find(board => fileKey(board.file) === String(expectedKey || "").toLowerCase()) || null;
}
