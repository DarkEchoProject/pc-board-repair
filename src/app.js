import baseWorker, { ChatRoom as BaseChatRoom } from "./index.js";

const SITE = "https://pc-board-repair.alinasser00001.workers.dev";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

const cleanId = value => String(value ?? "").trim().slice(0, 80);

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export class ChatRoom extends BaseChatRoom {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/admin/")) {
      if (request.headers.get("x-admin-authorized") !== "1") {
        return json({ error: "غير مصرح." }, 403);
      }

      if (request.method === "GET" && url.pathname === "/api/admin/overview") {
        const messages = (await this.ctx.storage.get("messages")) || [];
        const reports = (await this.ctx.storage.get("reportCounts")) || {};
        const items = messages.map(message => ({
          ...message,
          reportCount: Number(reports[message.id]) || 0,
        }));
        const reported = items
          .filter(item => item.reportCount > 0)
          .sort((a, b) => b.reportCount - a.reportCount || String(b.time || "").localeCompare(String(a.time || "")));
        const totalReports = reported.reduce((sum, item) => sum + item.reportCount, 0);
        return json({
          messages: items,
          reported,
          summary: {
            messages: items.length,
            reportedMessages: reported.length,
            totalReports,
          },
        });
      }

      if (request.method === "POST" && url.pathname === "/api/admin/delete-message") {
        const body = await readBody(request);
        if (!body) return json({ error: "طلب غير صالح." }, 400);
        const id = cleanId(body.id);
        const messages = (await this.ctx.storage.get("messages")) || [];
        const exists = messages.some(item => item.id === id);
        if (!exists) return json({ error: "الرسالة غير موجودة." }, 404);

        const updated = messages.filter(item => item.id !== id);
        const reports = (await this.ctx.storage.get("reportCounts")) || {};
        delete reports[id];
        await this.ctx.storage.put("messages", updated);
        await this.ctx.storage.put("reportCounts", reports);
        return json({ ok: true, remaining: updated.length });
      }

      if (request.method === "POST" && url.pathname === "/api/admin/dismiss-report") {
        const body = await readBody(request);
        if (!body) return json({ error: "طلب غير صالح." }, 400);
        const id = cleanId(body.id);
        const reports = (await this.ctx.storage.get("reportCounts")) || {};
        delete reports[id];
        await this.ctx.storage.put("reportCounts", reports);
        return json({ ok: true });
      }

      return json({ error: "Not found" }, 404);
    }

    return super.fetch(request);
  }
}

function getAdminToken(request) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return (request.headers.get("x-admin-token") || "").trim();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return Response.redirect(`${SITE}/admin.html`, 302);
    }

    if (url.pathname === "/admin.html") {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname.startsWith("/api/admin/")) {
      const configuredToken = String(env.ADMIN_TOKEN || "").trim();
      if (!configuredToken) {
        return json({ error: "لوحة الإدارة لم تُفعّل بعد. يجب إعداد ADMIN_TOKEN في Cloudflare." }, 503);
      }
      const suppliedToken = getAdminToken(request);
      if (!suppliedToken || suppliedToken !== configuredToken) {
        return json({ error: "كلمة مرور الإدارة غير صحيحة." }, 401);
      }

      const headers = new Headers(request.headers);
      headers.delete("authorization");
      headers.delete("x-admin-token");
      headers.set("x-admin-authorized", "1");
      const room = env.CHAT_ROOM.getByName("repair-main");
      return room.fetch(new Request(request, { headers }));
    }

    if (url.pathname === "/sitemap.xml") {
      const response = await baseWorker.fetch(request, env, ctx);
      if (!response.ok) return response;
      let xml = await response.text();
      const additions = [
        `${SITE}/diagnostics/index.html`,
        `${SITE}/diagnostics/no-power.html`,
        `${SITE}/diagnostics/no-display.html`,
        `${SITE}/diagnostics/restarts-shuts-down.html`,
        `${SITE}/diagnostics/short-circuit.html`,
        `${SITE}/diagnostics/post-beep-codes.html`,
      ];
      const extra = additions
        .filter(item => !xml.includes(`<loc>${item}</loc>`))
        .map(item => `  <url><loc>${item}</loc></url>`)
        .join("\n");
      if (extra) xml = xml.replace("</urlset>", `${extra}\n</urlset>`);
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/xml; charset=utf-8");
      return new Response(xml, { status: response.status, headers });
    }

    return baseWorker.fetch(request, env, ctx);
  },
};