import baseWorker, { ChatRoom } from "./entry.js";

export { ChatRoom };

const SITE = "https://pc-board-repair.alinasser00001.workers.dev";
const FAVICON_TAG = '<link rel="icon" href="/favicon.ico?v=20261118-1" type="image/x-icon" sizes="any">';

function responseFromText(response, text) {
  const headers = new Headers(response.headers);
  headers.set("content-length", new TextEncoder().encode(text).byteLength.toString());
  return new Response(response.status === 304 ? null : text, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function withSiteFavicon(response) {
  if (response.status === 304) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("text/html")) return response;

  const html = await response.text();
  // Replace existing browser icon declarations as well as missing ones.
  const updated = html.replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head\s*>)/i, (_, open, head, close) => {
    const cleaned = head.replace(/<link\b[^>]*>/gi, link => {
      const rel = link.match(/\srel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const tokens = (rel?.[1] ?? rel?.[2] ?? rel?.[3] ?? "").toLowerCase().split(/\s+/);
      return tokens.includes("icon") ? "" : link;
    });
    return open + cleaned + FAVICON_TAG + "\n" + close;
  });
  return responseFromText(response, updated);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // sitemap.xml is generated before deploy and served directly from static assets.
    // This avoids reparsing thousands of BoardView records on every sitemap request,
    // which can exceed the Cloudflare Worker CPU limit and return Error 1102.
    if (url.pathname === "/sitemap.xml") {
      const assetRequest = new Request(`${SITE}/sitemap.xml${url.search}`, {
        method: "GET",
        headers: request.headers,
      });
      const response = await env.ASSETS.fetch(assetRequest);
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/xml; charset=utf-8");
      headers.set("cache-control", "public, max-age=300");
      return new Response(response.status === 304 ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    const response = await baseWorker.fetch(request, env, ctx);
    return request.method === "HEAD" ? response : withSiteFavicon(response);
  },
};
