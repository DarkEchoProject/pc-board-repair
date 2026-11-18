import baseWorker, { ChatRoom } from "./seo-entry.js";
import { serveLatestYouTubeVideos } from "./youtube-latest.js";

export { ChatRoom };

class HeaderUiHead {
  constructor(showAdSpaces) {
    this.showAdSpaces = showAdSpaces;
  }

  element(element) {
    element.append('<script>try{document.documentElement.dataset.theme=localStorage.getItem("pcbr-theme")==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}</script><link rel="stylesheet" href="/theme.css?v=20261105-3"><script src="/theme.js?v=20261105-3" defer></script>', { html: true });
    element.append('<script src="/youtube-integration.js?v=20261117-1" defer></script>', { html: true });
    if (this.showAdSpaces) {
      element.append('<script src="/site-notice.js?v=20261118-1" defer></script>', { html: true });
      element.append('<link rel="stylesheet" href="/site-ads.css?v=20261117-4"><script src="/site-ads.js?v=20261117-3" defer></script>', { html: true });
    }
    element.append('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token":"d776a04c82684fbaa3c8e9f78d77cb26"}\'></script>', { html: true });
  }
}

function adSpacesMarkup(shape, slotIds, className = "") {
  const slots = slotIds.map(id =>
    `<div class="pcbrAdSlot pcbrAdSlot--${shape}" data-ad-slot="${id}"><span>أعلن هنا</span></div>`
  ).join("");
  return `<aside class="pcbrAdSpaces ${className}" aria-label="مساحات إعلانية">${slots}</aside>`;
}

class TitleAdSpaces {
  constructor(state, isImage = false) {
    this.state = state;
    this.isImage = isImage;
  }

  element(element) {
    if (this.state.inserted) return;
    this.state.inserted = true;
    const kind = this.isImage ? "image" : "title";
    element.before(`<div class="pcbrTitleAds pcbrTitleAds--${kind}">${adSpacesMarkup("square", ["top-square-1"], "pcbrAdSpaces--top")}<div class="pcbrTitleAds__center">`, { html: true });
    element.after(`</div>${adSpacesMarkup("square", ["top-square-2"], "pcbrAdSpaces--top")}</div>`, { html: true });
  }
}

class PageAdSpaces {
  constructor(isHomePage) {
    this.isHomePage = isHomePage;
  }

  element(element) {
    const shape = this.isHomePage ? "square" : "banner";
    const slotIds = this.isHomePage
      ? ["home-square-1", "home-square-2"]
      : ["content-banner"];
    const className = this.isHomePage ? "pcbrAdSpaces--pair pcbrAdSpaces--home" : "";
    element.append(adSpacesMarkup(shape, slotIds, className), { html: true });
  }
}

class SiteIssueLink {
  constructor(url) {
    let source = url.pathname;
    const brand = url.searchParams.get("brand");
    if (/^\/(boardview|bios)\/company$/.test(url.pathname) && brand) {
      source += `?${new URLSearchParams({ brand })}`;
    }
    this.href = url.pathname === "/contact"
      ? "#site-issue"
      : `/contact?from=${encodeURIComponent(source)}#site-issue`;
  }

  element(element) {
    element.after(`<a class="siteIssueLink" href="${this.href}">أبلغ عن مشكلة في الموقع</a>`, { html: true });
  }
}

function isPublicContent(url) {
  return !url.pathname.startsWith("/api/") &&
    !isProtectedDownload(url.pathname) &&
    !/^\/(?:admin|login)(?:\/|\.html|$)/.test(url.pathname);
}

function withFreshPageRequest(request, url) {
  const isPage = !/\.[^/]+$/.test(url.pathname) || /\.html$/i.test(url.pathname);
  if (!isPage || !isPublicContent(url) ||
      (request.method !== "GET" && request.method !== "HEAD")) return request;

  // An asset's validators do not identify the HTML after Worker transformations.
  const headers = new Headers(request.headers);
  headers.delete("if-none-match");
  headers.delete("if-modified-since");
  return new Request(request, { headers });
}

function withHeaderUi(response, url) {
  if (response.status === 304) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("text/html")) return response;
  const showAdSpaces = response.status === 200 && isPublicContent(url);
  const rewriter = new HTMLRewriter()
    .on("head", new HeaderUiHead(showAdSpaces))
    .on('footer a[href="/contact"]', new SiteIssueLink(url));
  if (showAdSpaces) {
    const isHomePage = url.pathname === "/" || url.pathname === "/index.html";
    const titleAdSpaces = { inserted: false };
    rewriter.on("img.siteHeroBanner", new TitleAdSpaces(titleAdSpaces, true));
    rewriter.on("h1", new TitleAdSpaces(titleAdSpaces));
    rewriter.on("main", new PageAdSpaces(isHomePage));
  }
  const transformed = rewriter.transform(response);
  if (!showAdSpaces) return transformed;

  const headers = new Headers(transformed.headers);
  headers.delete("etag");
  headers.delete("last-modified");
  headers.delete("content-length");
  headers.set("cache-control", "no-cache, must-revalidate");
  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
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
  return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(next)}`, 302);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/youtube/latest") {
      return serveLatestYouTubeVideos(request, ctx);
    }

    if (
      isProtectedDownload(url.pathname) &&
      (request.method === "GET" || request.method === "HEAD") &&
      !(await isAuthenticated(request, env, ctx))
    ) {
      return loginRedirect(url);
    }

    const response = await baseWorker.fetch(withFreshPageRequest(request, url), env, ctx);
    return withHeaderUi(response, url);
  },
};
