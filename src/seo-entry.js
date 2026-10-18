import baseWorker, { ChatRoom } from "./entry.js";

export { ChatRoom };

const SITE = "https://pc-board-repair.alinasser00001.workers.dev";
const FAVICON_TAG = '<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">';

const EXTRA_INDEXABLE_PATHS = [
  "/diagnostics/index.html",
  "/diagnostics/no-power.html",
  "/diagnostics/no-display.html",
  "/diagnostics/restarts-shuts-down.html",
  "/diagnostics/short-circuit.html",
  "/diagnostics/post-beep-codes.html",
  "/diagnostics/vrm-cpu-ram.html",
  "/component-testing/index.html",
];

const escapeXml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
}[char]));

function responseFromText(response, text) {
  const headers = new Headers(response.headers);
  headers.set("content-length", new TextEncoder().encode(text).byteLength.toString());
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function withSiteFavicon(response) {
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("text/html")) return response;

  const html = await response.text();
  if (/\<link\b[^>]*\brel\s*=\s*["'][^"']*\bicon\b[^"']*["'][^>]*>/i.test(html)) {
    return responseFromText(response, html);
  }
  if (!/<\/head>/i.test(html)) return responseFromText(response, html);

  return responseFromText(response, html.replace(/<\/head>/i, `${FAVICON_TAG}\n</head>`));
}

async function withExtraSitemapUrls(response) {
  if (!response.ok) return response;

  const xml = await response.text();
  if (!xml.includes("</urlset>")) return responseFromText(response, xml);

  const additions = EXTRA_INDEXABLE_PATHS
    .map(path => `${SITE}${path}`)
    .filter(url => !xml.includes(`<loc>${escapeXml(url)}</loc>`))
    .map(url => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n");

  if (!additions) return responseFromText(response, xml);
  return responseFromText(response, xml.replace("</urlset>", `${additions}\n</urlset>`));
}

export default {
  async fetch(request, env, ctx) {
    const response = await baseWorker.fetch(request, env, ctx);
    const url = new URL(request.url);
    if (url.pathname === "/sitemap.xml") return withExtraSitemapUrls(response);
    return withSiteFavicon(response);
  },
};
