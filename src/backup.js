// Explicit data-only allowlist. Never export session tokens, consent tokens, or abuse-prevention keys.
const TABLES=Object.freeze({
  site:Object.freeze({accounts:"site_accounts",issues:"site_issues",config:"site_config",audit:"site_admin_audit"}),
  market:Object.freeze({listings:"market_listings",photos:"market_photos",replies:"market_replies",reports:"market_reports"}),
  stats:Object.freeze({daily:"stats_daily",files:"stats_board_files",meta:"stats_meta"})
});
function base64(value){
  const bytes=value instanceof ArrayBuffer?new Uint8Array(value):new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
const integer=value=>/^(0|[1-9][0-9]{0,14})$/.test(value||"")&&Number.isSafeInteger(Number(value))?Number(value):null;
export function backupPage(sql,scope,url){
  const name=url.searchParams.get("table")||"",group=TABLES[scope];
  if(!group||!Object.hasOwn(group,name))return null;
  const table=group[name],photos=name==="photos",limit=photos?8:100;
  const rows=(query,...args)=>sql.exec(query,...args).toArray();
  const rawAfter=url.searchParams.get("after"),rawUpper=url.searchParams.get("upper");
  const after=rawAfter===null?0:integer(rawAfter);
  const upper=rawUpper===null?Number(rows("SELECT COALESCE(MAX(rowid),0) AS n FROM "+table)[0].n):integer(rawUpper);
  if(after===null||upper===null||after>upper)return null;
  const total=Number(rows("SELECT COUNT(*) AS n FROM "+table+" WHERE rowid<=?",upper)[0].n);
  const batch=rows("SELECT rowid AS __cursor,* FROM "+table+" WHERE rowid>? AND rowid<=? ORDER BY rowid LIMIT ?",after,upper,limit+1);
  const page=batch.slice(0,limit),next=batch.length>limit?page.at(-1).__cursor:null;
  return {table:name,upper,total,next,items:page.map(({__cursor,...row})=>{
    if(photos){row.data_base64=base64(row.data);delete row.data;}
    return row;
  })};
}
