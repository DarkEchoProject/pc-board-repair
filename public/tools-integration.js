(()=>{
  'use strict';

  const OPENBOARDVIEW_URL='https://github.com/OpenBoardView/OpenBoardView/releases';

  function addOpenBoardView(){
    if(!/^\/(?:index\.html)?$/.test(location.pathname))return;
    if(document.getElementById('pcbrOpenBoardView'))return;

    const flex=document.querySelector('main.wrap .downloadBox');
    if(!flex)return;

    const box=document.createElement('div');
    box.id='pcbrOpenBoardView';
    box.className='downloadBox';
    box.style.marginTop='14px';
    box.innerHTML=`
      <div>
        <h2 style="margin:0 0 6px">⬇️ OpenBoardView</h2>
        <p class="muted" style="margin:0 0 6px">قارئ BoardView مجاني ومفتوح المصدر — مفيد خصوصًا لملفات BRD التي قد لا تفتح في FlexBV.</p>
        <p class="muted smallText" style="margin:0">يدعم صيغًا شائعة مثل BRD (Landrex/TestLink وTopTest)، FZ، BDV، BVR، CAE وASC. ملاحظة: توجد أنواع مختلفة تحمل الامتداد BRD، لذلك قد لا يفتح كل ملف BRD.</p>
      </div>
      <a class="btn" href="${OPENBOARDVIEW_URL}" target="_blank" rel="noopener noreferrer">تحميل OpenBoardView</a>`;

    flex.insertAdjacentElement('afterend',box);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addOpenBoardView,{once:true});
  else addOpenBoardView();
})();
