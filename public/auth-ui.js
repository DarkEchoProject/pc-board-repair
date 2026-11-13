(()=>{
  let currentUser=null;
  let authLoaded=false;

  if(!document.querySelector('script[data-pcbr-i18n]')){
    const i18n=document.createElement('script');
    i18n.src='/i18n.js?v=20261013-2';
    i18n.dataset.pcbrI18n='1';
    document.head.append(i18n);
  }
  const needsTitleFix=
    location.pathname==='/diagnostics/post-beep-codes.html'||
    location.pathname==='/diagnostics/vrm-cpu-ram.html';

  if(needsTitleFix&&!document.querySelector('script[data-pcbr-i18n-title]')){
    const titleFix=document.createElement('script');
    titleFix.src='/i18n-title-fix.js';
    titleFix.dataset.pcbrI18nTitle='1';
    document.head.append(titleFix);
  }
  const isHomepage=location.pathname==='/'||location.pathname==='/index.html';

  if(isHomepage&&!document.querySelector('script[data-pcbr-site-search-boot]')){
    const searchBoot=document.createElement('script');
    searchBoot.src='/site-search-boot.js?v=20261013-1';
    searchBoot.dataset.pcbrSiteSearchBoot='1';
    document.head.append(searchBoot);
  }

  const nextPath=()=>location.pathname+location.search+location.hash;
  const loginHref=(next=nextPath())=>`/login?next=${encodeURIComponent(next)}`;

  function currentLang(){
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  }

  let pcbrSharePanel=null;
  let pcbrQrOverlay=null;
  let pcbrQrLoader=null;

  function ensureShareStyles(){
    if(document.getElementById('pcbrShareStyles'))return;

    const style=document.createElement('style');
    style.id='pcbrShareStyles';
    style.textContent=`
      .pcbrSharePanel{
        position:fixed;
        z-index:10020;
        min-width:230px;
        padding:9px;
        border-radius:14px;
        background:#0b1729;
        border:1px solid #315b7f;
        box-shadow:0 18px 50px #0009;
      }

      .pcbrSharePanel a,
      .pcbrSharePanel button{
        width:100%;
        display:flex;
        align-items:center;
        gap:10px;
        padding:11px 13px;
        margin:2px 0;
        border:0;
        border-radius:9px;
        background:transparent;
        color:#eef5ff;
        text-decoration:none;
        font:inherit;
        cursor:pointer;
        text-align:start;
      }

      .pcbrSharePanel a:hover,
      .pcbrSharePanel button:hover{
        background:#142b46;
      }

      .pcbrShareWhatsApp{color:#64e68a!important}
      .pcbrShareFacebook{color:#74a7ff!important}
      .pcbrShareTelegram{color:#62cdf5!important}

      .pcbrQrOverlay{
        position:fixed;
        inset:0;
        z-index:10030;
        background:#000b;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
      }

      .pcbrQrDialog{
        width:min(92vw,380px);
        background:#0b1729;
        border:1px solid #315b7f;
        border-radius:18px;
        padding:20px;
        box-shadow:0 24px 80px #000c;
        text-align:center;
      }

      .pcbrQrTop{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:15px;
      }

      .pcbrQrTop strong{
        font-size:18px;
      }

      .pcbrQrClose{
        border:0;
        background:#162b44;
        color:#fff;
        width:36px;
        height:36px;
        border-radius:50%;
        cursor:pointer;
        font-size:20px;
      }

      .pcbrQrCode{
        display:inline-block;
        background:#fff;
        padding:14px;
        border-radius:12px;
        margin:8px auto 14px;
      }

      .pcbrQrCode canvas{
        display:block!important;
        margin:auto!important;
      }

      .pcbrQrCode img{
        display:none!important;
      }

      .pcbrQrUrl{
        font-size:12px;
        color:#9fb6d1;
        overflow-wrap:anywhere;
        margin:8px 0 14px;
      }

      .pcbrQrCopy{
        border:1px solid #315b7f;
        background:#102840;
        color:#fff;
        border-radius:10px;
        padding:10px 15px;
        cursor:pointer;
        font:inherit;
      }
    `;
    document.head.append(style);
  }

  function closeSharePanel(){
    if(pcbrSharePanel){
      pcbrSharePanel.remove();
      pcbrSharePanel=null;
    }
  }

  function openShareMenu(anchor,lang){
    ensureShareStyles();

    if(pcbrSharePanel){
      closeSharePanel();
      return;
    }

    const url=location.href;
    const title=document.title||'PC Board Repair';

    const panel=document.createElement('div');
    panel.className='pcbrSharePanel';

    const addLink=(label,href,className)=>{
      const a=document.createElement('a');
      a.textContent=label;
      a.href=href;
      a.target='_blank';
      a.rel='noopener noreferrer';
      if(className)a.className=className;
      panel.append(a);
    };

    addLink(
      '🟢 WhatsApp',
      `https://wa.me/?text=${encodeURIComponent(title+'\n'+url)}`,
      'pcbrShareWhatsApp'
    );

    addLink(
      '🔵 Facebook',
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      'pcbrShareFacebook'
    );

    addLink(
      '✈ Telegram',
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      'pcbrShareTelegram'
    );

    const qrShare=document.createElement('button');
    qrShare.type='button';
    qrShare.id='pcbrShareQrButton';
    qrShare.textContent=lang==='en'?'▦ QR code':'▦ باركود';

    qrShare.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();

      closeSharePanel();

      setTimeout(()=>{
        openQrModal(lang);
      },0);
    });

    panel.append(qrShare);

    const copy=document.createElement('button');
    copy.type='button';
    copy.textContent=lang==='en'?'🔗 Copy link':'🔗 نسخ الرابط';

    copy.addEventListener('click',async()=>{
      try{
        await navigator.clipboard.writeText(url);
        copy.textContent=lang==='en'?'✓ Copied':'✓ تم نسخ الرابط';
        setTimeout(()=>{
          copy.textContent=lang==='en'?'🔗 Copy link':'🔗 نسخ الرابط';
        },1500);
      }catch{}
    });

    panel.append(copy);

    panel.addEventListener('click',e=>e.stopPropagation());
    document.body.append(panel);
    pcbrSharePanel=panel;

    const rect=anchor.getBoundingClientRect();
    const width=230;

    let left=rect.right-width;
    if(left<10)left=10;
    if(left+width>window.innerWidth-10)
      left=window.innerWidth-width-10;

    panel.style.left=left+'px';
    panel.style.top=(rect.bottom+8)+'px';

    setTimeout(()=>{
      document.addEventListener('click',closeSharePanel,{once:true});
    },0);
  }

  function loadQrLibrary(){
    if(window.QRCode)return Promise.resolve(window.QRCode);
    if(pcbrQrLoader)return pcbrQrLoader;

    pcbrQrLoader=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='/qrcode.min.js?v=1';
      script.onload=()=>window.QRCode?resolve(window.QRCode):reject(new Error('QRCode unavailable'));
      script.onerror=reject;
      document.head.append(script);
    });

    return pcbrQrLoader;
  }

  async function openQrModal(lang){
    ensureShareStyles();
    closeSharePanel();

    if(pcbrQrOverlay){
      pcbrQrOverlay.remove();
      pcbrQrOverlay=null;
    }

    const overlay=document.createElement('div');
    overlay.className='pcbrQrOverlay';

    const dialog=document.createElement('div');
    dialog.className='pcbrQrDialog';

    const top=document.createElement('div');
    top.className='pcbrQrTop';

    const title=document.createElement('strong');
    title.textContent=lang==='en'
      ? 'QR code for this page'
      : 'باركود هذه الصفحة';

    const close=document.createElement('button');
    close.type='button';
    close.className='pcbrQrClose';
    close.textContent='×';

    const qr=document.createElement('div');
    qr.className='pcbrQrCode';

    const urlText=document.createElement('div');
    urlText.className='pcbrQrUrl';
    urlText.textContent=location.href;


    const copy=document.createElement('button');
    copy.type='button';
    copy.className='pcbrQrCopy';
    copy.textContent=lang==='en'?'Copy link':'نسخ الرابط';

    top.append(title,close);
    dialog.append(top,qr,urlText,copy);
    overlay.append(dialog);
    document.body.append(overlay);

    pcbrQrOverlay=overlay;

    const closeModal=()=>{
      overlay.remove();
      if(pcbrQrOverlay===overlay)pcbrQrOverlay=null;
    };

    close.addEventListener('click',closeModal);

    overlay.addEventListener('click',e=>{
      if(e.target===overlay)closeModal();
    });

    copy.addEventListener('click',async()=>{
      try{
        await navigator.clipboard.writeText(location.href);
        copy.textContent=lang==='en'?'✓ Copied':'✓ تم النسخ';
      }catch{}
    });

    try{
      await loadQrLibrary();

      new window.QRCode(qr,{
        text:location.href,
        width:220,
        height:220,
        colorDark:'#06111f',
        colorLight:'#ffffff',
        correctLevel:window.QRCode.CorrectLevel.M
      });
    }catch{
      qr.textContent=lang==='en'
        ? 'Could not create QR code'
        : 'تعذر إنشاء الباركود';
    }
  }
  let pcbrMoreMenuPanel=null;
  let pcbrMoreMenuAnchor=null;
  let pcbrMoreMenuCleanup=null;

  function ensurePcbrMoreMenuStyles(){
    if(document.getElementById('pcbrMoreMenuStyles'))return;

    const style=document.createElement('style');
    style.id='pcbrMoreMenuStyles';
    style.textContent=`
      .pcbrMoreMenuPanel{
        position:fixed;
        z-index:10040;
        min-width:210px;
        padding:8px;
        border:1px solid #315b7f;
        border-radius:13px;
        background:#0b1729;
        box-shadow:0 18px 50px rgba(0,0,0,.6);
      }

      .pcbrMoreMenuPanel a{
        display:block;
        padding:11px 13px;
        margin:2px 0;
        border-radius:8px;
        color:#eef5ff;
        text-decoration:none;
        white-space:nowrap;
      }

      .pcbrMoreMenuPanel a:hover,
      .pcbrMoreMenuPanel a:focus{
        background:#142b46;
        outline:none;
      }
    `;

    document.head.append(style);
  }

  function closePcbrMoreMenu(){
    if(pcbrMoreMenuCleanup){
      const cleanup=pcbrMoreMenuCleanup;
      pcbrMoreMenuCleanup=null;
      cleanup();
    }

    if(pcbrMoreMenuPanel){
      pcbrMoreMenuPanel.remove();
      pcbrMoreMenuPanel=null;
    }

    if(pcbrMoreMenuAnchor){
      pcbrMoreMenuAnchor.setAttribute('aria-expanded','false');
      pcbrMoreMenuAnchor=null;
    }
  }

  function openPcbrMoreMenu(anchor,lang){
    if(pcbrMoreMenuPanel && pcbrMoreMenuAnchor===anchor){
      closePcbrMoreMenu();
      return;
    }

    closePcbrMoreMenu();
    ensurePcbrMoreMenuStyles();

    const panel=document.createElement('div');
    panel.className='pcbrMoreMenuPanel';
    panel.setAttribute('role','menu');

    const items=[
      {
        href:'/diagnostics/',
        ar:'🔧 التشخيص',
        en:'🔧 Diagnostics'
      },
      {
        href:'/component-testing/',
        ar:'🔬 فحص القطع',
        en:'🔬 Component Testing'
      },
      {
        href:'/contact',
        ar:'✉ اتصل بنا',
        en:'✉ Contact'
      }
    ];

    for(const item of items){
      const link=document.createElement('a');
      link.href=item.href;
      link.textContent=item[lang];
      link.setAttribute('role','menuitem');
      panel.append(link);
    }

    document.body.append(panel);

    pcbrMoreMenuPanel=panel;
    pcbrMoreMenuAnchor=anchor;
    anchor.setAttribute('aria-expanded','true');

    const rect=anchor.getBoundingClientRect();
    const width=panel.offsetWidth;

    let left=rect.right-width;

    if(left<8)left=8;
    if(left+width>window.innerWidth-8){
      left=window.innerWidth-width-8;
    }

    panel.style.left=left+'px';
    panel.style.top=(rect.bottom+7)+'px';

    const outside=e=>{
      if(
        pcbrMoreMenuPanel &&
        !pcbrMoreMenuPanel.contains(e.target) &&
        e.target!==pcbrMoreMenuAnchor
      ){
        closePcbrMoreMenu();
      }
    };

    const escape=e=>{
      if(e.key==='Escape'){
        const oldAnchor=pcbrMoreMenuAnchor;
        closePcbrMoreMenu();
        if(oldAnchor)oldAnchor.focus();
      }
    };

    const repositionClose=()=>closePcbrMoreMenu();

    document.addEventListener('pointerdown',outside,true);
    document.addEventListener('keydown',escape);
    window.addEventListener('resize',repositionClose);

    pcbrMoreMenuCleanup=()=>{
      document.removeEventListener('pointerdown',outside,true);
      document.removeEventListener('keydown',escape);
      window.removeEventListener('resize',repositionClose);
    };
  }
  function standardizeHeaderNav(){
    const header=document.querySelector('header');
    if(!header)return;
    let nav=header.querySelector('nav');
    if(!nav){
      nav=document.createElement('nav');
      const account=header.querySelector('.accountBox');
      if(account)header.insertBefore(nav,account);else header.append(nav);
    }

    const lang=currentLang();
    const items=[
      {href:'/boardview/',ar:'BoardView',en:'BoardView',active:path=>path.startsWith('/boardview/')},
      {href:'/bios/',ar:'BIOS',en:'BIOS',active:path=>path.startsWith('/bios/')},
      {href:'#',ar:'المزيد ▾',en:'More ▾',active:()=>false,moreMenu:true},
      {href:'/community',ar:'غرفة الصيانة',en:'Repair Room',active:path=>path==='/community'||path==='/community.html'},
      {href:'#',ar:'↗ مشاركة',en:'↗ Share',active:()=>false,shareMenu:true},
      {href:'https://t.me/rdRepairLB',ar:'✈ انضم لتلغرام',en:'✈ Join Telegram',active:()=>false,external:true,telegram:true},
      {href:'https://www.youtube.com/@PCBoardRepairArabic',ar:'▶ YouTube',en:'▶ YouTube',active:()=>false,external:true,youtube:true}
    ];

    const path=location.pathname;
    nav.replaceChildren(...items.map(item=>{
      const a=document.createElement('a');
      a.href=item.href;
      a.textContent=item[lang];
      if(item.external){a.target='_blank';a.rel='noopener noreferrer';}
      if(item.moreMenu){
        a.setAttribute('aria-haspopup','menu');
        a.setAttribute('aria-expanded','false');

        a.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          openPcbrMoreMenu(a,lang);
        });
      }
      if(item.shareMenu){
        a.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          openShareMenu(a,lang);
        });
      }

      if(item.youtube){
        a.dataset.pcbrYoutubeChannel='nav';
        a.style.cssText='color:#fff;background:#ff0033;border:1px solid #ff0033;border-radius:10px;padding:6px 10px;text-decoration:none;font-weight:700;white-space:nowrap';
      }
      if(item.active(path))a.setAttribute('aria-current','page');
      return a;
    }));
  }

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
      .flatMap(x=>Array.isArray(x?.value)?x.value:[x])
      .filter(x=>x&&typeof x.file==='string'&&x.file.trim());
  }

  function getInjectedBoard(expectedKey){
    const node=document.getElementById('pcbr-board-data');
    if(!node)return null;
    try{
      const board=JSON.parse(node.textContent||'null');
      if(!board||typeof board.file!=='string')return null;
      return fileKey(board.file)===String(expectedKey||'').toLowerCase()?board:null;
    }catch{
      return null;
    }
  }
  function isTrue(value){
    return value===true||value===1||String(value??'').toLowerCase()==='true'||String(value??'')==='1';
  }

  function formatBytes(bytes,lang){
    let n=Number(bytes)||0;
    if(n<=0)return '';
    const units=['B','KB','MB','GB'];
    let i=0;
    while(n>=1024&&i<units.length-1){n/=1024;i++;}
    return `${n>=100||i===0?Math.round(n):n.toFixed(2)} ${units[i]}`;
  }

  function formatDate(value,lang){
    if(!value)return '';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return String(value);
    try{return new Intl.DateTimeFormat(lang==='en'?'en-GB':'ar-LB',{year:'numeric',month:'short',day:'numeric'}).format(d);}catch{return d.toISOString().slice(0,10);}
  }

  function fileFormat(board){
    const file=String(board?.file||'').trim();
    const archive=file.match(/\.(zip|rar|7z)$/i)?.[1]?.toUpperCase()||'';
    const withoutArchive=archive?file.replace(/\.(zip|rar|7z)$/i,''):file;
    const ext=withoutArchive.match(/\.([a-z0-9]{2,8})$/i)?.[1]?.toUpperCase()||'';
    const type=String(board?.type||'').trim();
    const core=ext||type||'BoardView';
    return archive?`${core} • ${archive}`:core;
  }

  function addMetaTile(grid,label,value,extraClass=''){
    const tile=document.createElement('div');
    tile.className='pcbrMetaTile';
    const lab=document.createElement('span');
    lab.className='pcbrMetaLabel';
    lab.textContent=label;
    const val=document.createElement('strong');
    val.className=`pcbrMetaValue${extraClass?` ${extraClass}`:''}`;
    val.textContent=value;
    tile.append(lab,val);
    grid.append(tile);
    return val;
  }

  async function getDownloadDisplay(key,lang){
    try{
      const r=await fetch('/api/stats/top?limit=20',{cache:'no-store'});
      if(!r.ok)throw new Error('stats');
      const data=await r.json();
      const items=Array.isArray(data.items)?data.items:[];
      const hit=items.find(item=>String(item.key||'').toLowerCase()===key.toLowerCase());
      if(hit)return Number(hit.count||0).toLocaleString(lang==='en'?'en-US':'ar-LB');
      if(items.length<20)return '0';
      return lang==='en'?'Outside top 20':'خارج أعلى 20';
    }catch{
      return lang==='en'?'Unavailable':'غير متوفر';
    }
  }

  async function setupBoardDetailMetadata(){
    const match=location.pathname.match(/^\/boardview\/item\/([a-z0-9]+)/i);
    if(!match)return;
    const list=document.querySelector('.detailList');
    if(!list||document.getElementById('pcbrFileMetaPanel'))return;

    const lang=currentLang();
    const t=lang==='en'?{
      heading:'File information',format:'File format',size:'File size',added:'Date added',downloads:'Downloads',sha:'SHA-256',status:'File status',
      unavailable:'Not available yet',loginForSize:'Available after sign-in',notCalculated:'Not calculated yet',
      cleaned:'Cleaned',verified:'Verified',unverified:'Unverified',copy:'Copy SHA-256',copied:'Copied'
    }:{
      heading:'معلومات الملف',format:'صيغة الملف',size:'حجم الملف',added:'تاريخ الإضافة',downloads:'عدد التحميلات',sha:'SHA-256',status:'حالة الملف',
      unavailable:'غير متوفر بعد',loginForSize:'يتوفر بعد تسجيل الدخول',notCalculated:'غير محسوب بعد',
      cleaned:'Cleaned',verified:'Verified',unverified:'غير موثّق',copy:'نسخ SHA-256',copied:'تم النسخ'
    };

    let board=getInjectedBoard(match[1]);

    if(!board){
      try{
        const payloads=await Promise.all(
          ['/data/boards.json','/data/boards-large.json'].map(async url=>{
            try{
              const r=await fetch(url,{cache:'no-store'});
              return r.ok?await r.json():[];
            }catch{
              return [];
            }
          })
        );

        const boards=normalizeBoards(payloads.flat());
        board=boards.find(item=>fileKey(item.file)===match[1].toLowerCase())||null;
      }catch{}
    }

    if(!board)return;

    let size=Number(board.size_bytes??board.sizeBytes??board.file_size??board.fileSize??0)||0;
    if(!size&&currentUser){
      try{
        const r=await fetch(`/downloads/${encodeURIComponent(board.file)}`,{method:'HEAD',cache:'no-store'});
        if(r.ok)size=Number(r.headers.get('content-length')||0)||0;
      }catch{}
    }

    const added=board.added_at??board.addedAt??board.date_added??board.dateAdded??'';
    const shaRaw=String(board.sha256??board.sha_256??board.checksum_sha256??'').trim();
    const sha=/^[a-f0-9]{64}$/i.test(shaRaw)?shaRaw.toLowerCase():'';
    const cleaned=isTrue(board.cleaned)||/^Imported automatically from cleaned archive/i.test(String(board.note||''));
    const verified=isTrue(board.verified)||String(board.status||'').toLowerCase()==='verified';
    const status=verified&&cleaned?`${t.cleaned} • ${t.verified}`:verified?t.verified:cleaned?`${t.cleaned} • ${t.unverified}`:t.unverified;
    const statusClass=verified?'pcbrStatusVerified':cleaned?'pcbrStatusCleaned':'pcbrStatusUnverified';

    const panel=document.createElement('section');
    panel.id='pcbrFileMetaPanel';
    panel.className='pcbrFileMetaPanel';
    const heading=document.createElement('h2');
    heading.textContent=t.heading;
    const grid=document.createElement('div');
    grid.className='pcbrFileMetaGrid';

    addMetaTile(grid,t.format,fileFormat(board),'pcbrFormatValue');
    addMetaTile(grid,t.size,size?formatBytes(size,lang):(currentUser?t.unavailable:t.loginForSize));
    addMetaTile(grid,t.added,added?formatDate(added,lang):t.unavailable);
    const downloadsValue=addMetaTile(grid,t.downloads,lang==='en'?'Loading…':'جاري التحميل…');
    addMetaTile(grid,t.status,status,statusClass);

    const shaTile=document.createElement('div');
    shaTile.className='pcbrMetaTile pcbrMetaTileWide';
    const shaLabel=document.createElement('span');
    shaLabel.className='pcbrMetaLabel';
    shaLabel.textContent=t.sha;
    const shaLine=document.createElement('div');
    shaLine.className='pcbrShaLine';
    const shaValue=document.createElement('code');
    shaValue.className='pcbrShaValue';
    shaValue.textContent=sha||t.notCalculated;
    shaLine.append(shaValue);
    if(sha){
      const copy=document.createElement('button');
      copy.type='button';
      copy.className='pcbrCopySha';
      copy.textContent=t.copy;
      copy.addEventListener('click',async()=>{
        try{
          await navigator.clipboard.writeText(sha);
          copy.textContent=t.copied;
          setTimeout(()=>{copy.textContent=t.copy;},1400);
        }catch{}
      });
      shaLine.append(copy);
    }
    shaTile.append(shaLabel,shaLine);
    grid.append(shaTile);

    panel.append(heading,grid);
    list.after(panel);
    downloadsValue.textContent=await getDownloadDisplay(match[1],lang);
  }

  async function loadAuth(){
    try{
      const r=await fetch('/api/auth/me',{cache:'no-store'});
      if(r.ok){const data=await r.json();currentUser=data.user||null;}
    }catch{}
    authLoaded=true;
    renderHeader();
    setupCommunity();
    setupBoardDetailMetadata();
    return currentUser;
  }

  function renderHeader(){
    standardizeHeaderNav();
    const header=document.querySelector('header');
    if(!header||header.querySelector('.accountBox'))return;
    const box=document.createElement('div');
    box.className='accountBox';
    if(!currentUser){
      const a=document.createElement('a');
      a.className='accountLogin';
      a.href=loginHref();
      a.textContent='تسجيل الدخول';
      box.append(a);
    }else{
      const chip=document.createElement('div');
      chip.className='accountChip';
      const avatar=document.createElement('span');
      avatar.className='accountAvatar';
      avatar.textContent=(currentUser.name||currentUser.email||'?').trim().charAt(0).toUpperCase();
      const name=document.createElement('span');
      name.className='accountName';
      name.textContent=currentUser.name||currentUser.email||'حسابي';
      chip.append(avatar,name);
      const out=document.createElement('button');
      out.className='accountLogout';
      out.type='button';
      out.textContent='خروج';
      out.addEventListener('click',logout);
      box.append(chip,out);
    }
    header.append(box);
  }

  async function logout(){
    try{await fetch('/api/auth/logout',{method:'POST'});}catch{}
    location.reload();
  }

  function setupCommunity(){
    const form=document.getElementById('chatForm');
    if(!form)return;
    const name=document.getElementById('name');
    if(currentUser){
      if(name){
        name.value=currentUser.name||currentUser.email?.split('@')[0]||'مستخدم';
        name.readOnly=true;
      }
      if(!form.querySelector('.authIdentity')){
        const p=document.createElement('div');
        p.className='authIdentity';
        p.textContent=`أنت تشارك بالحساب: ${currentUser.email||currentUser.name||''}`;
        form.prepend(p);
      }
      return;
    }

    [...form.querySelectorAll('input,textarea,select,button')].forEach(el=>el.disabled=true);
    if(!form.previousElementSibling?.classList?.contains('authGate')){
      const gate=document.createElement('div');
      gate.className='authGate';
      gate.innerHTML='<strong>المشاركة متاحة للمسجلين فقط.</strong> يمكنك قراءة الرسائل بدون حساب.';
      const a=document.createElement('a');
      a.className='btn';
      a.href=loginHref(location.pathname+location.search+location.hash);
      a.textContent='تسجيل الدخول للمشاركة';
      gate.append(a);
      form.before(gate);
    }
  }

  document.addEventListener('click',async e=>{
    const a=e.target.closest('a[href]');
    if(!a)return;
    let u;
    try{u=new URL(a.href,location.href);}catch{return;}
    if(u.origin!==location.origin)return;
    if(!(u.pathname.startsWith('/download/')||u.pathname.startsWith('/downloads/')))return;
    e.preventDefault();
    if(!authLoaded)await authPromise;
    if(!currentUser){
      location.href=loginHref(u.pathname+u.search);
      return;
    }
    location.href=u.href;
  },true);

  standardizeHeaderNav();
  const authPromise=loadAuth();
})();