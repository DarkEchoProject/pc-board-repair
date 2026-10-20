(()=>{
  'use strict';

  if(window.PCBRYouTubeIntegrationVersion==='20261020-7')return;
  window.PCBRYouTubeIntegrationVersion='20261020-7';

  const DATA_URL='/data/videos.json';
  const CHANNEL_URL='https://www.youtube.com/@PCBoardRepairArabic';
  const SUBSCRIBE_URL=`${CHANNEL_URL}?sub_confirmation=1`;

  const lang=()=>{
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  };

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'
  }[c]));

  function isShort(video){return video?.kind==='short'||/\/shorts\//i.test(String(video?.youtube_url||''));}
  function title(video,l){
    const value=l==='en'?(video.title_en||video.title_ar):(video.title_ar||video.title_en);
    if(value)return value;
    if(l==='en')return isShort(video)?'PC Board Repair Short':'PC Board Repair video';
    return isShort(video)?'Short من PC Board Repair':'فيديو صيانة من PC Board Repair';
  }
  function description(video,l){
    const value=l==='en'?(video.description_en||video.description_ar):(video.description_ar||video.description_en);
    if(value)return value;
    if(l==='en')return isShort(video)?'A quick repair Short from PC Board Repair.':'A practical repair video from PC Board Repair.';
    return isShort(video)?'مقطع Short سريع من قناة PC Board Repair.':'فيديو صيانة عملي من قناة PC Board Repair.';
  }
  function watchUrl(video){return video.youtube_url||`https://www.youtube.com/watch?v=${encodeURIComponent(video.id||'')}`;}
  function thumb(video){return `https://i.ytimg.com/vi/${encodeURIComponent(video.id||'')}/hqdefault.jpg`;}
  function orderedVideos(videos){
    return [...videos].sort((a,b)=>{
      const ao=Number(a?.order),bo=Number(b?.order);
      const ah=Number.isFinite(ao),bh=Number.isFinite(bo);
      if(ah&&bh&&ao!==bo)return ao-bo;
      if(ah&&!bh)return -1;
      if(!ah&&bh)return 1;
      return String(b?.published_at||'').localeCompare(String(a?.published_at||''));
    });
  }

  function addStyles(){
    if(document.getElementById('pcbrYouTubeStyles'))return;
    const style=document.createElement('style');
    style.id='pcbrYouTubeStyles';
    style.textContent=`
      .pcbrVideoSection{margin:24px 0;background:#0d1a2d;border:1px solid #203a5b;border-radius:18px;padding:20px}
      .pcbrVideoSection h2{margin-top:0}
      .pcbrVideoGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
      .pcbrVideoCard{overflow:hidden;background:#0a1626;border:1px solid #203a5b;border-radius:16px}
      .pcbrVideoThumb{display:block;position:relative;aspect-ratio:16/9;background:#08111d;overflow:hidden}
      .pcbrVideoThumb img{width:100%;height:100%;object-fit:cover;display:block}
      .pcbrVideoPlay{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);width:64px;height:44px;border-radius:12px;background:#ff0033;color:#fff;display:grid;place-items:center;font-size:24px;box-shadow:0 8px 30px #0008}
      .pcbrVideoBody{padding:16px}.pcbrVideoBody h3{margin:0 0 8px;line-height:1.5}.pcbrVideoBody p{margin:0 0 14px}
      .pcbrVideoActions{display:flex;gap:10px;flex-wrap:wrap}
      .pcbrVideoEmbed{position:relative;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000;margin-top:14px}
      .pcbrVideoEmbed iframe{width:100%;height:100%;border:0;display:block}
      .pcbrVideoEyebrow{display:inline-block;margin-bottom:8px;background:#2a1015;border:1px solid #743241;color:#ffb3be;padding:4px 9px;border-radius:999px;font-size:12px}
      .pcbrSubscribeBtn{background:#ff0033!important;border-color:#ff0033!important;color:#fff!important}
      @media(max-width:640px){.pcbrVideoSection{padding:15px}.pcbrVideoPlay{width:56px;height:39px;font-size:21px}}
    `;
    document.head.append(style);
  }

  function channelLabel(l,place){if(place==='nav')return '▶ YouTube';return l==='en'?'YouTube Channel':'قناة YouTube';}
  function subscribeLabel(l){return l==='en'?'Subscribe to the channel':'اشترك في القناة';}

  function addChannelLinks(){
    const l=lang();
    const nav=document.querySelector('header nav');
    if(nav&&!nav.querySelector('[data-pcbr-youtube-channel="nav"]')){
      const a=document.createElement('a');a.href=CHANNEL_URL;a.target='_blank';a.rel='noopener noreferrer';a.dataset.pcbrYoutubeChannel='nav';a.textContent=channelLabel(l,'nav');nav.append(a);
    }
    const footerLinks=document.querySelector('.footerLinks');
    if(footerLinks&&!footerLinks.querySelector('[data-pcbr-youtube-channel="footer"]')){
      const a=document.createElement('a');a.href=CHANNEL_URL;a.target='_blank';a.rel='noopener noreferrer';a.dataset.pcbrYoutubeChannel='footer';a.textContent=channelLabel(l,'footer');footerLinks.append(a);
    }
  }

  function addChannelSchema(){
    if(document.getElementById('pcbrYouTubeChannelSchema'))return;
    const schema=document.createElement('script');schema.id='pcbrYouTubeChannelSchema';schema.type='application/ld+json';
    schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':'Organization',name:'PC Board Repair',url:location.origin,sameAs:[CHANNEL_URL]}).replace(/</g,'\\u003c');
    document.head.append(schema);
  }

  function videoCard(video,l){
    const url=watchUrl(video);const badge=isShort(video)?'YouTube Short':'YouTube';
    return `<article class="pcbrVideoCard"><a class="pcbrVideoThumb" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(title(video,l))}"><img loading="lazy" src="${esc(thumb(video))}" alt="${esc(title(video,l))}"><span class="pcbrVideoPlay" aria-hidden="true">▶</span></a><div class="pcbrVideoBody"><span class="pcbrVideoEyebrow">${badge}</span><h3>${esc(title(video,l))}</h3><p class="muted">${esc(description(video,l))}</p><div class="pcbrVideoActions"><a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${l==='en'?'Watch on YouTube':'شاهد على YouTube'}</a><a class="imageBtn pcbrSubscribeBtn" href="${esc(SUBSCRIBE_URL)}" target="_blank" rel="noopener noreferrer">${subscribeLabel(l)}</a></div></div></article>`;
  }

  function updateHomeVideoStat(videos){
    if(!/^\/(?:index\.html)?$/.test(location.pathname))return;
    const counter=document.getElementById('homeImageCount');if(!counter)return;
    const l=lang();const desired=videos.length.toLocaleString(l==='en'?'en-US':'ar-LB');
    const label=counter.closest('.homeStat')?.querySelector('span');const desiredLabel=l==='en'?'Repair videos':'فيديوهات صيانة';
    const apply=()=>{counter.textContent=desired;if(label)label.textContent=desiredLabel;};
    apply();if(counter.dataset.pcbrVideoStat==='1')return;counter.dataset.pcbrVideoStat='1';
    const observer=new MutationObserver(apply);observer.observe(counter,{childList:true,characterData:true,subtree:true});setTimeout(()=>{apply();observer.disconnect();},5000);
  }

  function addHomeSection(videos){
    if(!/^\/(?:index\.html)?$/.test(location.pathname))return;
    const l=lang();const target=document.querySelector('.homeSearchSection')||document.querySelector('main.wrap .downloadBox');if(!target)return;
    let section=document.getElementById('pcbrHomeVideos');
    if(!section){section=document.createElement('section');section.id='pcbrHomeVideos';section.className='pcbrVideoSection';target.insertAdjacentElement('afterend',section);}
    const list=orderedVideos(videos).slice(0,3);
    section.innerHTML=`<div class="sectionHead"><div><h2>${l==='en'?'🎥 Latest Repair Videos':'🎥 أحدث فيديوهات الصيانة'}</h2><p class="muted">${l==='en'?'The latest three videos from the PC Board Repair channel.':'أحدث 3 فيديوهات من قناة PC Board Repair، ويحل الفيديو الجديد مكان الأقدم تلقائيًا في العرض.'}</p></div><a class="imageBtn pcbrSubscribeBtn" href="${esc(SUBSCRIBE_URL)}" target="_blank" rel="noopener noreferrer">${subscribeLabel(l)}</a></div><div class="pcbrVideoGrid">${list.map(v=>videoCard(v,l)).join('')}</div>`;
  }

  function addComponentTestingVideo(videos){
    if(!/^\/component-testing(?:\/index\.html|\/)?$/.test(location.pathname))return;
    const video=videos.find(v=>v.category==='component-testing');if(!video)return;
    const l=lang();const hero=document.querySelector('.testHero');const fallback=document.querySelector('.warnLocal');if(!hero&&!fallback)return;
    let section=document.getElementById('pcbrComponentVideo');
    if(!section){section=document.createElement('section');section.id='pcbrComponentVideo';section.className='pcbrVideoSection';if(hero)hero.insertAdjacentElement('afterend',section);else fallback.insertAdjacentElement('beforebegin',section);}
    section.innerHTML=`<span class="pcbrVideoEyebrow">YouTube</span><h2>${l==='en'?'🎥 Practical video explanation':'🎥 الشرح العملي بالفيديو'}</h2><p class="muted">${esc(description(video,l))}</p><div class="pcbrVideoEmbed"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?rel=0" title="${esc(title(video,l))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div><div class="pcbrVideoActions" style="margin-top:14px"><a class="btn" href="${esc(watchUrl(video))}" target="_blank" rel="noopener noreferrer">${l==='en'?'Open video on YouTube':'فتح الفيديو على YouTube'}</a><a class="imageBtn pcbrSubscribeBtn" href="${esc(SUBSCRIBE_URL)}" target="_blank" rel="noopener noreferrer">${subscribeLabel(l)}</a></div>`;
  }

  async function init(){
    addStyles();addChannelLinks();addChannelSchema();
    try{
      const response=await fetch(DATA_URL,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();const videos=Array.isArray(data)?data.filter(v=>v&&v.id):[];if(!videos.length)return;
      updateHomeVideoStat(videos);addHomeSection(videos);addComponentTestingVideo(videos);
    }catch(err){console.warn('PCBR YouTube integration unavailable.',err);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
