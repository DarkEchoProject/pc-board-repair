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
      {href:'/',ar:'الرئيسية',en:'Home',active:path=>path==='/'||path==='/index.html'},
      {href:'/boardview/index.html',ar:'BoardView',en:'BoardView',active:path=>path.startsWith('/boardview/')},
      {href:'/bios/index.html',ar:'BIOS',en:'BIOS',active:path=>path.startsWith('/bios/')},
      {href:'/diagnostics/index.html',ar:'التشخيص',en:'Diagnostics',active:path=>path.startsWith('/diagnostics/')},
      {href:'/component-testing/index.html',ar:'فحص القطع',en:'Component Testing',active:path=>path.startsWith('/component-testing/')},
      {href:'/community.html',ar:'غرفة الصيانة',en:'Repair Room',active:path=>path==='/community.html'},
      {href:'/search.html',ar:'🔎 البحث',en:'🔎 Search',active:path=>path==='/search.html'}
    ];

    const path=location.pathname;
    nav.replaceChildren(...items.map(item=>{
      const a=document.createElement('a');
      a.href=item.href;
      a.textContent=item[lang];
      if(item.active(path))a.setAttribute('aria-current','page');
      return a;
    }));
  }

  async function loadAuth(){
    try{
      const r=await fetch('/api/auth/me',{cache:'no-store'});
      if(r.ok){const data=await r.json();currentUser=data.user||null;}
    }catch{}
    authLoaded=true;
    renderHeader();
    setupCommunity();
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