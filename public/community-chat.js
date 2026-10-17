(()=>{
'use strict';

const messagesEl=document.getElementById('messages');
const form=document.getElementById('chatForm');
if(!messagesEl||!form)return;

const nameEl=document.getElementById('name');
const categoryEl=document.getElementById('category');
const messageEl=document.getElementById('message');
const statusEl=document.getElementById('status');
const sendBtn=document.getElementById('sendBtn');
const searchEl=document.getElementById('chatSearch');
const filterEl=document.getElementById('chatCategoryFilter');
const countEl=document.getElementById('messageCount');
const replyBar=document.getElementById('replyBar');
const replyName=document.getElementById('replyName');
const replyPreview=document.getElementById('replyPreview');
const charCount=document.getElementById('chatCharCount');
const draftNote=document.getElementById('chatDraftNote');
const liveStatus=document.getElementById('chatLiveStatus');
const liveText=document.getElementById('chatLiveText');
const quickFilters=document.getElementById('chatQuickFilters');
const newBtn=document.getElementById('chatNewBtn');
const jumpBtn=document.getElementById('chatJumpBtn');

const DRAFT_KEY='pcbr-chat-draft-v2';
const NAME_KEY='pcbr-chat-name';
const POLL_MS=5000;
let allMessages=[];
let replyTo='';
let hashHandled=false;
let initialized=false;
let previousIds=new Set();
let unseenCount=0;
let lastRenderSignature='';
let pollTimer=null;

if(nameEl)nameEl.value=localStorage.getItem(NAME_KEY)||'';
restoreDraft();
updateCharCount();

function formatTime(iso){try{return new Intl.DateTimeFormat('ar-LB',{hour:'2-digit',minute:'2-digit'}).format(new Date(iso));}catch{return iso||'';}}
function formatFullTime(iso){try{return new Intl.DateTimeFormat('ar-LB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));}catch{return iso||'';}}
function dateKey(iso){const d=new Date(iso);if(Number.isNaN(d.getTime()))return'';return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function dateLabel(iso){try{const d=new Date(iso),today=new Date(),yesterday=new Date(Date.now()-86400000);const key=x=>`${x.getFullYear()}-${x.getMonth()+1}-${x.getDate()}`;if(key(d)===key(today))return'اليوم';if(key(d)===key(yesterday))return'أمس';return new Intl.DateTimeFormat('ar-LB',{weekday:'long',day:'numeric',month:'short'}).format(d);}catch{return'';}}
function avatarLetter(name){return String(name||'?').trim().charAt(0).toUpperCase()||'?';}
function findMessage(id){return allMessages.find(m=>m.id===id);}
function isNearBottom(){return messagesEl.scrollHeight-messagesEl.scrollTop-messagesEl.clientHeight<120;}
function currentSignature(messages){return messages.map(m=>`${m.id}:${m.time||''}`).join('|');}
function filteredMessages(){const term=String(searchEl?.value||'').trim().toLowerCase(),cat=filterEl?.value||'';return allMessages.filter(m=>{if(cat&&m.category!==cat)return false;if(term&&!`${m.name||''} ${m.text||''} ${m.category||''}`.toLowerCase().includes(term))return false;return true;});}

function setLive(ok){if(!liveStatus||!liveText)return;liveStatus.classList.toggle('is-error',!ok);if(ok){const t=new Date();liveText.textContent=`متصل • آخر تحديث ${new Intl.DateTimeFormat('ar-LB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(t)}`;}else liveText.textContent='تعذر التحديث • سنحاول مجددًا';}

function updateCharCount(){if(!messageEl||!charCount)return;const n=messageEl.value.length;charCount.textContent=`${n.toLocaleString('ar-LB')} / 500`;charCount.classList.toggle('nearLimit',n>=430&&n<500);charCount.classList.toggle('atLimit',n>=500);}

function saveDraft(){if(!messageEl||!categoryEl)return;const payload={text:messageEl.value,category:categoryEl.value,replyTo};try{if(payload.text||payload.replyTo)localStorage.setItem(DRAFT_KEY,JSON.stringify(payload));else localStorage.removeItem(DRAFT_KEY);if(draftNote)draftNote.textContent=payload.text?'تم حفظ المسودة تلقائيًا':' ';}catch{}}
function restoreDraft(){try{const raw=localStorage.getItem(DRAFT_KEY);if(!raw)return;const d=JSON.parse(raw);if(messageEl&&typeof d.text==='string')messageEl.value=d.text.slice(0,500);if(categoryEl&&d.category)[...categoryEl.options].some(o=>{if(o.value===d.category||o.text===d.category){categoryEl.value=o.value||o.text;return true;}return false;});if(typeof d.replyTo==='string')replyTo=d.replyTo;}catch{}}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY);}catch{}if(draftNote)draftNote.textContent=' ';}

function setReply(id){const m=findMessage(id);if(!m)return;replyTo=m.id;if(replyName)replyName.textContent=m.name||'';if(replyPreview)replyPreview.textContent=String(m.text||'').slice(0,140);if(replyBar)replyBar.hidden=false;saveDraft();messageEl?.focus();}
function clearReply(){replyTo='';if(replyBar)replyBar.hidden=true;if(replyName)replyName.textContent='';if(replyPreview)replyPreview.textContent='';saveDraft();}
function restoreReplyUi(){if(!replyTo)return;const m=findMessage(replyTo);if(!m){replyTo='';saveDraft();return;}if(replyName)replyName.textContent=m.name||'';if(replyPreview)replyPreview.textContent=String(m.text||'').slice(0,140);if(replyBar)replyBar.hidden=false;}

async function copyMessageLink(id,btn){const link=`${location.origin}${location.pathname}#msg-${id}`;try{await navigator.clipboard.writeText(link);btn.textContent='✓ تم نسخ الرابط';setTimeout(()=>btn.textContent='🔗 رابط',1500);}catch{location.hash=`msg-${id}`;}}
async function reportMessage(id,btn){if(btn.dataset.done)return;btn.disabled=true;try{const r=await fetch('/api/chat/report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw new Error();btn.dataset.done='1';btn.textContent='✓ تم الإبلاغ';}catch{btn.textContent='تعذر الإبلاغ';btn.disabled=false;}}

function replyCounts(){const counts=new Map();for(const m of allMessages){if(m.replyTo)counts.set(m.replyTo,(counts.get(m.replyTo)||0)+1);}return counts;}

function makeMessage(m,counts,newIds){const item=document.createElement('article');item.className='chatMessage';if(newIds?.has(m.id))item.classList.add('is-new');item.id=`msg-${m.id}`;
  const top=document.createElement('div');top.className='chatMessageTop';
  const avatar=document.createElement('span');avatar.className='chatAvatar';avatar.textContent=avatarLetter(m.name);avatar.setAttribute('aria-hidden','true');
  const body=document.createElement('div');body.className='chatMessageBody';
  const head=document.createElement('div');head.className='chatMessageHead';
  const who=document.createElement('strong');who.textContent=m.name||'مستخدم';
  const badge=document.createElement('span');badge.className='brandTag';badge.textContent=m.category||'عام';
  const time=document.createElement('time');time.className='chatTime';time.dateTime=m.time||'';time.title=formatFullTime(m.time);time.textContent=formatTime(m.time);
  head.append(who,badge);
  const replies=counts.get(m.id)||0;if(replies){const rc=document.createElement('span');rc.className='chatReplyCount';rc.textContent=`${replies.toLocaleString('ar-LB')} رد`;head.append(rc);}
  head.append(time);body.append(head);top.append(avatar,body);item.append(top);

  if(m.replyTo){const parent=findMessage(m.replyTo);if(parent){const quote=document.createElement('button');quote.type='button';quote.className='replyQuote';quote.textContent=`↪ ${parent.name}: ${String(parent.text||'').slice(0,120)}`;quote.addEventListener('click',()=>{const p=document.getElementById(`msg-${parent.id}`);if(p){p.scrollIntoView({behavior:'smooth',block:'center'});p.classList.add('chatHighlight');setTimeout(()=>p.classList.remove('chatHighlight'),1800);}});item.append(quote);}}

  const text=document.createElement('p');text.className='chatText';text.textContent=m.text||'';item.append(text);
  const actions=document.createElement('div');actions.className='chatMessageActions';
  const reply=document.createElement('button');reply.type='button';reply.className='chatActionBtn';reply.textContent='↩ رد';reply.addEventListener('click',()=>setReply(m.id));
  const link=document.createElement('button');link.type='button';link.className='chatActionBtn';link.textContent='🔗 رابط';link.addEventListener('click',()=>copyMessageLink(m.id,link));
  const report=document.createElement('button');report.type='button';report.className='chatActionBtn reportBtn';report.textContent='⚑ إبلاغ';report.addEventListener('click',()=>reportMessage(m.id,report));
  actions.append(reply,link,report);item.append(actions);return item;
}

function renderQuickFilters(){if(!quickFilters)return;const categories=['','مناقشة عطل','طلب مخطط','BoardView','BIOS','عام'];const labels={'':'الكل','مناقشة عطل':'مناقشة عطل','طلب مخطط':'طلب مخطط','BoardView':'BoardView','BIOS':'BIOS','عام':'عام'};quickFilters.replaceChildren(...categories.map(cat=>{const b=document.createElement('button');b.type='button';b.className='chatFilterChip';if((filterEl?.value||'')===cat)b.classList.add('active');const n=cat?allMessages.filter(m=>m.category===cat).length:allMessages.length;b.append(document.createTextNode(labels[cat]));const count=document.createElement('span');count.textContent=n.toLocaleString('ar-LB');b.append(count);b.addEventListener('click',()=>{if(filterEl)filterEl.value=cat;renderQuickFilters();render({preserve:true});});return b;}));}

function render({preserve=false,newIds=new Set()}={}){const list=filteredMessages();const sig=currentSignature(list);if(sig===lastRenderSignature&&!newIds.size&&preserve)return;lastRenderSignature=sig;
  const oldTop=messagesEl.scrollTop,oldHeight=messagesEl.scrollHeight,nearBottom=isNearBottom();
  countEl&&(countEl.textContent=`${list.length.toLocaleString('ar-LB')} رسالة`);
  if(!list.length){messagesEl.innerHTML='<div class="emptyState chatEmptyHint"><strong>لا توجد رسائل مطابقة.</strong><span>جرّب تغيير البحث أو نوع المشاركة.</span></div>';return;}
  const counts=replyCounts();const nodes=[];let lastDay='';
  for(const m of list){const day=dateKey(m.time);if(day&&day!==lastDay){const d=document.createElement('div');d.className='chatDateDivider';d.textContent=dateLabel(m.time);nodes.push(d);lastDay=day;}nodes.push(makeMessage(m,counts,newIds));}
  messagesEl.replaceChildren(...nodes);
  if(nearBottom&&!preserve){messagesEl.scrollTop=messagesEl.scrollHeight;}else if(preserve){messagesEl.scrollTop=oldTop+Math.max(0,messagesEl.scrollHeight-oldHeight);}
  if(!hashHandled&&location.hash.startsWith('#msg-')){hashHandled=true;setTimeout(()=>{let target=null;try{target=document.querySelector(location.hash);}catch{}if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.add('chatHighlight');setTimeout(()=>target.classList.remove('chatHighlight'),2500);}},100);}
}

function updateNewButton(){if(!newBtn)return;newBtn.hidden=unseenCount<=0;newBtn.textContent=unseenCount>0?`↓ ${unseenCount.toLocaleString('ar-LB')} رسالة جديدة`:'↓ رسائل جديدة';}
function jumpToLatest(){unseenCount=0;updateNewButton();messagesEl.scrollTo({top:messagesEl.scrollHeight,behavior:'smooth'});}

async function loadMessages(showError=false){if(document.hidden&&!showError)return;const wasNearBottom=isNearBottom();try{const r=await fetch('/api/chat/messages',{cache:'no-store'});if(!r.ok)throw new Error();const data=await r.json();const next=Array.isArray(data.messages)?data.messages:[];const nextIds=new Set(next.map(m=>m.id));const newIds=new Set(initialized?next.filter(m=>!previousIds.has(m.id)).map(m=>m.id):[]);allMessages=next;previousIds=nextIds;renderQuickFilters();restoreReplyUi();render({preserve:initialized&&!wasNearBottom,newIds});if(initialized&&newIds.size){if(wasNearBottom){setTimeout(()=>messagesEl.scrollTo({top:messagesEl.scrollHeight,behavior:'smooth'}),30);}else{unseenCount+=newIds.size;updateNewButton();}}else if(!initialized){messagesEl.scrollTop=messagesEl.scrollHeight;}initialized=true;setLive(true);}catch{setLive(false);if(showError||!initialized)messagesEl.innerHTML='<div class="emptyState">تعذر تحميل الرسائل. أعد المحاولة بعد قليل.</div>';}}

form.addEventListener('submit',async e=>{e.preventDefault();const name=String(nameEl?.value||'').trim(),text=String(messageEl?.value||'').trim();if(name.length<2||text.length<2)return;sendBtn.disabled=true;statusEl.textContent='جاري الإرسال...';try{const r=await fetch('/api/chat/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,category:categoryEl.value,text,replyTo,website:document.getElementById('website')?.value||''})});const data=await r.json();if(!r.ok)throw new Error(data.error||'تعذر الإرسال.');try{localStorage.setItem(NAME_KEY,name);}catch{}messageEl.value='';clearReply();clearDraft();updateCharCount();statusEl.textContent='✓ تم إرسال الرسالة.';await loadMessages(true);jumpToLatest();}catch(err){statusEl.textContent=err.message||'تعذر الإرسال.';}finally{sendBtn.disabled=false;}});

messageEl?.addEventListener('input',()=>{updateCharCount();saveDraft();});
messageEl?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();form.requestSubmit();}});
categoryEl?.addEventListener('change',saveDraft);
searchEl?.addEventListener('input',()=>render({preserve:true}));
filterEl?.addEventListener('change',()=>{renderQuickFilters();render({preserve:true});});
document.getElementById('cancelReply')?.addEventListener('click',clearReply);
document.getElementById('refreshBtn')?.addEventListener('click',()=>loadMessages(true));
newBtn?.addEventListener('click',jumpToLatest);
jumpBtn?.addEventListener('click',jumpToLatest);
messagesEl.addEventListener('scroll',()=>{if(isNearBottom()&&unseenCount){unseenCount=0;updateNewButton();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadMessages(false);});
window.addEventListener('beforeunload',saveDraft);

loadMessages(true);
pollTimer=setInterval(()=>loadMessages(false),POLL_MS);
})();
