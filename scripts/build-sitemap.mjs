import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const publicDir = path.join(repoRoot, 'public');
const boardsJson = path.join(publicDir, 'data', 'boards.json');
const boardsLargeJson = path.join(publicDir, 'data', 'boards-large.json');
const sitemapOutput = path.join(publicDir, 'sitemap.xml');
const directoryOutput = path.join(publicDir, 'boardview', 'directory.html');
const site = 'https://pc-board-repair.alinasser00001.workers.dev';

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.flatMap((item) => Array.isArray(item?.value) ? item.value : [item]).filter(Boolean);
}

function fileKey(value) {
  const s = String(value ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function textSlug(value) {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
  return slug || 'boardview';
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[ch]);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function collectHtmlPaths(relativeDir) {
  const root = path.join(publicDir, relativeDir);
  if (!fs.existsSync(root)) return [];

  const results = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        results.push('/' + path.relative(publicDir, full).split(path.sep).join('/'));
      }
    }
  }

  walk(root);
  return results;
}
const staticPaths = [
  '/',
  '/boardview/index.html',
  '/boardview/featured.html',
  '/boardview/directory.html',
  '/boardview/hp-compaq-dc5800-c453-vrm-repair.html',
  '/bios/index.html',
  '/bios/intel.html',
  '/community.html',
  '/about.html',
  '/contact.html',
  '/privacy.html',
  '/terms.html',
  '/disclaimer.html',
  '/copyright.html',
  '/diagnostics/index.html',
  '/diagnostics/no-power.html',
  '/diagnostics/no-display.html',
  '/diagnostics/restarts-shuts-down.html',
  '/diagnostics/short-circuit.html',
  '/diagnostics/post-beep-codes.html',
  '/diagnostics/vrm-cpu-ram.html',
  '/component-testing/index.html',
  ...collectHtmlPaths('diagnostics'),
  ...collectHtmlPaths('component-testing'),
  ...collectHtmlPaths('bios'),
];

const all = [...readJsonArray(boardsJson), ...readJsonArray(boardsLargeJson)];
const seenFiles = new Set();
const boardPaths = [];
const directoryItems = [];

for (const board of all) {
  const brand = String(board?.brand ?? '').trim();
  const file = String(board?.file ?? '').trim();
  if (!brand || !file) continue;

  const identity = file.toLowerCase();
  if (seenFiles.has(identity)) continue;
  seenFiles.add(identity);

  const slug = textSlug([board.brand, board.model, board.board, board.revision].filter(Boolean).join('-'));
  const itemPath = `/boardview/item/${fileKey(file)}/${slug}`;
  boardPaths.push(itemPath);
  directoryItems.push({
    brand,
    model: String(board?.model ?? '').trim(),
    board: String(board?.board ?? '').trim(),
    revision: String(board?.revision ?? '').trim(),
    type: String(board?.type ?? '').trim(),
    path: itemPath,
  });
}

const urls = [...new Set([...staticPaths, ...boardPaths])];
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((urlPath) => `  <url><loc>${escapeXml(site + urlPath)}</loc></url>`),
  '</urlset>',
  '',
].join('\n');
fs.writeFileSync(sitemapOutput, sitemap, 'utf8');

const grouped = new Map();
for (const item of directoryItems.sort((a, b) =>
  a.brand.localeCompare(b.brand, 'en', { sensitivity: 'base' }) ||
  a.model.localeCompare(b.model, 'en', { sensitivity: 'base' }) ||
  a.board.localeCompare(b.board, 'en', { sensitivity: 'base' }) ||
  a.revision.localeCompare(b.revision, 'en', { sensitivity: 'base' })
)) {
  if (!grouped.has(item.brand)) grouped.set(item.brand, []);
  grouped.get(item.brand).push(item);
}

const directory = [];
directory.push('<!doctype html>');
directory.push('<html lang="ar" dir="rtl">');
directory.push('<head>');
directory.push('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');
directory.push('<title>فهرس جميع ملفات BoardView | PC Board Repair</title>');
directory.push('<meta name="description" content="فهرس HTML ثابت لجميع ملفات BoardView في PC Board Repair، مرتب حسب الشركة مع روابط مباشرة إلى صفحات الملفات لتسهيل التصفح والزحف.">');
directory.push('<meta name="robots" content="index,follow">');
directory.push(`<link rel="canonical" href="${site}/boardview/directory.html">`);
directory.push('<link rel="stylesheet" href="../style.css"><link rel="stylesheet" href="../boardview-extra.css">');
directory.push('</head>');
directory.push('<body>');
directory.push('<header><a class="logo" href="../index.html">PC Board Repair</a><nav><a href="../index.html">الرئيسية</a><a href="index.html">BoardView</a><a href="featured.html">ملفات مختارة</a><a href="../diagnostics/index.html">التشخيص</a></nav></header>');
directory.push('<main class="wrap">');
directory.push('<div class="crumb"><a href="../index.html">الرئيسية</a> ← <a href="index.html">BoardView</a> ← الفهرس الكامل</div>');
directory.push('<h1>فهرس جميع ملفات BoardView</h1>');
directory.push(`<p class="muted">يتضمن هذا الفهرس ${directoryItems.length} رابطًا مباشرًا وثابتًا إلى صفحات ملفات BoardView. استخدم بحث المتصفح للوصول بسرعة إلى الشركة أو الموديل أو رقم البورد أو Revision.</p>`);

for (const [brand, items] of grouped) {
  directory.push(`<section class="sectionBlock"><h2>${escapeHtml(brand)} <span class="countBadge">${items.length}</span></h2><ul>`);
  for (const item of items) {
    const parts = [];
    if (item.model) parts.push(item.model);
    if (item.board && item.board !== item.model) parts.push(item.board);
    if (item.revision) parts.push(item.revision);
    if (item.type) parts.push(item.type);
    const label = escapeHtml(parts.join(' • ') || 'BoardView');
    directory.push(`<li><a href="${escapeHtml(item.path)}">${label}</a></li>`);
  }
  directory.push('</ul></section>');
}

directory.push('</main>');
directory.push('<footer><div class="footerLinks"><a href="index.html">BoardView</a><a href="featured.html">ملفات مختارة</a><a href="../diagnostics/index.html">التشخيص</a><a href="../contact.html">اتصل بنا</a><a href="../privacy.html">سياسة الخصوصية</a></div><div>© 2026 PC Board Repair</div></footer>');
directory.push('</body></html>');
directory.push('');
fs.mkdirSync(path.dirname(directoryOutput), { recursive: true });
fs.writeFileSync(directoryOutput, directory.join('\n'), 'utf8');

console.log(`Static sitemap built: ${urls.length} URL(s)`);
console.log(`Static BoardView directory built: ${directoryItems.length} file link(s)`);
console.log(sitemapOutput);
console.log(directoryOutput);
