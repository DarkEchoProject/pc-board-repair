(()=>{
  'use strict';

  const FLEXBV_URL='/downloads/flexbv-free-5.3162-win64.zip';
  const OPENBOARDVIEW_URL='/downloads/openboardview-10.0.0-win32.zip';
  const ALLEGRO_URL='https://www.cadence.com/en_US/home/tools/pcb-design-and-analysis/allegro-downloads-start.html';

  const lang=()=>{
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  };

  function addStyles(){
    if(document.getElementById('pcbrReaderGridStyles'))return;
    const style=document.createElement('style');
    style.id='pcbrReaderGridStyles';
    style.textContent=`
      .pcbrReaderGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:0 0 24px}
      .pcbrReaderCard{display:flex;flex-direction:column;justify-content:space-between;gap:12px;min-width:0;background:linear-gradient(145deg,#12385c,#0c223a);border:1px solid #20bdf2;border-radius:16px;padding:17px 18px}
      .pcbrReaderCard h2{font-size:20px;margin:0 0 7px;line-height:1.3}
      .pcbrReaderCard p{margin:0 0 7px}
      .pcbrReaderMeta{font-size:12px;color:#9fc1dd;line-height:1.65}
      .pcbrReaderCard .btn{align-self:flex-start;padding:10px 14px;font-size:14px}
      .pcbrReaderIcon{font-size:26px;line-height:1;margin-bottom:8px}
      @media(max-width:900px){.pcbrReaderGrid{grid-template-columns:1fr 1fr}}
      @media(max-width:640px){.pcbrReaderGrid{grid-template-columns:1fr}.pcbrReaderCard .btn{width:100%;text-align:center}}
    `;
    document.head.append(style);
  }

  function card({id,icon,title,description,meta,url,label,download=false}){
    const el=document.createElement('div');
    el.id=id;
    el.className='pcbrReaderCard';
    el.innerHTML=`
      <div>
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

    const flex=card({
      id:'pcbrFlexBV',
      icon:'🧭',
      title:'FlexBV',
      description:l==='en'?'Primary BoardView reader for many common repair files.':'القارئ الأساسي لعدد كبير من ملفات BoardView الشائعة.',
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
      description:l==='en'?'Official Cadence viewer for Allegro PCB board files.':'العارض الرسمي من Cadence لملفات لوحات Allegro.',
      meta:'.BRD • .DPF • .MDD • .DRA • Windows',
      url:ALLEGRO_URL,
      label:l==='en'?'Download from Cadence':'تحميل من Cadence',
      download:false
    });

    grid.append(flex,open,allegro);
    oldFlex.replaceWith(grid);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupReaders,{once:true});
  else setupReaders();
})();
