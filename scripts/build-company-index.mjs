import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeBiosCatalog } from "../public/bios/catalog-data.js";
import { boardPath, mergeBoards, normalizeBoards } from "../src/board-catalog.js";
import { writeHomeSummary } from "./home-summary.mjs";

const SAMPLE_LIMIT = 8;
const dataDir = new URL("../public/data/", import.meta.url);
const outputDir = new URL("../.wrangler/", import.meta.url);
const output = fileURLToPath(new URL("pcbr-company-index.js", outputDir));

function readCatalog(filename, optional = false) {
  const file = new URL(filename, dataDir);
  if (optional && !fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function summarizeCompanies(records, makeExample) {
  const companies = new Map();
  for (const item of records) {
    const brand = item.brand.trim();
    const key = brand.toLowerCase();
    if (!companies.has(key)) companies.set(key, { brand, count: 0, examples: [] });
    const company = companies.get(key);
    company.count += 1;
    if (company.examples.length < SAMPLE_LIMIT) company.examples.push(makeExample(item));
  }
  return companies;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function writeBoardviewCompanyCards(boards) {
  const page = fileURLToPath(new URL("../public/boardview/index.html", import.meta.url));
  const contents = fs.readFileSync(page, "utf8");
  const section = /<!-- boardview-companies:start -->[\s\S]*?<!-- boardview-companies:end -->/;
  if (!section.test(contents)) throw new Error("BoardView company card markers are missing.");

  const brands = [...new Set(boards.map(board => board.brand))]
    .sort((a, b) => a.localeCompare(b, "en"));
  const cards = brands.map(brand => {
    const records = boards.filter(board => board.brand === brand);
    const models = [...new Set(records.map(board => board.model).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "en"))
      .slice(0, 3)
      .join("، ");
    const href = "/boardview/company?brand=" + encodeURIComponent(brand);
    const description = models + (records.length > 3 ? "…" : "");
    return [
      `    <a class="card" href="${escapeHtml(href)}">`,
      `      <h2>${escapeHtml(brand)}</h2>`,
      `      <p class="muted">${escapeHtml(description)}</p>`,
      `      <div class="countBadge">${records.length} ملف</div>`,
      "    </a>",
    ].join("\n");
  }).join("\n");
  const replacement = [
    "<!-- boardview-companies:start -->",
    '  <div id="companies" class="grid companyGrid">',
    cards,
    "  </div>",
    "  <!-- boardview-companies:end -->",
  ].join("\n");
  const updated = contents.replace(section, () => replacement);
  if (updated === contents) return;

  const temporary = `${page}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, updated, "utf8");
    fs.renameSync(temporary, page);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

const boards = mergeBoards(
  normalizeBoards(readCatalog("boards.json")),
  normalizeBoards(readCatalog("boards-large.json", true)),
);
const boardview = summarizeCompanies(boards, board => ({
  label: [board.model || board.file, board.board, board.revision].filter(Boolean).join(" • "),
  href: boardPath(board),
}));
const biosRecords = normalizeBiosCatalog(readCatalog("bios.json"));
const bios = summarizeCompanies(biosRecords, item => ({
  label: String(item.file),
  href: item.download_url,
}));

const source = `export const companies = {
  boardview: new Map(${JSON.stringify([...boardview])}),
  bios: new Map(${JSON.stringify([...bios])}),
};\n`;
fs.mkdirSync(outputDir, { recursive: true });
const temporary = `${output}.${process.pid}.tmp`;
try {
  fs.writeFileSync(temporary, source);
  fs.renameSync(temporary, output);
} finally {
  fs.rmSync(temporary, { force: true });
}
writeBoardviewCompanyCards(boards);
writeHomeSummary(boards, biosRecords.length);
console.log(`Company index built: ${boardview.size} BoardView and ${bios.size} BIOS companies`);
