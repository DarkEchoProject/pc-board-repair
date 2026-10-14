(()=>{
  'use strict';

  const DATA_URL='/data/videos.json';

  const lang=()=>{
    try{return localStorage.getItem('pcbr-language')==='en'?'en':'ar';}catch{return 'ar';}
  };

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  function title(video,l){return l==='en'?(video.title_en||video.title_ar):(video.title_ar||video.title_en);}
  function description(video,l){return l==='en'?(video.description_en||video.description_ar):(video.description_ar||video.description_en);}
  function watchUrl(video){return video.youtube_url||`https://www.youtube.com/watch?v=${encodeURIComponent(video.id||'')}`;}
  function thumb(video){return `https://i.ytimg.com/vi/${encodeURIComponent(video.id||'')}/hqdefault.jpg`;}

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
      .pcbrVideoBody{padding:16px}
      .pcbrVideoBody h3{margin:0 0 8px;line-height:1.5}
      .pcbrVideoBody p{margin:0 0 14px}
      .pcbrVideoActions{display:flex;gap:10px;flex-wrap:wrap}
      .pcbrVideoEmbed{position:relative;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000;margin-top:14px}
      .pcbrVideoEmbed iframe{width:100%;height:100%;border:0;display:block}
      .pcbrVideoEyebrow{display:inline-block;margin-bottom:8px;background:#2a1015;border:1px solid #743241;color:#ffb3be;padding:4px 9px;border-radius:999px;font-size:12px}
      @media(max-width:640px){.pcbrVideoSection{padding:15px}.pcbrVideoPlay{width:56px;height:39px;font-size:21px}}
    `;
    document.head.append(style);
  }

  function videoCard(video,l){
    const url=watchUrl(video);
    return `<article class="pcbrVideoCard">
      <a class="pcbrVideoThumb" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(title(video,l))}">
        <img loading="lazy" src="${esc(thumb(video))}" alt="${esc(title(video,l))}">
        <span class="pcbrVideoPlay" aria-hidden="true">▶</span>
      </a>
      <div class="pcbrVideoBody">
        <span class="pcbrVideoEyebrow">YouTube</span>
        <h3>${esc(title(video,l))}</h3>
        <p class="muted">${esc(description(video,l))}</p>
        <div class="pcbrVideoActions"><a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${l==='en'?'Watch on YouTube':'شاهد على YouTube'}</a></div>
      </div>
    </article>`;
  }

  function addHomeSection(videos){
    if(!/^\/(?:index\.html)?$/.test(location.pathname)||document.getElementById('pcbrHomeVideos'))return;
    const l=lang();
    const target=document.querySelector('.homeSearchSection')||document.querySelector('main.wrap .downloadBox');
    if(!target)return;
    const section=document.createElement('section');
    section.id='pcbrHomeVideos';
    section.className='pcbrVideoSection';
    const recent=[...videos].sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||''))).slice(0,3);
    section.innerHTML=`<div class="sectionHead"><div><h2>${l==='en'?'🎥 Latest Repair Videos':'🎥 أحدث فيديوهات الصيانة'}</h2><p class="muted">${l==='en'?'Practical videos linked to the repair guides on this site.':'شروحات عملية مرتبطة بأدلة الصيانة الموجودة في الموقع.'}</p></div></div><div class="pcbrVideoGrid">${recent.map(v=>videoCard(v,l)).join('')}</div>`;
    target.insertAdjacentElement('afterend',section);
  }

  function addComponentTestingVideo(videos){
    if(location.pathname!=='/component-testing/index.html'||document.getElementById('pcbrComponentVideo'))return;
    const video=videos.find(v=>v.category==='component-testing');
    if(!video)return;
    const l=lang();
    const hero=document.querySelector('.testHero');
    if(!hero)return;
    const section=document.createElement('section');
    section.id='pcbrComponentVideo';
    section.className='pcbrVideoSection';
    section.innerHTML=`
      <span class="pcbrVideoEyebrow">YouTube</span>
      <h2>${l==='en'?'🎥 Practical video explanation':'🎥 الشرح العملي بالفيديو'}</h2>
      <p class="muted">${esc(description(video,l))}</p>
      <div class="pcbrVideoEmbed"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?rel=0" title="${esc(title(video,l))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>
      <div class="pcbrVideoActions" style="margin-top:14px"><a class="btn" href="${esc(watchUrl(video))}" target="_blank" rel="noopener noreferrer">${l==='en'?'Open video on YouTube':'فتح الفيديو على YouTube'}</a></div>`;
    hero.insertAdjacentElement('afterend',section);

    const schema=document.createElement('script');
    schema.type='application/ld+json';
    schema.textContent=JSON.stringify({
      '@context':'https://schema.org',
      '@type':'VideoObject',
      name:title(video,l),
      description:description(video,l),
      thumbnailUrl:[thumb(video)],
      embedUrl:`https://www.youtube-nocookie.com/embed/${video.id}`,
      contentUrl:watchUrl(video),
      ...(video.published_at?{uploadDate:video.published_at}:{})
    }).replace(/</g,'\\u003c');
    document.head.append(schema);
  }

  async function init(){
    try{
      const response=await fetch(DATA_URL,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      const videos=Array.isArray(data)?data.filter(v=>v&&v.id):[];
      if(!videos.length)return;
      addStyles();
      addHomeSection(videos);
      addComponentTestingVideo(videos);
    }catch(err){
      console.warn('PCBR YouTube integration unavailable.',err);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
