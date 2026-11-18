(() => {
  fetch("/api/site/notice",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(s=>{
    if(!s?.enabled||!s.text)return;
    const banner=document.createElement("aside");banner.setAttribute("role","status");banner.dir="rtl";
    const tones={info:["#0c4770","#d7f6ff"],warning:["#754710","#fff2cd"],success:["#14553b","#d7ffec"]};
    const [bg,fg]=tones[s.tone]||tones.info;
    banner.style.cssText="padding:12px 20px;text-align:center;font-weight:700;line-height:1.65;overflow-wrap:anywhere;background:"+bg+";color:"+fg;
    banner.textContent="📢 "+s.text;
    const header=document.querySelector("header");if(header)header.after(banner);else document.body.prepend(banner);
  }).catch(()=>{});
})();