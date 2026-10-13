(()=>{
  'use strict';

  // Prevent the older BoardView-only homepage handler from attaching after this
  // script starts. If it already attached, replacing the input below removes it.
  if(typeof window.setupHomeSearch==='function')window.setupHomeSearch=()=>{};

  function lang(){
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  }

  function ensureStyles(){
    if(document.querySelector('link[data-pcbr-site-search-css]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/site-search.css?v=20261013-1';
    link.dataset.pcbrSiteSearchCss='1';
    document.head.append(link);
  }

  function addNavSearch(){
    const nav=document.querySelector('header nav');
    if(!nav||nav.querySelector('.globalSearchLink'))return;
    const a=document.createElement('a');
    a.className='globalSearchLink';
    a.href='/search.html';
    a.textContent=lang()==='en'?'🔎 Search':'🔎 بحث';
    a.setAttribute('aria-label',lang()==='en'?'Site-wide search':'البحث الشامل في الموقع');
    nav.append(a);
  }

  function ensureEngine(){
    if(window.PCBRSiteSearch)return Promise.resolve(window.PCBRSiteSearch);
    return new Promise((resolve,reject)=>{
      let script=document.querySelector('script[src^="/site-search.js"]');
      if(!script){
        script=document.createElement('script');
        script.src='/site-search.js?v=20261013-1';
        script.dataset.pcbrSiteSearch='1';
        document.head.append(script);
      }
      const finish=()=>window.PCBRSiteSearch?resolve(window.PCBRSiteSearch):reject(new Error('Search engine unavailable'));
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',()=>reject(new Error('Search engine failed to load')),{once:true});
      // A direct site-search.js tag may already have finished before listeners were attached.
      let tries=0;
      const timer=setInterval(()=>{
        if(window.PCBRSiteSearch){clearInterval(timer);resolve(window.PCBRSiteSearch);}
        else if(++tries>40){clearInterval(timer);}
      },50);
    });
  }

  function enhanceHomepage(engine){
    let input=document.getElementById('homeSearch');
    const out=document.getElementById('homeSearchResults');
    const info=document.getElementById('homeSearchInfo');
    if(!input||!out||!info)return;

    // Remove any anonymous BoardView-only input listener that may have already attached.
    if(input.dataset.pcbrUnifiedSearch!=='1'){
      const replacement=input.cloneNode(true);
      replacement.dataset.pcbrUnifiedSearch='1';
      input.replaceWith(replacement);
      input=replacement;
    }

    const language=lang();
    const section=input.closest('.homeSearchSection');
    const heading=section?.querySelector('.sectionHead h2');
    const description=section?.querySelector('.sectionHead p');
    const allLink=section?.querySelector('.sectionHead .imageBtn');

    const copy=language==='en'?{
      title:'🔎 Site-wide Search',
      description:'Search BoardView, BIOS, diagnostics, component testing and the repair room from one place.',
      placeholder:'Example: H81M-VG4, DH55PJ, No Power or MOSFET',
      inputLabel:'Site-wide search',
      ready:'Search BoardView, BIOS, diagnostics, component testing and the repair room.',
      searching:'Searching...',
      found:n=>`Top ${n} matching results`,
      none:'No matching results.',
      all:'All search results',
      open:'Open'
    }:{
      title:'🔎 بحث شامل في الموقع',
      description:'ابحث في BoardView وBIOS وأدلة التشخيص وفحص القطع وغرفة الصيانة من مكان واحد.',
      placeholder:'مثال: H81M-VG4 أو DH55PJ أو No Power أو MOSFET',
      inputLabel:'البحث الشامل في الموقع',
      ready:'ابحث في BoardView وBIOS والتشخيص وفحص القطع وغرفة الصيانة.',
      searching:'جاري البحث...',
      found:n=>`أول ${n.toLocaleString('ar')} نتائج مطابقة`,
      none:'لا توجد نتائج مطابقة.',
      all:'كل نتائج البحث',
      open:'فتح'
    };

    if(heading)heading.textContent=copy.title;
    if(description)description.textContent=copy.description;
    if(section)section.setAttribute('aria-label',copy.inputLabel);
    input.placeholder=copy.placeholder;
    input.setAttribute('aria-label',copy.inputLabel);
    if(allLink){allLink.textContent=copy.all;allLink.href='/search.html';}

    let timer=null;

    function updateAllLink(){
      if(!allLink)return;
      const query=input.value.trim();
      allLink.href=query?`/search.html?q=${encodeURIComponent(query)}`:'/search.html';
    }

    function resultCard(item){
      const card=document.createElement('article');
      card.className='miniFile';

      const top=document.createElement('div');
      top.className='miniFileTop';
      const badge=document.createElement('span');
      badge.className='siteSearchBadge';
      badge.textContent=engine.label(item.type,language);
      top.append(badge);

      const h3=document.createElement('h3');
      const title=document.createElement('a');
      title.href=item.url;
      title.textContent=item.title;
      h3.append(title);

      const meta=document.createElement('p');
      meta.className='muted';
      meta.textContent=item.subtitle||'';

      const actions=document.createElement('div');
      actions.className='miniFileActions';
      const open=document.createElement('a');
      open.className='imageBtn';
      open.href=item.url;
      open.textContent=copy.open;
      actions.append(open);

      card.append(top,h3,meta,actions);
      return card;
    }

    async function render(){
      const query=input.value.trim();
      updateAllLink();
      out.innerHTML='';
      if(!query){
        out.hidden=true;
        info.textContent=copy.ready;
        return;
      }
      info.textContent=copy.searching;
      try{
        const matches=await engine.search(query,{limit:8,type:'all'});
        info.textContent=matches.length?copy.found(matches.length):copy.none;
        out.hidden=false;
        if(!matches.length){
          const empty=document.createElement('div');
          empty.className='emptyState';
          empty.textContent=copy.none;
          out.append(empty);
          return;
        }
        for(const item of matches)out.append(resultCard(item));
      }catch{
        info.textContent=copy.none;
        out.hidden=true;
      }
    }

    input.addEventListener('input',()=>{
      clearTimeout(timer);
      timer=setTimeout(render,120);
    });
    input.addEventListener('keydown',event=>{
      if(event.key!=='Enter')return;
      event.preventDefault();
      const query=input.value.trim();
      location.href=query?`/search.html?q=${encodeURIComponent(query)}`:'/search.html';
    });

    info.textContent=copy.ready;
    updateAllLink();
  }

  function start(){
    ensureStyles();
    addNavSearch();
    ensureEngine().then(engine=>{
      // Replace the old global handler again in case another script redefined it.
      if(typeof window.setupHomeSearch==='function')window.setupHomeSearch=()=>{};
      enhanceHomepage(engine);
    }).catch(()=>{});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();