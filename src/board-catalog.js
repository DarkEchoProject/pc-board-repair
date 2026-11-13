export const normalizeBoards = (all) => (Array.isArray(all) ? all : [])
  .flatMap(item => Array.isArray(item?.value) ? item.value : [item])
  .filter(item => item && typeof item.brand === "string" && item.brand.trim() && typeof item.file === "string" && item.file.trim());

export function mergeBoards(base, large) {
  const merged = [];
  const seen = new Set();
  for (const board of [...base, ...large]) {
    const key = String(board.file || "").trim().toLowerCase();
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

export const boardPath = (board) => {
  const readable = textSlug([board.brand, board.model, board.board, board.revision].filter(Boolean).join("-"));
  return `/boardview/item/${fileKey(board.file)}/${readable}`;
};

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
