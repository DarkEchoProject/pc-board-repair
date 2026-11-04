(()=>{
  'use strict';
  const dataUrl='/data/bios.json';
  const byId=id=>document.getElementById(id);
  const companyMode=document.body.dataset.biosPage==='company';
  const search=byId('biosSearch');
  const brandSelect=byId('biosBrand');
  const countEl=byId('biosResultCount');
  const results=byId('biosResults');
  const pager=byId('biosPagination');
  const reset=byId('biosReset');
  const companies=byId('biosCompanies');
  const companiesTitle=byId('biosCompaniesTitle');
  const resultsTitle=byId('biosResultsTitle');
  const nfmt=new Intl.NumberFormat('ar-LB');
  const PAGE_SIZE=24;
  let page=1;
  let records=[];
  let selectedCompany='';
  let brands=[];
  if(!search||!results||!countEl||!pager||!reset)return;

  const normalize=value=>String(value??'').toLowerCase().normalize('NFKC')
    .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[ًٌٍَُِّْـ]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const compact=value=>normalize(value).replace(/\s+/g,'');
  const safeDownload=value=>{
    try{
      const u=new URL(String(value??''));
      if(u.origin!=='https://github.com')return '';
      if(!u.pathname.startsWith('/DarkEchoProject/pc-board-repair/releases/download/'))return '';
      return u.href;
    }catch{return '';}
  };
  const friendlyName=item=>String(item.file||'BIOS').replace(/\.(rar|zip|7z)$/i,'').trim();
  const fileType=item=>{const match=String(item.file||'').match(/\.(rar|zip|7z)$/i);return match?match[1].toUpperCase():'BIOS';};
  function empty(message,container=results){
    container.replaceChildren();
    const node=document.createElement('div');
    node.className='biosEmpty';node.textContent=message;container.append(node);
  }
  function biosCard(item){
    const card=document.createElement('article');card.className='biosFile';
    const head=document.createElement('div');head.className='biosFileTop';
    const company=document.createElement('span');company.className='brandTag';company.textContent=item.brand;
    const type=document.createElement('span');type.className='biosFileType';type.textContent=fileType(item);
    head.append(company,type);
    const name=document.createElement('h3');name.textContent=item.file;
    const link=document.createElement('a');link.className='biosDownload';
    link.textContent='⬇️ تحميل BIOS';link.href=item.download_url;
    link.target='_blank';link.rel='noopener noreferrer';
    card.append(head,name,link);
    return card;
  }
  function sortedCompanyItems(items){
    return items.slice().sort((a,b)=>String(a.file).localeCompare(String(b.file),'en',{sensitivity:'base'}));
  }
  function buildCompanies(){
    if(!companies)return;
    companies.replaceChildren();
    brands.forEach(name=>{
      const items=sortedCompanyItems(records.filter(r=>r.brand===name));
      const tile=document.createElement('a');
      tile.className='card';tile.href=`company.html?brand=${encodeURIComponent(name)}`;
      const title=document.createElement('h3');title.textContent=name;
      const example=document.createElement('p');example.className='muted';
      example.textContent=items.slice(0,3).map(friendlyName).join('، ')+(items.length>3?'…':'');
      const amount=document.createElement('div');amount.className='countBadge';
      amount.textContent=`${nfmt.format(items.length)} ملف`;
      tile.append(title,example,amount);companies.append(tile);
    });
  }
  function filtered(){
    const terms=normalize(search.value).split(/\s+/).filter(Boolean);
    const b=companyMode?selectedCompany:(brandSelect?.value||'');
    return records.filter(item=>{
      if(b&&item.brand!==b)return false;
      if(!terms.length)return true;
      const text=`${item.brand} ${item.file} ${item.relative_path||''}`;
      const hay=normalize(text);const packed=compact(text);
      return terms.every(term=>hay.includes(term)||packed.includes(term.replace(/\s+/g,'')));
    }).sort((a,b)=>String(a.brand).localeCompare(String(b.brand),'en',{sensitivity:'base'})||
      String(a.file).localeCompare(String(b.file),'en',{sensitivity:'base'}));
  }
  function activeSearch(){return companyMode||Boolean(search.value.trim()||brandSelect?.value);}
  function renderPager(total){
    pager.replaceChildren();
    const pages=Math.ceil(total/PAGE_SIZE);
    pager.hidden=pages<=1;
    if(pages<=1)return;
    const add=(title,p,active=false,disabled=false)=>{
      const btn=document.createElement('button');btn.type='button';btn.className='pageBtn'+(active?' active':'');
      btn.textContent=title;btn.disabled=disabled;
      btn.addEventListener('click',()=>{
        page=p;render();
        document.getElementById('biosResults').scrollIntoView({behavior:'smooth',block:'start'});
      });
      pager.append(btn);
    };
    add('السابق',page-1,false,page===1);
    const start=Math.max(1,Math.min(page-2,pages-4));
    const end=Math.min(pages,start+4);
    for(let p=start;p<=end;p++)add(nfmt.format(p),p,p===page);
    add('التالي',page+1,false,page===pages);
  }
  function render(){
    const active=activeSearch();
    if(companies)companies.hidden=active;
    if(companiesTitle)companiesTitle.hidden=active;
    if(resultsTitle)resultsTitle.hidden=!active;
    if(!active){
      results.replaceChildren();pager.hidden=true;
      countEl.textContent=`${nfmt.format(records.length)} ملف ضمن ${nfmt.format(brands.length)} شركة`;
      return;
    }
    const all=filtered();
    const pages=Math.max(1,Math.ceil(all.length/PAGE_SIZE));
    page=Math.min(Math.max(1,page),pages);
    countEl.textContent=`تم العثور على ${nfmt.format(all.length)} ملف`;
    if(!all.length){
      empty('لا توجد ملفات مطابقة. جرّب رقم البورد أو اسم الموديل بطريقة مختلفة.');
      pager.hidden=true;return;
    }
    results.replaceChildren(...all.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(biosCard));
    renderPager(all.length);
  }
  const changed=()=>{page=1;render();};
  search.addEventListener('input',changed);
  if(brandSelect)brandSelect.addEventListener('change',changed);
  reset.addEventListener('click',()=>{
    search.value='';if(brandSelect)brandSelect.value='';changed();search.focus();
  });
  async function load(){
    try{
      const response=await fetch(dataUrl,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      if(!Array.isArray(payload))throw new Error('The BIOS catalog must be a JSON array.');
      const seen=new Set();
      records=payload.filter(item=>{
        if(!item||typeof item!=='object')return false;
        const sha=String(item.sha256||'').toLowerCase();
        const url=safeDownload(item.download_url);
        if(!/^[0-9a-f]{64}$/.test(sha)||seen.has(sha)||!url||!item.file)return false;
        seen.add(sha);item.download_url=url;item.brand=String(item.brand||'Other').trim()||'Other';return true;
      });
      brands=[...new Set(records.map(i=>i.brand))].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}));
      if(companyMode){
        const requested=new URLSearchParams(location.search).get('brand')||'';
        selectedCompany=brands.find(b=>b.toLowerCase()===requested.toLowerCase())||'';
        if(!selectedCompany){
          byId('biosCompanyHeading').textContent='الشركة غير موجودة';
          byId('biosCompanyDescription').textContent='اختر شركة من الفهرس الرئيسي.';
          byId('biosCompanyTotal').textContent='0';
          empty('لم يتم العثور على الشركة المطلوبة.');
          countEl.textContent='لا توجد ملفات';return;
        }
        const total=records.filter(r=>r.brand===selectedCompany).length;
        byId('biosCompanyHeading').textContent=`ملفات BIOS — ${selectedCompany}`;
        byId('biosCrumbBrand').textContent=selectedCompany;
        byId('biosCompanyDescription').textContent=`تصفح ملفات BIOS الخاصة بشركة ${selectedCompany} أو ابحث برقم البورد والموديل.`;
        byId('biosCompanyTotal').textContent=nfmt.format(total);
        document.title=`${selectedCompany} BIOS | PC Board Repair`;
        render();
      }else{
        byId('biosTotal').textContent=nfmt.format(records.length);
        byId('biosBrands').textContent=nfmt.format(brands.length);
        if(brandSelect){
          brandSelect.append(...brands.map(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;return option;}));
        }
        buildCompanies();render();
      }
    }catch(err){
      countEl.textContent='تعذر تحميل فهرس BIOS';
      empty('تعذر تحميل /data/bios.json. تأكد من إنشاء الفهرس ثم حدّث الصفحة.');
      console.error('BIOS catalog:',err);
    }
  }
  load();
})();
