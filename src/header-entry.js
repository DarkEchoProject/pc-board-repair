import baseWorker, { ChatRoom } from "./seo-entry.js";

export { ChatRoom };

class HeaderUiHead {
  element(element) {
    element.append('<script src="/youtube-integration.js?v=20261020-9" defer></script>', { html: true });
  }
}

function withHeaderUi(response) {
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("text/html")) return response;
  return new HTMLRewriter()
    .on("head", new HeaderUiHead())
    .transform(response);
}

export default {
  async fetch(request, env, ctx) {
    const response = await baseWorker.fetch(request, env, ctx);
    return withHeaderUi(response);
  },
};
