(() => {
  const $=id=>document.getElementById(id);
  const text=(id,value)=>{$(id).textContent=value;};
  const num=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value).toLocaleString("ar"):"—";
  let active="overview",epoch=0,wasVisible=false;
  const cat={bios:{page:1,items:null},boards:{page:1,items:null}};
  const paging={users:1,issues:1},PAGE=30;
  function alive(e){return e===epoch&&!!token&&!dashboard.classList.contains("hidden");}
  function button(label,fn,cls="softBtn"){const b=document.createElement("button");b.className=cls;b.type="button";b.textContent=label;b.onclick=fn;return b;}
  function line(title,sub,action){const row=document.createElement("div");row.className="dataRow";const d=document.createElement("div"),b=document.createElement("b"),s=document.createElement("small");b.textContent=title;s.textContent=sub||"";d.append(b,s);row.append(d);if(action)row.append(action);return row;}
  function message(root,value){const p=document.createElement("p");p.className="muted";p.textContent=value;root.replaceChildren(p);}
  async function publicJson(path){const r=await fetch(path,{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status+" — "+path);return r.json();}
  function handle(err,id,e){if(!alive(e))return;if(err.status===401){sessionStorage.removeItem(TOKEN_KEY);token="";showLogin("انتهت صلاحية الإدارة. سجّل الدخول مجددًا.");return;}text(id,err.message);}
  async function overview(){
    const e=epoch,jobs=[["/data/home-data.json",publicJson],["/api/stats/summary",publicJson],["/api/admin/market/overview?filter=all&page=1",api],["/api/admin/site/summary",api],["/api/admin/overview",api]];
    const result=await Promise.allSettled(jobs.map(([path,fn])=>fn(path)));if(!alive(e))return;
    if(result.some(r=>r.status==="rejected"&&r.reason?.status===401)){handle({status:401},"overviewStatus",e);return;}
    const [home,stats,market,site,chat]=result.map(r=>r.status==="fulfilled"?r.value:null);
    for(const [id,val] of [["biosCount",home?.stats?.biosCount],["boardCount",home?.stats?.boardCount],["visits",stats?.visits],["downloads",stats?.downloads],["marketCount",market?.total],["usersCount",site?.users],["issuesCount",site?.openIssues],["dashMessages",chat?.summary?.messages]])text(id,num(val));
    text("overviewStatus",result.every(r=>r.status==="fulfilled")?"تم تحديث البيانات.":"تعذر تحميل بعض المصادر؛ تظهر شرطة بدل الأرقام غير المتاحة.");
  }
  function renderCatalog(id){
    const state=cat[id];if(!state.items)return;
    const q=$(id+"Search").value.toLowerCase().trim(),items=state.items.filter(x=>!q||[x.brand,x.model,x.board,x.file,x.relative_path,x.revision].join(" ").toLowerCase().includes(q));
    const pages=Math.max(1,Math.ceil(items.length/PAGE));state.page=Math.min(Math.max(1,state.page),pages);
    const shown=items.slice((state.page-1)*PAGE,state.page*PAGE),root=$(id+"Rows");
    root.replaceChildren(...shown.map(x=>line(x.model||x.file||"ملف",[x.brand,x.board,x.file,x.revision,x.type].filter(Boolean).join(" · "))));
    if(!shown.length)message(root,"لا توجد نتائج.");
    text(id+"Summary",num(items.length)+" نتيجة من "+num(state.items.length)+" سجل");text(id+"Page",state.page+" / "+pages);$(id+"Prev").disabled=state.page<=1;$(id+"Next").disabled=state.page>=pages;
  }
  async function loadCatalog(id,force=false){
    if(cat[id].items&&!force){renderCatalog(id);return;}
    const e=epoch;text(id+"Summary","جاري تحميل الفهرس…");
    try{const paths=id==="bios"?["/data/bios.json"]:["/data/boards.json","/data/boards-large.json"];const groups=await Promise.all(paths.map(publicJson));if(!alive(e))return;if(groups.some(g=>!Array.isArray(g)))throw Error("صيغة الفهرس غير متوقعة.");const seen=new Set();cat[id].items=groups.flat().filter(x=>{if(!x||!x.file)return false;const key=String(id==="bios"?x.sha256||x.download_url||x.file:x.file).toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});renderCatalog(id);}catch(err){handle(err,id+"Summary",e);}
  }
  async function loadPaged(id){
    const e=epoch,isUsers=id==="users",filter=isUsers?"":"&filter="+encodeURIComponent($("issuesFilter").value);
    const requestedPage=paging[id];
    try{
      const data=await api("/api/admin/site/"+id+"?page="+requestedPage+filter);if(!alive(e)||paging[id]!==requestedPage||(!isUsers&&filter!=="&filter="+encodeURIComponent($("issuesFilter").value)))return;
      const root=$(id+"Rows");root.replaceChildren();
      for(const item of data.items){
        if(isUsers){const a=button(item.suspended?"إعادة المشاركة":"تعليق المشاركة",async()=>{
          if(!confirm(item.suspended?"إعادة السماح بالمشاركة؟":"تعليق المشاركة في السوق والغرفة؟"))return;
          try{await api("/api/admin/site/user-action",{method:"POST",body:JSON.stringify({id:item.id,suspended:!item.suspended})});if(alive(e))await loadPaged(id);}catch(err){handle(err,id+"Status",e);}
        },item.suspended?"softBtn":"dangerBtn");root.append(line(item.name,(item.suspended?"معلق":"مسموح")+" · آخر ظهور: "+fmt(item.last_seen),a));}
        else{const a=button(item.resolved?"إعادة فتح":"تمت المعالجة",async()=>{try{await api("/api/admin/site/issue-action",{method:"POST",body:JSON.stringify({id:item.id,resolved:!item.resolved})});if(alive(e))await loadPaged(id);}catch(err){handle(err,id+"Status",e);}});const c=document.createElement("article");c.className="adminCard";c.append(line(item.kind,item.user_name+" · "+fmt(item.created),a));const p=document.createElement("p");p.className="adminText";p.textContent=item.description;c.append(p);if(item.page){const link=document.createElement("p");link.dir="ltr";link.textContent=item.page;c.append(link);}root.append(c);}
      }
      if(!data.items.length)message(root,isUsers?"لم ترصد حسابات بعد. ستظهر عند تسجيل الدخول أو التحقق من الجلسة.":"لا توجد بلاغات ضمن هذا الاختيار.");
      const pages=Math.max(1,Math.ceil(data.total/data.limit));if(paging[id]>pages){paging[id]=pages;return loadPaged(id);}
      text(id+"Status",num(data.total)+" سجل");text(id+"Page",paging[id]+" / "+pages);$(id+"Prev").disabled=paging[id]<=1;$(id+"Next").disabled=paging[id]>=pages;
    }catch(err){handle(err,id+"Status",e);}
  }
  async function loadNotice(){const e=epoch;try{const s=await api("/api/admin/site/settings");if(!alive(e))return;$("noticeText").value=s.text||"";$("noticeEnabled").checked=!!s.enabled;$("noticeTone").value=s.tone||"info";text("settingNotice",s.enabled?"التنبيه مفعّل":"التنبيه متوقف");text("noticeStatus","");}catch(err){handle(err,"noticeStatus",e);}}
  async function stats(){const e=epoch;try{const [s,t]=await Promise.all([publicJson("/api/stats/summary"),publicJson("/api/stats/top?limit=20&include=boards")]);if(!alive(e))return;text("statsVisits",num(s.visits));text("statsDownloads",num(s.downloads));$("statsTop").replaceChildren(...(t.items||[]).map(x=>line(x.board?.model||x.key,num(x.count)+" تحميل")));if(!t.items?.length)message($("statsTop"),"لا توجد تحميلات مسجلة.");text("statsStatus","تم التحديث.");}catch(err){handle(err,"statsStatus",e);}}
  async function health(){const root=$("healthRows"),e=epoch;root.replaceChildren();$("healthRun").disabled=true;const paths=["/","/boardview/","/bios/","/market/","/diagnostics/","/community","/contact","/robots.txt","/sitemap.xml","/favicon.ico","/api/stats/summary","/api/site/notice"];try{for(const path of paths){if(!alive(e))return;const start=performance.now();let status,ok=false;try{const r=await fetch(path,{method:"GET",cache:"no-store",signal:AbortSignal.timeout(12000)});status=r.status;ok=r.ok;if(r.body)await r.body.cancel();}catch{status="تعذر الاتصال";}if(!alive(e))return;const row=line(path,status+" · "+Math.round(performance.now()-start)+" ms");row.classList.add(ok?"ok":"bad");root.append(row);}}finally{$("healthRun").disabled=false;}}
  async function security(){const e=epoch;try{const s=await api("/api/admin/security");if(!alive(e))return;$("securityRows").replaceChildren(...[["مفتاح الإدارة",s.adminConfigured],["تسجيل الدخول Google",s.googleConfigured],["توقيع الجلسات",s.sessionConfigured]].map(([a,b])=>line(a,b?"مُهيأ":"غير مُهيأ")));}catch(err){handle(err,"securityRows",e);}}
  async function collectPages(path,e,limit=300){let items=[],total=0;for(let page=1;page<=30;page++){if(!alive(e))throw Error("تم إلغاء اللقطة.");const data=await api(path+(path.includes("?")?"&":"?")+"page="+page);total=data.total;items.push(...data.items);if(items.length>=total||items.length>=limit||!data.items.length)break;}return{items:items.slice(0,limit),total,truncated:total>items.slice(0,limit).length};}
  async function backup(){const e=epoch;$("backupRun").disabled=true;text("backupStatus","جاري جمع اللقطة…");try{const [chat,market,users,issues,settings]=await Promise.all([api("/api/admin/overview"),collectPages("/api/admin/market/overview?filter=all",e),collectPages("/api/admin/site/users",e),collectPages("/api/admin/site/issues?filter=all",e),api("/api/admin/site/settings")]);if(!alive(e))return;const blob=new Blob([JSON.stringify({createdAt:new Date().toISOString(),scope:"admin snapshot; excludes image bytes and complete market replies",chat,market,users,issues,settings},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="pcbr-admin-snapshot-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);text("backupStatus","تم تجهيز اللقطة. احتفظ بها في مكان خاص.");}catch(err){handle(err,"backupStatus",e);}finally{$("backupRun").disabled=false;}}
  function load(id,force=false){if(!token||dashboard.classList.contains("hidden"))return;if(id==="overview")return overview();if(id==="users"||id==="issues")return loadPaged(id);if(id==="bios"||id==="boards")return loadCatalog(id,force);if(id==="community")return loadOverview();if(id==="market")return $("marketAdminRefresh").click();if(id==="notices"||id==="settings")return loadNotice();if(id==="stats")return stats();if(id==="security")return security();if(id==="health"&&force)return health();}
  function select(id){active=id;document.querySelectorAll("[data-view]").forEach(p=>p.classList.toggle("hidden",p.dataset.view!==id));document.querySelectorAll("[data-panel]").forEach(b=>{const yes=b.dataset.panel===id;b.classList.toggle("active",yes);if(yes){b.setAttribute("aria-current","page");text("panelTitle",b.textContent.trim());}else b.removeAttribute("aria-current");});load(id);}
  function sync(){const visible=!dashboard.classList.contains("hidden");if(visible===wasVisible)return;wasVisible=visible;epoch++;if(visible)select("overview");else{for(const id of ["usersRows","issuesRows","securityRows","statsTop","healthRows"])$(id).replaceChildren();$("noticeForm").reset();paging.users=paging.issues=1;}}
  new MutationObserver(sync).observe(dashboard,{attributes:true,attributeFilter:["class"]});
  $("refreshBtn").onclick=()=>load(active,true);
  document.querySelectorAll("[data-panel]").forEach(b=>b.onclick=()=>select(b.dataset.panel));
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>select(b.dataset.go));
  for(const id of ["bios","boards"]){$(id+"Search").oninput=()=>{cat[id].page=1;renderCatalog(id);};$(id+"Reload").onclick=()=>loadCatalog(id,true);$(id+"Prev").onclick=()=>{cat[id].page--;renderCatalog(id);};$(id+"Next").onclick=()=>{cat[id].page++;renderCatalog(id);};}
  for(const id of ["users","issues"]){$(id+"Prev").onclick=()=>{paging[id]=Math.max(1,paging[id]-1);loadPaged(id);};$(id+"Next").onclick=()=>{paging[id]++;loadPaged(id);};}
  $("issuesFilter").onchange=()=>{paging.issues=1;loadPaged("issues");};$("issuesReload").onclick=()=>loadPaged("issues");
  $("noticeForm").onsubmit=async e=>{e.preventDefault();const session=epoch;$("noticeSave").disabled=true;try{await api("/api/admin/site/settings",{method:"POST",body:JSON.stringify({text:$("noticeText").value,tone:$("noticeTone").value,enabled:$("noticeEnabled").checked})});if(alive(session))text("noticeStatus","تم حفظ الإعدادات.");}catch(err){handle(err,"noticeStatus",session);}finally{$("noticeSave").disabled=false;}};
  $("healthRun").onclick=health;$("backupRun").onclick=backup;sync();
})();