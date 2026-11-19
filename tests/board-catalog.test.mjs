import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { boardPath, boardKey, boardCardPath, boardCard, fileKey, normalizeBoards, mergeBoards, normalizeSearchText, compactSearchText, fetchBoardCatalog, getInjectedBoard } from "../public/board-catalog.js";
import * as worker from "../src/board-catalog.js";
const read = name => JSON.parse(fs.readFileSync(new URL("../public/data/" + name, import.meta.url), "utf8").replace(/^\uFEFF/, ""));
test("shared Worker and browser routes preserve every committed BoardView sitemap URL", () => {
  const records = mergeBoards(normalizeBoards(read("boards.json")), normalizeBoards(read("boards-large.json")));
  const sitemap = fs.readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  const paths = [...sitemap.matchAll(/<loc>https:\/\/pc-board-repair\.alinasser00001\.workers\.dev(\/boardview\/item\/[^<]+)<\/loc>/g)].map(match => match[1]);
  const generated = records.map(boardPath);
  assert.ok(records.length > 0);
  assert.equal(new Set(records.map(b => fileKey(b.file))).size, records.length, "file key collision");
  assert.equal(new Set(paths).size, paths.length, "duplicate sitemap entry");
  assert.deepEqual([...generated].sort(), [...paths].sort());
  assert.equal(worker.boardPath, boardPath);
  for (const record of records) {
    const card = boardCard(record);
    assert.equal(boardCardPath(card), boardPath(record));
    assert.equal(boardKey(card), fileKey(record.file));
  }
});
test("search folds diacritics, punctuation and compact model numbers consistently", () => {
  assert.equal(normalizeSearchText("إصلاحُ اللوحة-Á"), "اصلاح اللوحه a");
  assert.equal(compactSearchText("LA-1234"), compactSearchText("LA 1234"));
});
test("shared catalog keeps base precedence, rejects malformed rows and supports partial fallback", async () => {
  const base = {brand:"Dell",file:"A.zip",model:"Base"};
  const extra = {brand:"HP",file:"b.zip"};
  const fetcher = async path => Response.json(path.endsWith("boards.json") ? [{value:[base]}] : [{brand:"Dell",file:"a.zip"}, extra, {brand:"Invalid"}]);
  assert.deepEqual(await fetchBoardCatalog({fetcher}), [base,extra]);
  const partial = async path => path.endsWith("boards.json") ? Response.json([base]) : new Response(null,{status:503});
  await assert.rejects(fetchBoardCatalog({fetcher:partial}));
  assert.deepEqual(await fetchBoardCatalog({fetcher:partial,allowPartial:true}),[base]);
  const document = {getElementById: () => ({textContent:JSON.stringify(base)})};
  assert.deepEqual(getInjectedBoard(fileKey(base.file),document),base);
  assert.equal(getInjectedBoard("wrong",document),null);
});
