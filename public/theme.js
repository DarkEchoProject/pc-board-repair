(()=>{
  'use strict';

  const STORAGE_KEY='pcbr-theme';
  const ICONS={
    '/boardview/index.html':'/icons/boardview.svg',
    '/bios/index.html':'/icons/bios.svg',
    '/community.html':'/icons/community.svg',
    '/diagnostics/index.html':'/icons/diagnostics.svg',
    '/component-testing/index.html':'/icons/multimeter.svg'
  };

  function getTheme(){
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      return saved==='light'?'light':'dark';
    }catch{return 'dark';}
  }

  function setTheme(value, persist=true){
    const theme=value==='light'?'light':'dark';
    document.documentElement.dataset.theme=theme;
    if(persist){
      try{localStorage.setItem(STORAGE_KEY,theme);}catch{}
    }
    updateToggle(theme);
  }

  function updateToggle(theme=getTheme()){
    const btn=document.querySelector('.pcbrThemeToggle');
    if(!btn)return;
    const light=theme==='light';
    btn.setAttribute('aria-pressed',String(light));
    btn.setAttribute('aria-label',light?'تفعيل الوضع الداكن':'تفعيل الوضع الفاتح');
    btn.title=light?'الوضع الحالي: فاتح — اضغط للداكن':'الوضع الحالي: داكن — اضغط للفاتح';
    const icon=btn.querySelector('.pcbrThemeIcon');
    const text=btn.querySelector('.pcbrThemeText');
    if(icon)icon.textContent=light?'🌙':'☀️';
    if(text)text.textContent=light?'داكن':'فاتح';
  }

  function addThemeToggle(){
    const header=document.querySelector('header');
    if(!header || header.querySelector('.pcbrThemeToggle'))return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='pcbrThemeToggle';
    btn.innerHTML='<span class="pcbrThemeIcon" aria-hidden="true"></span><span class="pcbrThemeText"></span>';
    btn.addEventListener('click',()=>{
      const current=document.documentElement.dataset.theme==='light'?'light':'dark';
      setTheme(current==='light'?'dark':'light',true);
    });

    const account=header.querySelector('.accountBox');
    const language=header.querySelector('.languageBox');
    if(language) header.insertBefore(btn,language);
    else if(account) header.insertBefore(btn,account);
    else header.append(btn);

    updateToggle(document.documentElement.dataset.theme||getTheme());
  }

  function normalizePath(href){
    try{
      const u=new URL(href,location.origin);
      if(u.origin!==location.origin)return '';
      let p=u.pathname;
      if(p==='/'||p==='/index.html')return '/';
      return p;
    }catch{return '';}
  }

  function replaceSectionIcons(){
    document.querySelectorAll('a.card').forEach(card=>{
      const path=normalizePath(card.getAttribute('href')||'');
      const src=ICONS[path];
      if(!src)return;
      const icon=card.querySelector('.ico');
      if(!icon || icon.dataset.pcbrSvg==='1')return;
      icon.dataset.pcbrSvg='1';
      icon.classList.add('pcbrSvgIcon');
      icon.textContent='';
      const img=document.createElement('img');
      img.src=src;
      img.alt='';
      img.loading='lazy';
      img.decoding='async';
      icon.append(img);
    });
  }

  function boot(){
    if(!document.documentElement.dataset.theme){
      setTheme(getTheme(),false);
    }
    addThemeToggle();
    // replaceSectionIcons(); // Disabled: SVG files are missing
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
