(()=>{
  'use strict';

  window.PCBRHeaderStabilizerLoaded='20261020-2';

  const YOUTUBE_URL='https://www.youtube.com/@PCBoardRepairArabic';
  let authReady=false;
  let currentUser=null;

  function currentLang(){
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  }

  function loginHref(){
    const next=location.pathname+location.search+location.hash;
    return `/login.html?next=${encodeURIComponent(next)}`;
  }

  function ensureYouTube(){
    const nav=document.querySelector('header nav');
    if(!nav||nav.querySelector('[data-pcbr-youtube-channel="nav"]'))return;
    const a=document.createElement('a');
    a.href=YOUTUBE_URL;
    a.target='_blank';
    a.rel='noopener noreferrer';
    a.dataset.pcbrYoutubeChannel='nav';
    a.textContent='▶ YouTube';
    a.style.cssText='color:#fff;background:#ff0033;border:1px solid #ff0033;border-radius:10px;padding:6px 10px;text-decoration:none;font-weight:700;white-space:nowrap';
    nav.append(a);
  }

  function ensureLanguage(){
    const header=document.querySelector('header');
    if(!header||header.querySelector('.languageBox'))return;

    const box=document.createElement('div');
    box.className='languageBox';

    const icon=document.createElement('span');
    icon.className='languageIcon';
    icon.textContent='🌐';
    icon.setAttribute('aria-hidden','true');

    const select=document.createElement('select');
    select.className='languageSelect';
    select.setAttribute('aria-label','اللغة / Language');
    select.innerHTML='<option value="ar">العربية</option><option value="en">English</option>';
    select.value=currentLang();
    select.addEventListener('change',()=>{
      const next=select.value==='en'?'en':'ar';
      if(window.PCBRLanguage&&typeof window.PCBRLanguage.set==='function'){
        window.PCBRLanguage.set(next);
      }else{
        try{localStorage.setItem('pcbr-language',next);}catch{}
        location.reload();
      }
    });

    box.append(icon,select);
    const account=header.querySelector('.accountBox');
    if(account)header.insertBefore(box,account);else header.append(box);
  }

  function ensureAccount(){
    const header=document.querySelector('header');
    if(!header||header.querySelector('.accountBox')||!authReady)return;

    const box=document.createElement('div');
    box.className='accountBox';

    if(currentUser){
      const chip=document.createElement('div');
      chip.className='accountChip';

      const avatar=document.createElement('span');
      avatar.className='accountAvatar';
      avatar.textContent=(currentUser.name||currentUser.email||'?').trim().charAt(0).toUpperCase();

      const name=document.createElement('span');
      name.className='accountName';
      name.textContent=currentUser.name||currentUser.email||'حسابي';

      const out=document.createElement('button');
      out.className='accountLogout';
      out.type='button';
      out.textContent='خروج';
      out.addEventListener('click',async()=>{
        try{await fetch('/api/auth/logout',{method:'POST'});}catch{}
        location.reload();
      });

      chip.append(avatar,name);
      box.append(chip,out);
    }else{
      const a=document.createElement('a');
      a.className='accountLogin';
      a.href=loginHref();
      a.textContent='تسجيل الدخول';
      box.append(a);
    }

    header.append(box);
  }

  function ensureAll(){
    ensureYouTube();
    ensureLanguage();
    ensureAccount();
  }

  async function refreshAuth(){
    try{
      const response=await fetch('/api/auth/me',{cache:'no-store'});
      if(response.ok){
        const data=await response.json();
        currentUser=data&&data.user?data.user:null;
      }
    }catch{}
    authReady=true;
    ensureAll();
  }

  ensureAll();
  refreshAuth();
  document.addEventListener('DOMContentLoaded',ensureAll);
  window.addEventListener('load',ensureAll);
  window.addEventListener('pcbr:language-applied',ensureAll);
  setInterval(ensureAll,750);
})();
