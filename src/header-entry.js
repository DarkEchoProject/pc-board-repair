import baseWorker, { ChatRoom } from "./seo-entry.js";

export { ChatRoom };

class HeaderUiHead {
  element(element) {
    element.append('<script>try{document.documentElement.dataset.theme=localStorage.getItem("pcbr-theme")==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}</script><link rel="stylesheet" href="/theme.css?v=20261105-3"><script src="/theme.js?v=20261105-3" defer></script>', { html: true });
    element.append('<script src="/youtube-integration.js?v=20261020-9" defer></script>', { html: true });
    element.append('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token":"d776a04c82684fbaa3c8e9f78d77cb26"}\'></script>', { html: true });
  }
}


function withHeaderUi(response) {
  if (response.status === 304) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("text/html")) return response;
  return new HTMLRewriter()
    .on("head", new HeaderUiHead())
    .transform(response);
}

function isProtectedDownload(pathname) {
  return pathname.startsWith("/download/") || pathname.startsWith("/downloads/");
}

async function isAuthenticated(request, env, ctx) {
  const authUrl = new URL("/api/auth/me", request.url);
  const authRequest = new Request(authUrl, {
    method: "GET",
    headers: request.headers,
  });
  const response = await baseWorker.fetch(authRequest, env, ctx);
  return response.ok;
}

function loginRedirect(url) {
  const next = `${url.pathname}${url.search}`;
  return Response.redirect(`${url.origin}/login.html?next=${encodeURIComponent(next)}`, 302);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (
      isProtectedDownload(url.pathname) &&
      (request.method === "GET" || request.method === "HEAD") &&
      !(await isAuthenticated(request, env, ctx))
    ) {
      return loginRedirect(url);
    }

    const response = await baseWorker.fetch(request, env, ctx);
    return withHeaderUi(response);
  },
};
