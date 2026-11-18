import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBiosCatalog, biosCompanyCatalogPath, groupBiosCompanies } from "../public/bios/catalog-data.js";
test("validated BIOS company shards partition the full source without duplicates",()=>{
  const url="https://github.com/DarkEchoProject/pc-board-repair/releases/download/bios-test/file.zip";
  const raw=[{brand:"Dell",file:"a.zip",sha256:"a".repeat(64),download_url:url},{brand:"DELL",file:"b.zip",sha256:"b".repeat(64),download_url:url},{brand:"HP",file:"c.zip",sha256:"c".repeat(64),download_url:url},{brand:"HP",file:"dup.zip",sha256:"a".repeat(64),download_url:url},{brand:"A/B",file:"d.zip",sha256:"d".repeat(64),download_url:url}];
  const records=normalizeBiosCatalog(raw),groups=groupBiosCompanies(records);
  assert.equal(records.length,4);assert.equal(groups.size,3);
  assert.equal(groups.get(biosCompanyCatalogPath("Dell")).length,2);
  assert.equal([...groups.values()].flat().length,records.length);
  assert.equal(biosCompanyCatalogPath(" Dell "),biosCompanyCatalogPath("DELL"));
  assert.match(biosCompanyCatalogPath("A/B"),/^\/data\/bios-companies\/[0-9a-f]+\.json$/);
});
