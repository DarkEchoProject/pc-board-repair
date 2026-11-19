import test from "node:test";
import assert from "node:assert/strict";
import { makeStorage } from "./sqlite-helper.mjs";
import { backupPage } from "../src/backup.js";
import { MarketStore } from "../src/market.js";
const u=(table,extra="")=>new URL("https://site.test/?table="+table+extra);
test("private logical export paginates past 300 rows and rejects non-allowlisted tables",()=>{
  const {ctx}=makeStorage(),sql=ctx.storage.sql;
  sql.exec("CREATE TABLE site_accounts(id TEXT PRIMARY KEY,name TEXT)");
  for(let i=0;i<325;i++)sql.exec("INSERT INTO site_accounts VALUES(?,?)",String(i),"test");
  let p=backupPage(sql,"site",u("accounts")),items=[...p.items];
  const upper=p.upper;assert.equal(p.total,325);
  sql.exec("INSERT INTO site_accounts VALUES('new','new')");
  while(p.next!==null){p=backupPage(sql,"site",u("accounts","&upper="+upper+"&after="+p.next));items.push(...p.items);}
  assert.equal(items.length,325);assert.equal(new Set(items.map(x=>x.id)).size,325);
  assert.equal(backupPage(sql,"site",u("site_admin_attempts")),null);
  assert.equal(backupPage(sql,"site",u("accounts","&after=-1")),null);
});
test("private market export includes exact image bytes and denies consent token export",async()=>{
  const {ctx}=makeStorage(),market=new MarketStore(ctx),bytes=new Uint8Array([0,1,127,128,255]);
  ctx.storage.sql.exec("INSERT INTO market_photos VALUES(?,?,?,?,?)","p","l","image/png",bytes.buffer,0);
  const path="https://site.test/api/admin/market/backup?table=photos";
  assert.equal((await market.fetch(new Request(path))).status,403);
  const headers={"x-admin-authorized":"1"};
  const page=await (await market.fetch(new Request(path,{headers}))).json();
  assert.equal(page.total,1);assert.deepEqual(Buffer.from(page.items[0].data_base64,"base64"),Buffer.from(bytes));
  assert.equal("data" in page.items[0],false);
  assert.equal((await market.fetch(new Request(path.replace("photos","market_consents"),{headers}))).status,400);
});
