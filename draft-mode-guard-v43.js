/* Fantasy Lens v43 — hard separation between Draft Board and Best Available. */
(function(){
  'use strict';
  const MODE_KEY='fantasyLensDraftMainModeV35';

  function applyMode(mode){
    const isBest=mode==='best';
    localStorage.setItem(MODE_KEY,isBest?'best':'board');
    const best=document.querySelector('#bestStrip');
    const table=document.querySelector('#tablewrap');
    const cards=document.querySelector('#cards');
    const status=document.querySelector('.status');
    if(best)best.style.display=isBest?'block':'none';
    if(table)table.style.display=isBest?'none':'';
    if(cards)cards.style.display=isBest?'none':'';
    if(status)status.style.display=isBest?'none':'';
    document.querySelector('#viewNav [data-view="draft"]')?.classList.toggle('on',!isBest);
    document.querySelector('#bestAvailableMainV36')?.classList.toggle('on',isBest);
    document.querySelector('#v42nav [data-a="draft"]')?.classList.toggle('on',!isBest);
    document.querySelector('#v42nav [data-a="best"]')?.classList.toggle('on',isBest);
  }

  function install(){
    const nav=document.querySelector('#v42nav');
    if(!nav){setTimeout(install,300);return;}
    if(nav.dataset.modeGuardV43)return;
    nav.dataset.modeGuardV43='1';
    nav.addEventListener('click',e=>{
      const b=e.target.closest('[data-a]');
      if(!b)return;
      if(b.dataset.a==='draft'){
        applyMode('board');
        setTimeout(()=>applyMode('board'),40);
      }else if(b.dataset.a==='best'){
        applyMode('best');
        setTimeout(()=>applyMode('best'),40);
      }
    },true);
    applyMode(localStorage.getItem(MODE_KEY)==='best'?'best':'board');
  }

  new MutationObserver(()=>{
    const mode=localStorage.getItem(MODE_KEY)==='best'?'best':'board';
    const best=document.querySelector('#bestStrip');
    const table=document.querySelector('#tablewrap');
    if(best&&table){
      if(mode==='best'&&best.style.display==='none')applyMode('best');
      if(mode==='board'&&best.style.display!=='none')applyMode('board');
    }
  }).observe(document.documentElement,{childList:true,subtree:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();