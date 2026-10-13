(()=>{
  let currentUser=null;
  let authLoaded=false;

  if(!document.querySelector('script[data-pcbr-i18n]')){
    const i18n=document.createElement('script');
    i18n.src='/i18n-v2.js';
    i18n.dataset.pcbrI18n='1';
    document.head.append(i18n);
  }
  if(!document.querySelector('script[data-pcbr-i18n-title]')){
    const titleFix=document.createElement('script');
    titleFix.src='/i18n-title-fix.js';
    titleFix.dataset.pcbrI18nTitle='1';
    document.head.append(titleFix);
  }

  const nextPath=()=>location.pathname+location.search+location.hash;
  const loginHref=(next=nextPath())=>`/login.html?next=${encodeURIComponent(next)}`;

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

  const authPromise=loadAuth();
})();