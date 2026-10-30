(()=>{
  'use strict';

  const TRACE_URL='https://github.com/DarkEchoProject/pc-board-repair/releases/download/boardview-tools/TRACE-Boardviewer-1.3.3.exe';
  const FLEXBV_URL='/downloads/flexbv-free-5.3162-win64.zip';
  const OPENBOARDVIEW_URL='/downloads/openboardview-10.0.0-win32.zip';
  const ALLEGRO_URL='https://www.cadence.com/en_US/home/tools/pcb-design-and-analysis/allegro-downloads-start.html';

  const lang=()=>{
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  };

  function fileKey(value){
    const s=String(value??'');
    let h=2166136261;
    for(let i=0;i<s.length;i++){
      h^=s.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    return(h>>>0).toString(36);
  }

  function normalizeBoards(all){
    return(Array.isArray(all)?all:[])
      .flatMap(item=>Array.isArray(item?.value)?item.value:[item])
      .filter(item=>item&&typeof item.file==='string'&&item.file.trim());
  }

  function addStyles(){
    if(document.getElementById('pcbrReaderGridStyles'))return;
    const style=document.createElement('style');
    style.id='pcbrReaderGridStyles';
    style.textContent=`
      .pcbrReaderGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:0 0 24px}
      .pcbrReaderCard{display:flex;flex-direction:column;justify-content:space-between;gap:12px;min-width:0;background:linear-gradient(145deg,#12385c,#0c223a);border:1px solid #20bdf2;border-radius:16px;padding:17px 18px}
      .pcbrReaderCard.pcbrReaderRecommended{border-width:2px;box-shadow:0 0 0 1px rgba(32,189,242,.15)}
      .pcbrReaderBadge{display:inline-block;margin:0 0 8px;padding:3px 8px;border-radius:999px;background:#20bdf2;color:#06111c;font-size:11px;font-weight:800}
      .pcbrReaderCard h2{font-size:20px;margin:0 0 7px;line-height:1.3}
      .pcbrReaderCard p{margin:0 0 7px}
      .pcbrReaderMeta{font-size:12px;color:#9fc1dd;line-height:1.65;word-break:break-word}
      .pcbrReaderCard .btn{align-self:flex-start;padding:10px 14px;font-size:14px}
      .pcbrReaderIcon{font-size:26px;line-height:1;margin-bottom:8px}
      .pcbrBoardToolHelp{margin:16px 0 0;padding:15px 16px;border:1px solid #20bdf2;border-radius:14px;background:linear-gradient(145deg,rgba(18,56,92,.92),rgba(12,34,58,.92))}
      .pcbrBoardToolHelp h3{margin:0 0 7px;font-size:18px}
      .pcbrBoardToolHelp p{margin:5px 0;line-height:1.65}
      .pcbrBoardToolHelp .pcbrToolFormat{font-size:12px;color:#9fc1dd}
      .pcbrBoardToolButtons{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:11px}
      .pcbrBoardToolButtons .btn{padding:9px 13px;font-size:13px}
      .pcbrBoardToolAlt{font-size:13px;color:#9fdfff;text-decoration:none}
      .pcbrBoardToolAlt:hover{text-decoration:underline}
      @media(max-width:1100px){.pcbrReaderGrid{grid-template-columns:1fr 1fr}}
      @media(max-width:640px){.pcbrReaderGrid{grid-template-columns:1fr}.pcbrReaderCard .btn{width:100%;text-align:center}.pcbrBoardToolButtons{align-items:stretch;flex-direction:column}.pcbrBoardToolButtons .btn,.pcbrBoardToolAlt{width:100%;text-align:center;box-sizing:border-box}}
    `;
    document.head.append(style);
  }

  function card({id,icon,title,description,meta,url,label,download=false,recommended=false,badge=''}){
    const el=document.createElement('div');
    el.id=id;
    el.className=`pcbrReaderCard${recommended?' pcbrReaderRecommended':''}`;
    el.innerHTML=`
      <div>
        ${badge?`<span class="pcbrReaderBadge">${badge}</span>`:''}
        <div class="pcbrReaderIcon" aria-hidden="true">${icon}</div>
        <h2>${title}</h2>
        <p class="muted">${description}</p>
        <p class="pcbrReaderMeta">${meta}</p>
      </div>
      <a class="btn" href="${url}" ${download?'download':'target="_blank" rel="noopener noreferrer"'}>${label}</a>`;
    return el;
  }

  function setupReaders(){
    if(!/^\/(?:index\.html)?$/.test(location.pathname))return;
    if(document.getElementById('pcbrReaderGrid'))return;

    const oldFlex=document.querySelector('main.wrap .downloadBox');
    if(!oldFlex)return;
    addStyles();

    const l=lang();
    const grid=document.createElement('section');
    grid.id='pcbrReaderGrid';
    grid.className='pcbrReaderGrid';
    grid.setAttribute('aria-label',l==='en'?'BoardView reader downloads':'برامج فتح ملفات BoardView');

    const trace=card({
      id:'pcbrTraceBoardviewer',
      icon:'🧩',
      title:'TRACE Boardviewer',
      description:l==='en'?'Recommended for older BoardView files, especially legacy Allegro BRD files.':'الخيار الموصى به للخرائط القديمة، وخصوصًا ملفات Allegro BRD القديمة.',
      meta:l==='en'?'Portable Windows x64 • Legacy Allegro BRD support • SHA256 verified':'Windows x64 محمول • يدعم Allegro BRD القديمة • تم التحقق من SHA256',
      url:TRACE_URL,
      label:l==='en'?'Download TRACE':'تحميل TRACE',
      download:false,
      recommended:true,
      badge:l==='en'?'Recommended for old BRD':'موصى به للـ BRD القديمة'
    });

    const flex=card({
      id:'pcbrFlexBV',
      icon:'🧭',
      title:'FlexBV',
      description:l==='en'?'Primary BoardView reader for many common repair files.':'قارئ مناسب لعدد كبير من ملفات BoardView الشائعة.',
      meta:'FlexBV Free 5.3162 • Windows 64-bit',
      url:FLEXBV_URL,
      label:l==='en'?'Download FlexBV':'تحميل FlexBV',
      download:true
    });

    const open=card({
      id:'pcbrOpenBoardView',
      icon:'🗺️',
      title:'OpenBoardView',
      description:l==='en'?'Free open-source reader useful for additional BoardView formats.':'قارئ مجاني ومفتوح المصدر ومفيد لصيغ BoardView إضافية.',
      meta:'BRD (Landrex/TestLink/TopTest) • FZ • BDV • BVR • CAE • ASC',
      url:OPENBOARDVIEW_URL,
      label:l==='en'?'Download OpenBoardView':'تحميل OpenBoardView',
      download:true
    });

    const allegro=card({
      id:'pcbrAllegroViewer',
      icon:'📐',
      title:'Allegro X Free Viewer',
      description:l==='en'?'Official Cadence viewer for newer Allegro PCB files. Older 16.x BRD files may require conversion.':'العارض الرسمي من Cadence لملفات Allegro الحديثة. ملفات BRD القديمة 16.x قد تحتاج تحويلًا.',
      meta:'.BRD • .DPF • .MDD • .DRA • Windows',
      url:ALLEGRO_URL,
      label:l==='en'?'Download from Cadence':'تحميل من Cadence',
      download:false
    });

    grid.append(trace,flex,open,allegro);
    oldFlex.replaceWith(grid);
  }

  function hasFormatToken(text,token){
    return new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`,'i').test(text);
  }

  function detectBoardFormat(board){
    const text=`${board?.file||''} ${board?.type||''}`.toLowerCase();
    if(text.includes('allegro')||hasFormatToken(text,'brd'))return 'BRD';
    if(hasFormatToken(text,'fz'))return 'FZ';
    if(hasFormatToken(text,'bdv'))return 'BDV';
    if(hasFormatToken(text,'bvr'))return 'BVR';
    if(hasFormatToken(text,'cae'))return 'CAE';
    if(hasFormatToken(text,'asc'))return 'ASC';
    if(hasFormatToken(text,'brd2'))return 'BRD2';
    if(hasFormatToken(text,'tvw'))return 'TVW';
    return String(board?.type||'BoardView').trim()||'BoardView';
  }

  function recommendedTool(board,l){
    const format=detectBoardFormat(board);
    const upper=format.toUpperCase();

    if(upper==='BRD'){
      return {
        format,
        name:'TRACE Boardviewer',
        url:TRACE_URL,
        external:true,
        description:l==='en'
          ?'Recommended first for old BRD files, including legacy Allegro boards such as 16.x files.'
          :'الخيار الأول الموصى به لملفات BRD القديمة، ومنها خرائط Allegro القديمة مثل ملفات 16.x.',
        altName:'OpenBoardView',
        altUrl:OPENBOARDVIEW_URL
      };
    }

    if(upper==='FZ'){
      return {
        format,
        name:'FlexBV',
        url:FLEXBV_URL,
        external:false,
        description:l==='en'?'Start with FlexBV for this FZ BoardView file.':'ابدأ بـ FlexBV لفتح ملف BoardView بصيغة FZ.',
        altName:'OpenBoardView',
        altUrl:OPENBOARDVIEW_URL
      };
    }

    if(['BDV','BVR','CAE','ASC'].includes(upper)){
      return {
        format,
        name:'OpenBoardView',
        url:OPENBOARDVIEW_URL,
        external:false,
        description:l==='en'?`OpenBoardView is the recommended first choice for ${upper} files.`:`OpenBoardView هو الخيار الأول الموصى به لملفات ${upper}.`,
        altName:'TRACE Boardviewer',
        altUrl:TRACE_URL,
        altExternal:true
      };
    }

    return {
      format,
      name:'TRACE Boardviewer',
      url:TRACE_URL,
      external:true,
      description:l==='en'?'If you are unsure which reader to use, start with TRACE Boardviewer and try the alternatives if needed.':'إذا لم تكن الصيغة واضحة، ابدأ بـ TRACE Boardviewer ثم جرّب البدائل عند الحاجة.',
      altName:'OpenBoardView',
      altUrl:OPENBOARDVIEW_URL
    };
  }

  async function setupBoardRecommendation(){
    const match=location.pathname.match(/^\/boardview\/item\/([a-z0-9]+)/i);
    if(!match||document.getElementById('pcbrBoardToolHelp'))return;

    const actions=document.querySelector('.boardActions');
    if(!actions)return;

    let board=null;
    try{
      const payloads=await Promise.all(
        ['/data/boards.json','/data/boards-large.json'].map(async url=>{
          const r=await fetch(url,{cache:'no-store'});
          if(!r.ok)return [];
          return r.json();
        })
      );
      const boards=normalizeBoards(payloads.flat());
      board=boards.find(item=>fileKey(item.file)===match[1].toLowerCase())||null;
    }catch{return;}
    if(!board)return;

    addStyles();
    const l=lang();
    const tool=recommendedTool(board,l);
    const archive=/\.(?:zip|rar|7z)$/i.test(String(board.file||''));

    const box=document.createElement('section');
    box.id='pcbrBoardToolHelp';
    box.className='pcbrBoardToolHelp';

    const title=document.createElement('h3');
    title.textContent=l==='en'?'🛠️ How to open this BoardView file':'🛠️ كيف تفتح ملف BoardView هذا؟';

    const desc=document.createElement('p');
    desc.textContent=tool.description;

    const format=document.createElement('p');
    format.className='pcbrToolFormat';
    format.textContent=(l==='en'?'Detected format: ':'الصيغة المكتشفة: ')+tool.format+(archive?(l==='en'?' • Compressed archive':' • ملف مضغوط'):'');

    box.append(title,desc,format);

    if(archive){
      const note=document.createElement('p');
      note.className='pcbrToolFormat';
      note.textContent=l==='en'?'Extract the ZIP/RAR/7Z archive first, then open the BoardView file inside it.':'فك ضغط ملف ZIP/RAR/7Z أولًا، ثم افتح ملف BoardView الموجود بداخله.';
      box.append(note);
    }

    const buttons=document.createElement('div');
    buttons.className='pcbrBoardToolButtons';

    const primary=document.createElement('a');
    primary.className='btn';
    primary.href=tool.url;
    primary.textContent=(l==='en'?'Download ':'تحميل ')+tool.name;
    if(tool.external){primary.target='_blank';primary.rel='noopener noreferrer';}
    else primary.setAttribute('download','');

    const alt=document.createElement('a');
    alt.className='pcbrBoardToolAlt';
    alt.href=tool.altUrl;
    alt.textContent=(l==='en'?'Alternative: ':'بديل: ')+tool.altName;
    if(tool.altExternal){alt.target='_blank';alt.rel='noopener noreferrer';}
    else alt.setAttribute('download','');

    buttons.append(primary,alt);
    box.append(buttons);
    actions.after(box);
  }

  function setup(){
    setupReaders();
    setupBoardRecommendation();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
