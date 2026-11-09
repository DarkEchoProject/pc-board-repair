const RELEASE_PREFIX = "/DarkEchoProject/pc-board-repair/releases/download/";

function safeDownload(value) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.origin !== "https://github.com" || !url.pathname.startsWith(RELEASE_PREFIX)) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function normalizeBiosCatalog(payload) {
  if (!Array.isArray(payload)) throw new Error("The BIOS catalog must be a JSON array.");
  const seen = new Set();
  return payload.filter(item => {
    if (!item || typeof item !== "object") return false;
    const sha = String(item.sha256 || "").toLowerCase();
    const url = safeDownload(item.download_url);
    if (!/^[0-9a-f]{64}$/.test(sha) || seen.has(sha) || !url || !item.file) return false;
    seen.add(sha);
    item.download_url = url;
    item.brand = String(item.brand || "Other").trim() || "Other";
    return true;
  });
}
