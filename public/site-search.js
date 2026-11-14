(()=>{
  'use strict';

  const BOARD_DATA=['/data/boards.json','/data/boards-large.json'];
  const sources=new Map();

  const currentLang=()=>{
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  };

  function normalize(value){
    return String(value??'')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\p{M}ـ]/gu,'')
      .replace(/ى/g,'ي')
      .replace(/ة/g,'ه')
      .replace(/[^\p{L}\p{N}]+/gu,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function compact(value){
    return normalize(value).replace(/\s+/g,'');
  }

  function fileKey(path){
    let h=2166136261;
    for(let i=0;i<path.length;i++){
      h^=path.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    return (h>>>0).toString(36);
  }

  function textSlug(value){
    const slug=String(value??'')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0,120);
    return slug||'boardview';
  }

  function filenameOnly(path){
    const parts=String(path||'').split(/[\\/]/);
    return parts[parts.length-1]||'';
  }

  function boardValue(board){
    const raw=board?.board_number ?? board?.board ?? '';
    if(Array.isArray(raw))return raw.filter(Boolean).join(' ');
    return String(raw||'');
  }

  function typeValue(board){return String(board?.format||board?.type||'').trim();}

  const staticEntries=[
    {
      type:'boardview',url:'/boardview/hp-compaq-dc5800-c453-vrm-repair',
      titleAr:'HP Compaq dc5800 — C453 CPU VRM Repair Map',titleEn:'HP Compaq dc5800 — C453 CPU VRM Repair Map',
      subtitleAr:'Cheetah Rev A • AS# 450667-001 • SP# 461536-001 • FlexBV FZ',subtitleEn:'Cheetah Rev A • AS# 450667-001 • SP# 461536-001 • FlexBV FZ',
      keywords:'HP Compaq dc5800 HP_Compaq_dc5800 Cheetah Rev A 450667-001 461536-001 C453 R526 U46 NCP5385 NCP3488 VCORE VRM CPU boardview flexbv fz repair map مخطط خريطة اصلاح تغذية المعالج'
    },
    {
      type:'diagnostics',url:'/diagnostics/',
      titleAr:'تشخيص أعطال الكمبيوتر واللوحات الأم',titleEn:'PC & Motherboard Diagnostics',
      subtitleAr:'ابدأ من العطل الظاهر واتبع خطوات القياس بالترتيب.',subtitleEn:'Start from the visible fault and follow measurements in order.',
      keywords:'تشخيص اعطال صيانة motherboard repair diagnostics no power no display no post short circuit restart beep vrm cpu ram bios'
    },
    {
      type:'components',url:'/component-testing/',
      titleAr:'فحص القطع الإلكترونية بالأفوميتر',titleEn:'Electronic Component Testing with a Multimeter',
      subtitleAr:'ديود، مقاومة، BJT، MOSFET، مكثف، ملف، فيوز وجسر توحيد.',subtitleEn:'Diode, resistor, BJT, MOSFET, capacitor, inductor, fuse and bridge rectifier.',
      keywords:'فحص قطع افوميتر ملتيميتر multimeter diode ديود resistor مقاومة transistor ترانزستور bjt mosfet مكثف capacitor coil inductor ملف fuse فيوز bridge rectifier جسر توحيد'
    },
    {
      type:'bios',url:'/bios/',
      titleAr:'ملفات BIOS للوحات الأم',titleEn:'Motherboard BIOS Files',
      subtitleAr:'ملفات BIOS مرتبة حسب الشركة والموديل.',subtitleEn:'BIOS files organized by brand and model.',
      keywords:'bios بيوس flash spi programmer برمجة firmware ملف بيوس'
    },
    {
      type:'bios',url:'/bios/intel',
      titleAr:'Intel DH55PJ — BIOS TC0048P',titleEn:'Intel DH55PJ — BIOS TC0048P',
      subtitleAr:'ملف BIOS للوحة Intel DH55PJ — TC0048P.zip / TC0048P.BIO.',subtitleEn:'BIOS file for Intel DH55PJ — TC0048P.zip / TC0048P.BIO.',
      keywords:'intel dh55pj tc0048p tc0048p.zip tc0048p.bio bios بيوس intel desktop board'
    },
    {
      type:'community',url:'/community',
      titleAr:'غرفة الصيانة والطلبات',titleEn:'Repair Room & Requests',
      subtitleAr:'طلبات مخططات وBoardView وBIOS ومناقشة أعطال اللوحات.',subtitleEn:'Schematic, BoardView and BIOS requests plus repair discussions.',
      keywords:'غرفة الصيانة طلب مخطط schematic boardview bios مناقشة عطل repair room requests community فنيين'
    }
  ];

  function localize(entry,lang=currentLang()){
    return {
      ...entry,
      title:lang==='en'?(entry.titleEn||entry.titleAr):(entry.titleAr||entry.titleEn),
      subtitle:lang==='en'?(entry.subtitleEn||entry.subtitleAr):(entry.subtitleAr||entry.subtitleEn)
    };
  }

  function boardEntry(board){
    const brand=String(board?.brand||'Unknown').trim();
    const model=String(board?.model||'Unknown').trim();
    const boardNo=boardValue(board);
    const revision=String(board?.revision||'').trim();
    const format=typeValue(board);
    const file=String(board?.file||'');
    const fileName=filenameOnly(file);
    const readable=textSlug([board?.brand,board?.model,board?.board,board?.revision].filter(Boolean).join('-'));
    const details=[boardNo,revision,format].filter(Boolean).join(' • ');
    const keywords=[brand,model,boardNo,revision,format,fileName,file,'boardview','board view','خريطة','مخطط بورد'].filter(Boolean).join(' ');
    return {
      type:'boardview',
      url:`/boardview/item/${fileKey(file)}/${readable}`,
      titleAr:`${brand} — ${model}`,
      titleEn:`${brand} — ${model}`,
      subtitleAr:details||fileName,
      subtitleEn:details||fileName,
      keywords,
      brand,model,boardNo,revision,format,fileName,file
    };
  }

  function indexEntry(entry){
    const title=normalize(`${entry.titleAr||''} ${entry.titleEn||''}`);
    const model=normalize(entry.model);
    const boardNo=normalize(entry.boardNo);
    const fileName=normalize(entry.fileName);
    const text=normalize([
      entry.titleAr,entry.titleEn,entry.subtitleAr,entry.subtitleEn,entry.keywords,
      entry.brand,entry.model,entry.boardNo,entry.revision,entry.format,entry.fileName
    ].filter(Boolean).join(' '));
    const [titleCompact,modelCompact,boardNoCompact,fileNameCompact,textCompact]=
      [title,model,boardNo,fileName,text].map(value=>value.replace(/\s+/g,''));
    return {...entry,_search:{
      title,model,boardNo,fileName,text,titleCompact,modelCompact,boardNoCompact,fileNameCompact,textCompact
    }};
  }

  const staticIndex=staticEntries.map(indexEntry);

  function scoreEntry(entry,q,qCompact,tokens){
    const {title,model,boardNo,fileName,text,titleCompact,modelCompact,boardNoCompact,fileNameCompact,textCompact}=entry._search;
    let score=0;

    if(title===q)score+=120;
    if(model===q)score+=140;
    if(boardNo===q)score+=150;
    if(fileName===q)score+=130;
    if(title.startsWith(q))score+=80;
    if(model.startsWith(q))score+=90;
    if(boardNo.startsWith(q))score+=100;
    if(title.includes(q))score+=60;
    if(model.includes(q))score+=70;
    if(boardNo.includes(q))score+=80;
    if(fileName.includes(q))score+=55;
    if(text.includes(q))score+=45;

    if(qCompact){
      if(titleCompact===qCompact)score+=120;
      if(modelCompact===qCompact)score+=140;
      if(boardNoCompact===qCompact)score+=150;
      if(fileNameCompact===qCompact)score+=130;
      if(titleCompact.startsWith(qCompact))score+=70;
      if(modelCompact.startsWith(qCompact))score+=80;
      if(boardNoCompact.startsWith(qCompact))score+=90;
      if(titleCompact.includes(qCompact))score+=50;
      if(modelCompact.includes(qCompact))score+=60;
      if(boardNoCompact.includes(qCompact))score+=70;
      if(fileNameCompact.includes(qCompact))score+=45;
      if(textCompact.includes(qCompact))score+=35;
    }

    let matched=0;
    for(const token of tokens){
      if(!token)continue;
      if(title.includes(token)){score+=18;matched++;continue;}
      if(model.includes(token)){score+=20;matched++;continue;}
      if(boardNo.includes(token)){score+=22;matched++;continue;}
      if(fileName.includes(token)){score+=14;matched++;continue;}
      if(text.includes(token)){score+=8;matched++;}
    }
    if(tokens.length>1&&matched===tokens.length)score+=35;
    return matched===tokens.length||text.includes(q)||(qCompact&&textCompact.includes(qCompact))?score:0;
  }

  async function fetchEntries(path,read){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(path,{signal:controller.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const entries=await read(response);
      return entries.map(indexEntry);
    }finally{
      clearTimeout(timeout);
    }
  }

  function getSource(path,read){
    if(!sources.has(path)){
      sources.set(path,fetchEntries(path,read).catch(error=>{
        sources.delete(path);
        console.warn(`PCBR site search: ${path} unavailable.`,error);
        return [];
      }));
    }
    return sources.get(path);
  }

  async function readCatalog(response){
    const rows=await response.json();
    if(!Array.isArray(rows))throw new Error('Expected a catalog array');
    return rows;
  }

  async function readBoards(response){
    const rows=await readCatalog(response);
    return rows.flatMap(item=>Array.isArray(item?.value)?item.value:[item])
      .filter(board=>typeof board?.brand==='string'&&board.brand.trim()&&typeof board.file==='string'&&board.file.trim())
      .map(boardEntry);
  }

  async function readBios(response){
    const rows=await readCatalog(response);
    return rows
      .filter(item => item && item.file && item.download_url)
      .map(item => {
        const name = String(item.file);
        const brand = String(item.brand || 'Other');
        return {
          type: 'bios',
          url: `/bios/?q=${encodeURIComponent(name)}`,
          titleAr: `BIOS — ${name}`,
          titleEn: `BIOS — ${name}`,
          subtitleAr: `ملف BIOS • ${brand}`,
          subtitleEn: `BIOS file • ${brand}`,
          keywords: `${brand} ${name} ${item.relative_path || ''} BIOS بيوس`,
          brand,
          model: name,
          fileName: name
        };
      });
  }

  async function readDiagnostics(response){
    const page=new DOMParser().parseFromString(await response.text(),'text/html');
    const entries=[];
    for(const card of page.querySelectorAll('a.diagCard[href]')){
      const url=card.getAttribute('href');
      const titleAr=card.querySelector('h2')?.textContent.trim();
      if(!titleAr||!/^\/diagnostics\/[a-z0-9-]+(?:\.html)?$/.test(url))continue;
      entries.push({
        type:'diagnostics',url,titleAr,
        titleEn:card.dataset.searchTitleEn,
        subtitleAr:card.querySelector('p')?.textContent.trim(),
        subtitleEn:card.dataset.searchSummaryEn,
        keywords:card.dataset.searchKeywords
      });
    }
    if(!entries.length)throw new Error('No diagnosis cards found');
    return entries;
  }

  async function getIndex(type='all'){
    const includes=section=>type==='all'||type===section;
    const requests=[];
    if(includes('boardview'))requests.push(...BOARD_DATA.map(path=>getSource(path,readBoards)));
    if(includes('bios'))requests.push(getSource('/data/bios.json',readBios));
    if(includes('diagnostics'))requests.push(getSource('/diagnostics/',readDiagnostics));

    const entries=(await Promise.all(requests)).flat();
    const seen=new Set();
    const dynamicIndex=entries.filter(entry=>{
      if(entry.type!=='boardview')return true;
      const key=entry.file.trim().toLowerCase();
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
    return [...dynamicIndex,...staticIndex.filter(entry=>includes(entry.type))];
  }

  async function search(query,{limit=50,type='all'}={}){
    const q=normalize(query);
    if(!q)return [];
    const qCompact=q.replace(/\s+/g,'');
    const tokens=q.split(' ').filter(Boolean);
    const index=await getIndex(type);
    return index
      .map(entry=>({entry,score:scoreEntry(entry,q,qCompact,tokens)}))
      .filter(row=>row.score>0)
      .sort((a,b)=>b.score-a.score||String(a.entry.titleAr||'').localeCompare(String(b.entry.titleAr||''),'ar'))
      .slice(0,Math.max(1,limit))
      .map(row=>localize(row.entry));
  }

  function label(type,lang=currentLang()){
    const labels={
      all:{ar:'الكل',en:'All'},
      boardview:{ar:'BoardView',en:'BoardView'},
      bios:{ar:'BIOS',en:'BIOS'},
      diagnostics:{ar:'التشخيص',en:'Diagnostics'},
      components:{ar:'فحص القطع',en:'Component Testing'},
      community:{ar:'غرفة الصيانة',en:'Repair Room'}
    };
    return labels[type]?.[lang]||type;
  }

  window.PCBRSiteSearch={getIndex,search,normalize,compact,label,currentLang};
})();

