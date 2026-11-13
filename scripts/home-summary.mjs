import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { boardCard } from "../src/board-catalog.js";

const output = fileURLToPath(new URL("../public/data/home-data.json", import.meta.url));

export function writeHomeSummary(boards, biosCount) {
  const dated = boards
    .map(board => ({ board, added: Date.parse(board.added_at ?? board.addedAt ?? "") }))
    .filter(item => Number.isFinite(item.added));
  const latest = dated.length >= 6
    ? dated.sort((a, b) => b.added - a.added).slice(0, 6).map(item => item.board)
    : boards.slice(-6).reverse();
  const contents = JSON.stringify({
    stats: {
      boardCount: boards.length,
      brandCount: new Set(boards.map(board => String(board.brand ?? "").trim())).size,
      imageCount: boards.filter(board => board.image).length,
      typeCount: new Set(boards.map(board => String(board.type ?? "").trim()).filter(Boolean)).size,
      biosCount,
    },
    latest: latest.map(boardCard),
  });

  if (fs.existsSync(output) && fs.readFileSync(output, "utf8") === contents) return;
  const temporary = `${output}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, "utf8");
    fs.renameSync(temporary, output);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
