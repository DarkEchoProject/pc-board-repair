import baseWorker, { ChatRoom } from "./entry.js";

export { ChatRoom };

const SITE = "https://pc-board-repair.alinasser00001.workers.dev";
const FAVICON_TAG = '<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">';

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
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    const response = await baseWorker.fetch(request, env, ctx);
    return withSiteFavicon(response);
  },
};
