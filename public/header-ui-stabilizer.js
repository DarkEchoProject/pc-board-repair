(()=>{
  'use strict';

  const YOUTUBE_URL='https://www.youtube.com/@PCBoardRepairArabic';
  let authReady=false;
  let currentUser=null;
  let scheduled=false;

  function currentLang(){
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  }

  function nextPath(){
    return location.pathname+location.search+location.hash;
  }

  function loginHref(){
    return `/login.html?next=${encodeURIComponent(nextPath())}`;
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

  function ensureAccount(){
    const header=document.querySelector('header');
    if(!header||header.querySelector('.accountBox')||!authReady)return;

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
      out.addEventListener('click',async()=>{
        try{await fetch('/api/auth/logout',{method:'POST'});}catch{}
        location.reload();
      });

      box.append(chip,out);
    }

    header.append(box);
  }

  function ensureLanguage(){
    const header=document.querySelector('header');
    if(!header||header.querySelector('.languageBox'))return;

    const lang=currentLang();
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
    select.value=lang;
    select.addEventListener('change',()=>{
      const next=select.value==='en'?'en':'ar';
      if(window.PCBRLanguage&&typeof window.PCBRLanguage.set==='function'){
        window.PCBRLanguage.set(next);
        return;
      }
      try{localStorage.setItem('pcbr-language',next);}catch{}
      location.reload();
    });

    box.append(icon,select);
    const account=header.querySelector('.accountBox');
    if(account)header.insertBefore(box,account);else header.append(box);
  }

  function ensureAll(){
    ensureYouTube();
    ensureAccount();
    ensureLanguage();
  }

  function scheduleEnsure(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{
      scheduled=false;
      ensureAll();
    });
  }

  async function loadAuth(){
    try{
      const response=await fetch('/api/auth/me',{cache:'no-store'});
      if(response.ok){
        const data=await response.json();
        currentUser=data&&data.user?data.user:null;
      }
    }catch{}
    authReady=true;
    scheduleEnsure();
  }

  function start(){
    ensureAll();
    loadAuth();
    const observer=new MutationObserver(scheduleEnsure);
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('pcbr:language-applied',scheduleEnsure);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
