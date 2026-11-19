import test from "node:test";
import assert from "node:assert/strict";
import { makeStorage } from "./sqlite-helper.mjs";
import { SiteStats, groupBiosDownloadKeys, verifiedBiosKey, statsBucket } from "../src/site-stats.js";
const identity="a".repeat(64),other="b".repeat(64),sha="c".repeat(64);
const at=Date.parse("2026-11-19T12:00:00Z");
test("statistics preserve legacy totals and add deduplicated dated SQLite counters",async()=>{
 const {ctx}=makeStorage(),s=new SiteStats(ctx.storage);
 await ctx.storage.put("visitCount",100);await ctx.storage.put("downloadCounts",{abc:30});
 assert.equal(s.record("visits","",identity,at).ok,true);
 assert.equal(s.record("visits","",identity,at+1000).duplicate,true);
 s.record("visits","",other,at+1000);s.record("boards","abc",identity,at);
 assert.equal(s.record("boards","abc",identity,at+1000).duplicate,true);
 s.record("bios",sha,identity,at);assert.equal(s.record("bios",sha,identity,at+1000).duplicate,true);
 assert.equal(s.record("bios","fake",identity,at).ok,false);
 assert.deepEqual(await s.summary(),{visits:102,downloads:31,biosRequests:1});
 assert.deepEqual(await s.top(3),{items:[{key:"abc",count:31}],total:31});
 assert.equal(await ctx.storage.get("visitCount"),100);assert.deepEqual(await ctx.storage.get("downloadCounts"),{abc:30});
 const p=new SiteStats(ctx.storage).periods(at);
 assert.deepEqual(p.periods[0],{days:1,from:"2026-11-19",to:"2026-11-19",visits:2,downloads:1,biosRequests:1});
});
test("UTC period boundaries and cooldown expiration retain only new observed data",()=>{
 const {ctx}=makeStorage(),s=new SiteStats(ctx.storage);
 const now=Date.parse("2026-11-19T00:00:00Z");
 s.record("visits","",identity,now-8*86400000);s.record("visits","",identity,now-86400000);
 s.record("visits","",identity,now);s.record("visits","",identity,now+1800000);
 assert.deepEqual(s.periods(now+1800000).periods.map(x=>x.visits),[2,3,4]);
 assert.equal(s.one("SELECT COUNT(*) AS n FROM stats_recent").n,1);
});
test("BIOS clicks require a known catalog URL, never an arbitrary target",async()=>{
 const url="https://github.com/DarkEchoProject/pc-board-repair/releases/download/bios-archive-0022/test.zip";
 const groups=groupBiosDownloadKeys([{download_url:url,sha256:sha},{download_url:"https://other.test/a.zip",sha256:sha}]);
 const assets={fetch:async req=>{assert.ok(new URL(req.url).pathname.endsWith(statsBucket(url)+".json"));return Response.json(groups.get(statsBucket(url)));}};
 assert.equal(await verifiedBiosKey(assets,"https://site.test",url),sha);
 assert.equal(await verifiedBiosKey(assets,"https://site.test","https://evil.test/a.zip"),"");
 const absent={fetch:async()=>Response.json([])};
 assert.equal(await verifiedBiosKey(absent,"https://site.test",url),"");
});
