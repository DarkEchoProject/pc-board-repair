import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/seo-entry.js", import.meta.url), "utf8")
  .replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  .replace(/^import .*;\n/gm, "").replace(/^export \{ ChatRoom \};\n/gm, "")
  .replace("export default", "const worker =");
const context = vm.createContext({ URL, Request, Response, Headers, TextEncoder,
  baseWorker: { fetch: async () => new Response(null) } });
vm.runInContext(source + "\nglobalThis.sut = { withSiteFavicon, FAVICON_TAG };", context);
const { withSiteFavicon, FAVICON_TAG } = context.sut;

test("all HTML pages get exactly the canonical ICO favicon", async () => {
  for (const links of [
    "",
    '<link rel="icon" href="/favicon.svg">',
    "<link href='/site-logo.png' rel='shortcut icon'><link rel=icon href='/another.ico'>",
    '<link rel="stylesheet" href="/style.css"><link rel="ICON" href="/favicon.svg">'
  ]) {
    const input = '<html><head>' + links + '<title>PCBR</title></head><body>OK</body></html>';
    const result = await withSiteFavicon(new Response(input, {headers: {"content-type":"text/html"}}));
    const html = await result.text();
    assert.equal(html.split(FAVICON_TAG).length, 2);
    assert.doesNotMatch(html, /favicon\.svg|another\.ico|site-logo\.png/);
    assert.match(html, /<title>PCBR<\/title>/);
    if (links.includes("stylesheet")) assert.match(html, /href="\/style\.css"/);
  }
});
test("non-HTML and 304 responses are unchanged", async () => {
  const asset = new Response("data", {headers: {"content-type":"application/json"}});
  assert.equal(await withSiteFavicon(asset), asset);
  const cached = new Response(null, {status:304, headers: {"content-type":"text/html"}});
  assert.equal(await withSiteFavicon(cached), cached);
});
