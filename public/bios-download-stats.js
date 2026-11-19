(()=>{
  if(!location.pathname.startsWith("/bios/"))return;
  function track(event){
    if(event.type==="auxclick"&&event.button!==1||event.type==="click"&&event.button!==0)return;
    const a=event.target.closest?.("a[href]");if(!a)return;
    let u;try{u=new URL(a.href);}catch{return;}
    if(u.origin!=="https://github.com"||!/^\/DarkEchoProject\/pc-board-repair\/releases\/download\/bios-archive-\d+\/.+/.test(u.pathname)||u.search||u.hash)return;
    fetch("/api/stats/bios-request?url="+encodeURIComponent(u.href),{method:"POST",keepalive:true,cache:"no-store"}).catch(()=>{});
  }
  document.addEventListener("click",track,true);
  document.addEventListener("auxclick",track,true);
})();
