(()=>{
  const map={
    'تشخيص POST المتوقف وصفارات Beep Codes | PC Board Repair':'POST Freeze & Beep Codes Diagnosis | PC Board Repair',
    'تشخيص VRM وخطوط المعالج والرام | PC Board Repair':'VRM, CPU & RAM Rail Diagnosis | PC Board Repair'
  };
  let original='';
  const apply=()=>{
    const en=document.documentElement.lang==='en';
    if(en){
      if(map[document.title]){original=document.title;document.title=map[document.title];}
    }else if(original){document.title=original;}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  new MutationObserver(apply).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
