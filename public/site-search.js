(()=>{
  'use strict';

  const BOARD_DATA='/data/boards.json';
  let indexPromise=null;

  const currentLang=()=>{
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  };

  function normalize(value){
    return String(value??'')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[أإآ]/g,'ا')
      .replace(/ى/g,'ي')
      .replace(/ة/g,'ه')
      .replace(/[ًٌٍَُِّْـ]/g,'')
      .replace(/[^\p{L}\p{N}]+/gu,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function compact(value){
    return normalize(value).replace(/\s+/g,'');
  }

  function fileKey(path){
    let h=2166136261>>>0;
    for(const ch of String(path||'')){
      h^=ch.charCodeAt(0);
      h=Math.imul(h,16777619)>>>0;
    }
    return h.toString(36);
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
      type:'boardview',url:'/boardview/hp-compaq-dc5800-c453-vrm-repair.html',
      titleAr:'HP Compaq dc5800 — C453 CPU VRM Repair Map',titleEn:'HP Compaq dc5800 — C453 CPU VRM Repair Map',
      subtitleAr:'Cheetah Rev A • AS# 450667-001 • SP# 461536-001 • FlexBV FZ',subtitleEn:'Cheetah Rev A • AS# 450667-001 • SP# 461536-001 • FlexBV FZ',
      keywords:'HP Compaq dc5800 HP_Compaq_dc5800 Cheetah Rev A 450667-001 461536-001 C453 R526 U46 NCP5385 NCP3488 VCORE VRM CPU boardview flexbv fz repair map مخطط خريطة اصلاح تغذية المعالج'
    },
    {
      type:'diagnostics',url:'/diagnostics/index.html',
      titleAr:'تشخيص أعطال الكمبيوتر واللوحات الأم',titleEn:'PC & Motherboard Diagnostics',
      subtitleAr:'ابدأ من العطل الظاهر واتبع خطوات القياس بالترتيب.',subtitleEn:'Start from the visible fault and follow measurements in order.',
      keywords:'تشخيص اعطال صيانة motherboard repair diagnostics no power no display no post short circuit restart beep vrm cpu ram bios'
    },
    {
      type:'diagnostics',url:'/diagnostics/no-power.html',
      titleAr:'الجهاز لا يعمل نهائيًا — No Power',titleEn:'PC completely dead — No Power',
      subtitleAr:'5VSB، زر التشغيل، PS_ON، مخارج الباور وخطوط الاستعداد.',subtitleEn:'5VSB, power button, PS_ON, PSU outputs and standby rails.',
      keywords:'لا يعمل لا يشتغل ميت باور no power dead 5vsb ps_on pwr_sw atx standby power button مزود طاقة'
    },
    {
      type:'diagnostics',url:'/diagnostics/no-display.html',
      titleAr:'يعمل ولا توجد صورة — No Display / No POST',titleEn:'Powers on with no image — No Display / No POST',
      subtitleAr:'RAM، VDIMM، CPU، Vcore، BIOS، Reset، Clock وكرت الشاشة.',subtitleEn:'RAM, VDIMM, CPU, Vcore, BIOS, Reset, Clock and graphics.',
      keywords:'لا توجد صورة شاشة سوداء no display no post ram vdimm cpu vcore bios reset clock gpu vga'
    },
    {
      type:'diagnostics',url:'/diagnostics/restarts-shuts-down.html',
      titleAr:'يعمل ثم يفصل أو يعيد التشغيل',titleEn:'Starts then shuts down or restarts',
      subtitleAr:'PSU، الحرارة، VRM، Vcore، RAM وتسلسل Power Good.',subtitleEn:'PSU, thermals, VRM, Vcore, RAM and Power Good.',
      keywords:'يفصل يعيد التشغيل ريستارت restart shutdown shuts down reboot loop psu temperature heat vrm power good'
    },
    {
      type:'diagnostics',url:'/diagnostics/short-circuit.html',
      titleAr:'تشخيص الشورت على اللوحة الأم',titleEn:'Motherboard Short-Circuit Diagnosis',
      subtitleAr:'تحديد الخط المقصور وعزل المراحل وفحص MOSFET والمكثفات.',subtitleEn:'Identify the shorted rail, isolate stages, and test MOSFETs and capacitors.',
      keywords:'شورت قصر short short circuit resistance ground gnd حقن فولت injection mosfet capacitor مكثف 12v vcore'
    },
    {
      type:'diagnostics',url:'/diagnostics/post-beep-codes.html',
      titleAr:'POST متوقف أو صفارات Beep Codes',titleEn:'POST freeze or Beep Codes',
      subtitleAr:'RAM، CPU، BIOS، VGA، POST Card، Reset وClock.',subtitleEn:'RAM, CPU, BIOS, VGA, POST Card, Reset and Clock.',
      keywords:'صفارات صافرات beep beeps beep codes post freeze تجمد post card debug led ram cpu bios vga'
    },
    {
      type:'diagnostics',url:'/diagnostics/vrm-cpu-ram.html',
      titleAr:'VRM وخطوط المعالج والرام',titleEn:'VRM, CPU & RAM Power Rails',
      subtitleAr:'12V CPU، PWM، MOSFET، الملفات، Vcore وVDIMM.',subtitleEn:'12V CPU, PWM, MOSFETs, inductors, Vcore and VDIMM.',
      keywords:'vrm cpu ram 12v eps pwm mosfet power stage drmos coil inductor vcore vdimm enable power good تغذية معالج رام ملفات'
    },
    {
      type:'components',url:'/component-testing/index.html',
      titleAr:'فحص القطع الإلكترونية بالأفوميتر',titleEn:'Electronic Component Testing with a Multimeter',
      subtitleAr:'ديود، مقاومة، BJT، MOSFET، مكثف، ملف، فيوز وجسر توحيد.',subtitleEn:'Diode, resistor, BJT, MOSFET, capacitor, inductor, fuse and bridge rectifier.',
      keywords:'فحص قطع افوميتر ملتيميتر multimeter diode ديود resistor مقاومة transistor ترانزستور bjt mosfet مكثف capacitor coil inductor ملف fuse فيوز bridge rectifier جسر توحيد'
    },
    {
      type:'bios',url:'/bios/index.html',
      titleAr:'ملفات BIOS للوحات الأم',titleEn:'Motherboard BIOS Files',
      subtitleAr:'ملفات BIOS مرتبة حسب الشركة والموديل.',subtitleEn:'BIOS files organized by brand and model.',
      keywords:'bios بيوس flash spi programmer برمجة firmware ملف بيوس'
    },
    {
      type:'bios',url:'/bios/intel.html',
      titleAr:'Intel DH55PJ — BIOS TC0048P',titleEn:'Intel DH55PJ — BIOS TC0048P',
      subtitleAr:'ملف BIOS للوحة Intel DH55PJ — TC0048P.zip / TC0048P.BIO.',subtitleEn:'BIOS file for Intel DH55PJ — TC0048P.zip / TC0048P.BIO.',
      keywords:'intel dh55pj tc0048p tc0048p.zip tc0048p.bio bios بيوس intel desktop board'
    },
    {
      type:'community',url:'/community.html',
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
      brand,model,boardNo,revision,format,fileName
    };
  }

  function searchableText(entry){
    return normalize([
      entry.titleAr,entry.titleEn,entry.subtitleAr,entry.subtitleEn,entry.keywords,
      entry.brand,entry.model,entry.boardNo,entry.revision,entry.format,entry.fileName
    ].filter(Boolean).join(' '));
  }

  function scoreEntry(entry,q,tokens){
    const title=normalize(`${entry.titleAr||''} ${entry.titleEn||''}`);
    const model=normalize(entry.model||'');
    const boardNo=normalize(entry.boardNo||'');
    const fileName=normalize(entry.fileName||'');
    const text=entry._searchText;
    const qCompact=compact(q);
    const titleCompact=compact(title);
    const modelCompact=compact(model);
    const boardNoCompact=compact(boardNo);
    const fileNameCompact=compact(fileName);
    const textCompact=compact(text);
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

  async function buildIndex(){
    const staticIndex=staticEntries.map(e=>({...e,_searchText:searchableText(e)}));
    let boards=[];
    try{
      const response=await fetch(BOARD_DATA,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      if(Array.isArray(data))boards=data;
    }catch(err){
      console.warn('PCBR site search: BoardView database unavailable.',err);
    }
    const boardIndex=boards.map(boardEntry).map(e=>({...e,_searchText:searchableText(e)}));
    return [...boardIndex,...staticIndex];
  }

  function getIndex(){
    if(!indexPromise)indexPromise=buildIndex();
    return indexPromise;
  }

  async function search(query,{limit=50,type='all'}={}){
    const q=normalize(query);
    if(!q)return [];
    const tokens=q.split(' ').filter(Boolean);
    const index=await getIndex();
    return index
      .filter(entry=>type==='all'||entry.type===type)
      .map(entry=>({entry,score:scoreEntry(entry,q,tokens)}))
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
