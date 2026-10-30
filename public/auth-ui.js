(()=>{
  let currentUser=null;
  let authLoaded=false;

  if(!document.querySelector('script[data-pcbr-i18n]')){
    const i18n=document.createElement('script');
    i18n.src='/i18n.js?v=20261013-2';
    i18n.dataset.pcbrI18n='1';
    document.head.append(i18n);
  }
  if(!document.querySelector('script[data-pcbr-i18n-title]')){
    const titleFix=document.createElement('script');
    titleFix.src='/i18n-title-fix.js';
    titleFix.dataset.pcbrI18nTitle='1';
    document.head.append(titleFix);
  }
  if(!document.querySelector('script[data-pcbr-site-search-boot]')){
    const searchBoot=document.createElement('script');
    searchBoot.src='/site-search-boot.js?v=20261013-1';
    searchBoot.dataset.pcbrSiteSearchBoot='1';
    document.head.append(searchBoot);
  }

  const nextPath=()=>location.pathname+location.search+location.hash;
  const loginHref=(next=nextPath())=>`/login.html?next=${encodeURIComponent(next)}`;

  function currentLang(){
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  }

  function closeAllMoreMenusV5(except=null){
    document.querySelectorAll('header .pcbrMoreWrap.isOpen').forEach(wrap=>{
      if(except&&wrap===except)return;
      const panel=wrap.querySelector('.pcbrMorePanel');
      const btn=wrap.querySelector('.pcbrMoreButton');
      if(panel)panel.hidden=true;
      if(btn)btn.setAttribute('aria-expanded','false');
      wrap.classList.remove('isOpen');
    });
  }

  function ensureMoreMenuHandlersV5(){
    if(document.documentElement.dataset.pcbrMoreDelegated==='5')return;
    document.documentElement.dataset.pcbrMoreDelegated='5';

    document.addEventListener('click',e=>{
      const btn=e.target.closest?.('.pcbrMoreButton');

      if(btn){
        e.preventDefault();
        e.stopPropagation();

        const wrap=btn.closest('.pcbrMoreWrap');
        const panel=wrap?.querySelector('.pcbrMorePanel');
        if(!wrap||!panel)return;

        const openNow=panel.hidden;
        closeAllMoreMenusV5(wrap);

        panel.hidden=!openNow;
        wrap.classList.toggle('isOpen',openNow);
        btn.setAttribute('aria-expanded',String(openNow));
        return;
      }

      if(!e.target.closest?.('.pcbrMoreWrap')){
        closeAllMoreMenusV5();
      }
    },true);

    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape')return;
      const btn=document.querySelector('header .pcbrMoreWrap.isOpen .pcbrMoreButton');
      closeAllMoreMenusV5();
      btn?.focus();
    });
  }

  ensureMoreMenuHandlersV5();
  function standardizeHeaderNav(){
    const header=document.querySelector('header');
    if(!header)return;

    let nav=header.querySelector('nav');
    if(!nav){
      nav=document.createElement('nav');
      const account=header.querySelector('.accountBox');
      if(account)header.insertBefore(nav,account);else header.append(nav);
    }

    nav.classList.add('pcbrCompactNav');

    const lang=currentLang();
    const path=location.pathname;

    const primary=[
      {href:'/',ar:'الرئيسية',en:'Home',active:p=>p==='/'||p==='/index.html',home:true},
      {href:'/boardview/index.html',ar:'BoardView',en:'BoardView',active:p=>p.startsWith('/boardview/')},
      {href:'/bios/index.html',ar:'BIOS',en:'BIOS',active:p=>p.startsWith('/bios/')},
      {href:'/diagnostics/index.html',ar:'التشخيص',en:'Diagnostics',active:p=>p.startsWith('/diagnostics/')},
      {href:'/component-testing/index.html',ar:'فحص القطع',en:'Testing',active:p=>p.startsWith('/component-testing/')}
    ];

    const secondary=[
      {href:'/community.html',ar:'غرفة الصيانة',en:'Repair Room',active:p=>p==='/community.html'},
      {href:'/contact.html',ar:'اتصل بنا',en:'Contact',active:p=>p==='/contact.html'},
      {href:'/search.html',ar:'🔎 البحث',en:'🔎 Search',active:p=>p==='/search.html'},
      {href:'https://t.me/rdRepairLB',ar:'✈ Telegram',en:'✈ Telegram',active:()=>false,external:true,telegram:true},
      {href:'https://www.youtube.com/@PCBoardRepairArabic',ar:'▶ YouTube',en:'▶ YouTube',active:()=>false,external:true,youtube:true}
    ];

    function makeLink(item,extraClass=''){
      const a=document.createElement('a');
      a.href=item.href;
      a.textContent=item[lang];
      if(extraClass)a.className=extraClass;
      if(item.external){a.target='_blank';a.rel='noopener noreferrer';}
      if(item.telegram)a.classList.add('pcbrTelegramLink');
      if(item.youtube){
        a.classList.add('pcbrYoutubeLink');
        a.dataset.pcbrYoutubeChannel='nav';
      }
      if(item.active(path))a.setAttribute('aria-current','page');
      return a;
    }

    const nodes=[];

    primary.forEach(item=>{
      nodes.push(makeLink(item,item.home?'pcbrPrimaryNavLink pcbrHomeNavLink':'pcbrPrimaryNavLink'));
    });

    const wrap=document.createElement('div');
    wrap.className='pcbrMoreWrap';

    const button=document.createElement('button');
    button.type='button';
    button.className='pcbrMoreButton';
    button.dataset.pcbrMenuVersion='5';
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-haspopup','true');
    button.innerHTML=`<span class="pcbrMoreDesktop">${lang==='en'?'More':'المزيد'} ▾</span><span class="pcbrMoreMobile">☰ ${lang==='en'?'Menu':'القائمة'}</span>`;

    const menu=document.createElement('div');
    menu.className='pcbrMorePanel';
    menu.hidden=true;

    const mobilePrimary=primary.filter(x=>!x.home);
    mobilePrimary.forEach(item=>{
      const a=makeLink(item,'pcbrMenuPrimaryMobile');
      a.addEventListener('click',()=>closeMenu());
      menu.append(a);
    });

    secondary.forEach(item=>{
      const a=makeLink(item);
      a.addEventListener('click',()=>closeMenu());
      menu.append(a);
    });

    function openMenu(){
      menu.hidden=false;
      wrap.classList.add('isOpen');
      button.setAttribute('aria-expanded','true');
    }

    function closeMenu(){
      menu.hidden=true;
      wrap.classList.remove('isOpen');
      button.setAttribute('aria-expanded','false');
    }
wrap.addEventListener('click',e=>e.stopPropagation());
    wrap.append(button,menu);
    nodes.push(wrap);

    nav.replaceChildren(...nodes);

    if(!document.documentElement.dataset.pcbrMoreOutsideClose){
      document.documentElement.dataset.pcbrMoreOutsideClose='1';
      document.addEventListener('click',()=>{
        document.querySelectorAll('header .pcbrMoreWrap.isOpen').forEach(el=>{
          const panel=el.querySelector('.pcbrMorePanel');
          const btn=el.querySelector('.pcbrMoreButton');
          if(panel)panel.hidden=true;
          if(btn)btn.setAttribute('aria-expanded','false');
          el.classList.remove('isOpen');
        });
      });

      document.addEventListener('keydown',e=>{
        if(e.key!=='Escape')return;
        document.querySelectorAll('header .pcbrMoreWrap.isOpen').forEach(el=>{
          const panel=el.querySelector('.pcbrMorePanel');
          const btn=el.querySelector('.pcbrMoreButton');
          if(panel)panel.hidden=true;
          if(btn){btn.setAttribute('aria-expanded','false');btn.focus();}
          el.classList.remove('isOpen');
        });
      });
    }
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

    let board=null;
    try{
      const r=await fetch('/data/boards.json',{cache:'no-store'});
      const boards=normalizeBoards(await r.json());
      board=boards.find(item=>fileKey(item.file)===match[1].toLowerCase())||null;
    }catch{}
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