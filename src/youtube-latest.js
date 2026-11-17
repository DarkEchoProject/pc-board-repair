const CHANNEL_ID = "UCw73Z7vSBOAPl-r8nbBFLUw";
const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CHANNEL_ID;
const FRESH_MS = 5 * 60 * 1000;
const CLIENT_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function textField(xml, tag) {
  const match = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + "\\s*>", "i").exec(xml);
  if (!match) return "";
  return match[1].replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity, name) => {
    const key = name.toLowerCase();
    if (key[0] !== "#") return XML_ENTITIES[key];
    const hexadecimal = key[1] === "x";
    const codePoint = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return codePoint > 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
      ? String.fromCodePoint(codePoint)
      : entity;
  }).trim();
}

function parseFeed(xml) {
  // YouTube's Atom feed uses simple text fields inside each entry.
  const source = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, text) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  const videos = new Map();
  for (const [, entry] of source.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry\s*>/gi)) {
    const id = textField(entry, "yt:videoId");
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || videos.has(id) || textField(entry, "yt:channelId") !== CHANNEL_ID) continue;

    const title = textField(entry, "title");
    const published = Date.parse(textField(entry, "published"));
    if (!title || !Number.isFinite(published)) continue;

    const description = [...textField(entry, "media:description").replace(/\s+/g, " ")];
    videos.set(id, {
      id,
      title_ar: title,
      description_ar: description.length > 180 ? description.slice(0, 179).join("").trimEnd() + "…" : description.join(""),
      published_at: new Date(published).toISOString(),
    });
  }
  return [...videos.values()].sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 3);
}

export async function serveLatestYouTubeVideos(request, ctx) {
  if (request.method !== "GET") {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }

  const key = new Request(new URL("/api/youtube/latest", request.url));
  let cache;
  let saved;
  try {
    cache = await caches.open("pcbr-youtube-v1");
    saved = await cache.match(key);
  } catch {
    // Cache availability is independent of the feed request.
  }

  if (saved) {
    const age = Date.now() - Number(saved.headers.get("X-PCBR-Fetched-At"));
    if (age >= 0 && age < FRESH_MS) {
      return new Response(saved.body, { headers: CLIENT_HEADERS });
    }
  }

  try {
    const upstream = await fetch(FEED_URL, {
      headers: { Accept: "application/atom+xml" },
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) throw new Error("YouTube feed request failed");

    const videos = parseFeed(await upstream.text());
    if (!videos.length) throw new Error("YouTube feed returned no usable videos");
    const body = JSON.stringify(videos);

    if (cache) {
      const cacheResponse = new Response(body, {
        headers: {
          ...CLIENT_HEADERS,
          "Cache-Control": "public, max-age=86400",
          "X-PCBR-Fetched-At": String(Date.now()),
        },
      });
      ctx.waitUntil(cache.put(key, cacheResponse).catch(() => {}));
    }
    return new Response(body, { headers: CLIENT_HEADERS });
  } catch {
    if (saved) return new Response(saved.body, { headers: CLIENT_HEADERS });
    return Response.json({ error: "YouTube feed unavailable" }, { status: 502, headers: CLIENT_HEADERS });
  }
}
