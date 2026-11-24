import baseWorker, { ChatRoom } from "./seo-entry.js";
import { serveLatestYouTubeVideos } from "./youtube-latest.js";

export { ChatRoom };

class HeaderUiHead {
  constructor(showAdSpaces, isBiosPage) {
    this.showAdSpaces = showAdSpaces;
    this.isBiosPage = isBiosPage;
  }

  element(element) {
    element.append('<script>try{document.documentElement.dataset.theme=localStorage.getItem("pcbr-theme")==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}</script><link rel="stylesheet" href="/theme.css?v=20261105-3"><script src="/theme.js?v=20261105-3" defer></script>', { html: true });
    element.append('<script src="/youtube-integration.js?v=20261117-1" defer></script>', { html: true });
    if (this.showAdSpaces) {
      if (this.isBiosPage) element.append('<script src="/bios-download-stats.js?v=20261119-1" defer></script>', { html: true });
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
    .on("head", new HeaderUiHead(showAdSpaces, url.pathname.startsWith('/bios/')))
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

const MARKET_SHARE_SITE = "https://pc-board-repair.alinasser00001.workers.dev";

const marketOgEscape = value => String(value ?? "").replace(
  /[&<>"']/g,
  c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]
);

async function withMarketPreview(response, url, env) {
  if (response.status !== 200 ||
      !["/market/", "/market"].includes(url.pathname) ||
      !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }

  const id = url.searchParams.get("listing");

  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return response;
  }

  try {
    const target = new URL(
      `/api/market/share-preview/${id}`,
      MARKET_SHARE_SITE
    );

    const result = await env.CHAT_ROOM
      .getByName("repair-market")
      .fetch(new Request(target));

    if (!result.ok) return response;

    const item = await result.json();

    const type = item.kind === "wanted" ? "مطلوب" : "للبيع";

    const title = `${type}: ${item.title}`;

    const conditions = {
      working: "مفحوصة وتعمل",
      faulty: "معطلة",
      donor: "خردة للقطع",
      untested: "غير مفحوصة",
      new: "جديدة",
      any: "حسب المطلوب"
    };

    const money = item.price == null || item.price === ""
      ? "على الاتفاق"
      : Number(item.price) === 0 && item.kind === "sale"
        ? "مجاني"
        : `${item.price} ${item.currency}`;

    const priceLabel = item.kind === "wanted" ? "الميزانية" : "السعر";

    const description = [
      `${priceLabel}: ${money}`,
      item.negotiable && item.price != null ? "قابل للتفاوض" : "",
      item.kind === "sale" ? conditions[item.condition] : "",
      `${item.city}، ${item.country}`,
      item.description
    ].filter(Boolean).join(" | ");

    const canonical = `${MARKET_SHARE_SITE}/market/?listing=${encodeURIComponent(id)}`;

    const image = item.photo
      ? `${MARKET_SHARE_SITE}/api/market/share-image/${id}/${item.photo.id}`
      : "";

    const tags = [
      `<meta property="og:site_name" content="PC Board Repair">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${marketOgEscape(title)}">`,
      `<meta property="og:description" content="${marketOgEscape(description)}">`,
      `<meta property="og:url" content="${marketOgEscape(canonical)}">`,
      `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
      `<meta name="twitter:title" content="${marketOgEscape(title)}">`,
      `<meta name="twitter:description" content="${marketOgEscape(description)}">`
    ];

    if (image) {
      tags.push(
        `<meta property="og:image" content="${marketOgEscape(image)}">`,
        `<meta property="og:image:type" content="${marketOgEscape(item.photo.mime)}">`,
        `<meta property="og:image:alt" content="${marketOgEscape(title)}">`,
        `<meta name="twitter:image" content="${marketOgEscape(image)}">`
      );
    }

    const transformed = new HTMLRewriter()
      .on('meta[property^="og:"]', {
        element(e) { e.remove(); }
      })
      .on('meta[name^="twitter:"]', {
        element(e) { e.remove(); }
      })
      .on("head", {
        element(e) {
          e.append(tags.join("\n"), { html: true });
        }
      })
      .transform(response);

    const headers = new Headers(transformed.headers);

    headers.delete("etag");
    headers.delete("last-modified");
    headers.delete("content-length");
    headers.set("cache-control", "no-store");

    return new Response(transformed.body, {
      status: transformed.status,
      headers
    });

  } catch {
    return response;
  }
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
    const page = withHeaderUi(response, url);
    return request.method === "GET"
      ? withMarketPreview(page, url, env)
      : page;
  },
};
