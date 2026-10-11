import { DurableObject } from "cloudflare:workers";

const GA_ID = "G-V8YQEDWLDP";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

const cleanText = (value, max) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

const allowedCategories = new Set([
  "طلب مخطط",
  "مناقشة عطل",
  "BoardView",
  "BIOS",
  "عام",
]);

async function hashValue(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

class AnalyticsHead {
  element(element) {
    element.prepend(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>`,
      { html: true },
    );
  }
}

export class ChatRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rate = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/chat/messages") {
      const messages = (await this.ctx.storage.get("messages")) || [];
      return json({ messages });
    }

    if (request.method === "POST" && url.pathname === "/api/chat/send") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "طلب غير صالح." }, 400);
      }

      const name = cleanText(body.name, 32);
      const text = cleanText(body.text, 500);
      const category = allowedCategories.has(body.category) ? body.category : "عام";
      const website = cleanText(body.website, 100);

      // Honeypot field: real visitors never fill this.
      if (website) return json({ ok: true });
      if (name.length < 2) return json({ error: "اكتب اسمًا أو لقبًا من حرفين على الأقل." }, 400);
      if (text.length < 2) return json({ error: "الرسالة قصيرة جدًا." }, 400);

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const key = await hashValue(ip);
      const now = Date.now();
      const last = this.rate.get(key) || 0;
      if (now - last < 4000) {
        return json({ error: "انتظر بضع ثوانٍ قبل إرسال رسالة أخرى." }, 429);
      }
      this.rate.set(key, now);
      if (this.rate.size > 500) {
        const cutoff = now - 60 * 60 * 1000;
        for (const [k, t] of this.rate) if (t < cutoff) this.rate.delete(k);
      }

      const messages = (await this.ctx.storage.get("messages")) || [];
      const message = {
        id: crypto.randomUUID(),
        name,
        category,
        text,
        time: new Date(now).toISOString(),
      };
      messages.push(message);
      const trimmed = messages.slice(-200);
      await this.ctx.storage.put("messages", trimmed);
      return json({ ok: true, message }, 201);
    }

    return json({ error: "Not found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/chat/")) {
      const room = env.CHAT_ROOM.getByName("repair-main");
      return room.fetch(request);
    }

    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      return new HTMLRewriter().on("head", new AnalyticsHead()).transform(response);
    }
    return response;
  },
};
