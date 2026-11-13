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
writeHomeSummary(boards, biosRecords.length);
console.log(`Company index built: ${boardview.size} BoardView and ${bios.size} BIOS companies`);
