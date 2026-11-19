const DAY=86400000;
const dayAt=now=>new Date(now).toISOString().slice(0,10);
const number=value=>Number(value)||0;
export const statsBucket=url=>{let h=2166136261;for(const c of String(url)) {h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,"0").slice(-1);};
export function biosReleaseUrl(value){
  try{const u=new URL(String(value));return u.origin==="https://github.com"&&/^\/DarkEchoProject\/pc-board-repair\/releases\/download\/bios-archive-\d+\/.+/.test(u.pathname)&&!u.search&&!u.hash?u.href:"";}catch{return "";}
}
export function groupBiosDownloadKeys(records){
  const groups=new Map();
  for(const row of records){const url=biosReleaseUrl(row.download_url),sha=String(row.sha256||"").toLowerCase();if(!url||! /^[0-9a-f]{64}$/.test(sha))continue;const bucket=statsBucket(url);if(!groups.has(bucket))groups.set(bucket,[]);groups.get(bucket).push([url,sha]);}
  return groups;
}
export async function verifiedBiosKey(assets,origin,value){
  const url=biosReleaseUrl(value);if(!url)return "";
  const response=await assets.fetch(new Request(new URL("/data/bios-download-keys/"+statsBucket(url)+".json",origin)));
  if(!response.ok)return "";
  const rows=await response.json();if(!Array.isArray(rows))return "";
  const sha=rows.find(row=>Array.isArray(row)&&row[0]===url)?.[1];
  return /^[0-9a-f]{64}$/.test(String(sha||""))?sha:"";
}
export async function statsIdentity(request,env){
  const secret=String(env.SESSION_SECRET||env.ADMIN_TOKEN||"").trim();
  if(!secret)return "";
  const enc=new TextEncoder(),ip=request.headers.get("CF-Connecting-IP")||"local";
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const data=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode("pcbr-stats:"+ip)));
  return Array.from(data,b=>b.toString(16).padStart(2,"0")).join("");
}
export class SiteStats {
  constructor(storage){
    this.storage=storage;this.sql=storage.sql;
    for(const query of [
      "CREATE TABLE IF NOT EXISTS stats_daily(day TEXT PRIMARY KEY, visits INTEGER NOT NULL DEFAULT 0, boards INTEGER NOT NULL DEFAULT 0, bios INTEGER NOT NULL DEFAULT 0)",
      "CREATE TABLE IF NOT EXISTS stats_board_files(key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)",
      "CREATE TABLE IF NOT EXISTS stats_recent(key TEXT PRIMARY KEY, expires INTEGER NOT NULL)",
      "CREATE INDEX IF NOT EXISTS stats_recent_expiry ON stats_recent(expires)",
      "CREATE TABLE IF NOT EXISTS stats_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    ])this.sql.exec(query);
  }
  rows(q,...a){return this.sql.exec(q,...a).toArray();}
  one(q,...a){return this.rows(q,...a)[0];}
  record(kind,key,identity,now=Date.now()){
    if(!["visits","boards","bios"].includes(kind)||! /^[0-9a-f]{64}$/.test(identity))return {ok:false};
    if(kind==="boards"&&! /^[a-z0-9]{1,20}$/.test(key)||kind==="bios"&&! /^[0-9a-f]{64}$/.test(key))return {ok:false};
    const cooldown=kind==="visits"?30*60000:kind==="bios"?60000:10000;
    const dedupe=kind+":"+identity+":"+(kind==="visits"?"":key);
    return this.storage.transactionSync(()=>{
      this.sql.exec("DELETE FROM stats_recent WHERE expires<=?",now);
      if(this.one("SELECT expires FROM stats_recent WHERE key=?",dedupe))return {ok:true,duplicate:true};
      this.sql.exec("INSERT INTO stats_recent(key,expires) VALUES(?,?)",dedupe,now+cooldown);
      const day=dayAt(now);
      this.sql.exec("INSERT OR IGNORE INTO stats_meta(key,value) VALUES('started',?)",new Date(now).toISOString());
      this.sql.exec("INSERT OR IGNORE INTO stats_daily(day) VALUES(?)",day);
      this.sql.exec("UPDATE stats_daily SET "+kind+"="+kind+"+1 WHERE day=?",day);
      if(kind==="boards")this.sql.exec("INSERT INTO stats_board_files(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1",key);
      return {ok:true};
    });
  }
  totals(from,to){
    const row=from?this.one("SELECT SUM(visits) AS visits,SUM(boards) AS boards,SUM(bios) AS bios FROM stats_daily WHERE day>=? AND day<=?",from,to):this.one("SELECT SUM(visits) AS visits,SUM(boards) AS boards,SUM(bios) AS bios FROM stats_daily");
    return {visits:number(row?.visits),downloads:number(row?.boards),biosRequests:number(row?.bios)};
  }
  async summary(){
    const old=(await this.storage.get("downloadCounts"))||{};
    const visits=number(await this.storage.get("visitCount")),fresh=this.totals();
    return {visits:visits+fresh.visits,downloads:Object.values(old).reduce((s,v)=>s+number(v),0)+fresh.downloads,biosRequests:fresh.biosRequests};
  }
  async top(limit){
    const old=(await this.storage.get("downloadCounts"))||{},counts=new Map(Object.entries(old).map(([key,count])=>[key,number(count)]));
    for(const row of this.rows("SELECT key,count FROM stats_board_files"))counts.set(row.key,number(counts.get(row.key))+number(row.count));
    const items=[...counts].map(([key,count])=>({key,count})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key));
    return {items:items.slice(0,limit),total:items.reduce((s,row)=>s+row.count,0)};
  }
  periods(now=Date.now()){
    const today=dayAt(now),since=this.one("SELECT value FROM stats_meta WHERE key='started'")?.value||null;
    return {timezone:"UTC",since,periods:[1,7,30].map(days=>({days,from:dayAt(now-(days-1)*DAY),to:today,...this.totals(dayAt(now-(days-1)*DAY),today)}))};
  }
}
