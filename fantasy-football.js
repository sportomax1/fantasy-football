/* Fantasy Lens v23 — 3-file GitHub Pages build.
   Core is pinned to the last verified consolidated build; this file adds the
   depth drafted/available controls and historical-cache self repair. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@9c359b20027bc396b9f24872a66777d04f0704eb/fantasy-football.js"><\/script>');

let depthDraftFilter=localStorage.getItem('fantasyLensDepthDraftFilter')||'all';

function installDepthDraftFilters(){
  const bar=document.querySelector('.depthToolbar');
  if(!bar||document.querySelector('#depthDraftFilters'))return;
  const box=document.createElement('span');
  box.id='depthDraftFilters';
  box.style.cssText='display:inline-flex;gap:6px;align-items:center';
  box.innerHTML='<button class="btn depthDraftFilter" data-df="all">All</button><button class="btn depthDraftFilter" data-df="available">Available</button><button class="btn depthDraftFilter" data-df="drafted">Drafted</button>';
  const search=document.querySelector('#depthSearch');
  bar.insertBefore(box,search||null);
  box.querySelectorAll('button').forEach(b=>{
    b.classList.toggle('on',b.dataset.df===depthDraftFilter);
    b.onclick=()=>{
      depthDraftFilter=b.dataset.df;
      localStorage.setItem('fantasyLensDepthDraftFilter',depthDraftFilter);
      box.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
      applyDepthDraftFilter();
    };
  });
}

function draftedNameSet(){
  try{return new Set(players.filter(p=>draftedIds.has(String(p.id))).map(p=>String(p.name||'').toLowerCase()).filter(Boolean))}
  catch{return new Set()}
}

function applyDepthDraftFilter(){
  installDepthDraftFilters();
  const root=document.querySelector('#depthResults');
  if(!root)return;
  const names=draftedNameSet();
  const candidates=root.querySelectorAll('[data-player-id],[data-player-name],.depthPlayer,.depth-player,.depthChip,.depth-chip,.depthName,.depth-name');
  candidates.forEach(el=>{
    const id=String(el.dataset.playerId||el.dataset.espnId||'');
    const txt=String(el.dataset.playerName||el.textContent||'').toLowerCase();
    const drafted=(id&&draftedIds.has(id))||[...names].some(n=>n&&txt.includes(n));
    el.dataset.drafted=drafted?'1':'0';
    el.style.opacity=drafted?'.42':'';
    el.style.textDecoration=drafted?'line-through':'';
    const hide=(depthDraftFilter==='drafted'&&!drafted)||(depthDraftFilter==='available'&&drafted);
    el.style.display=hide?'none':'';
  });
  // If depth cards are team/position containers rather than player nodes, hide
  // individual child rows by matching known player names.
  root.querySelectorAll('tr,li,.player,.depthRow,.depth-row').forEach(el=>{
    const txt=String(el.textContent||'').toLowerCase();
    const drafted=[...names].some(n=>n&&txt.includes(n));
    if(!drafted&&depthDraftFilter==='all')return;
    if(drafted){el.style.opacity='.42';el.style.textDecoration='line-through'}
    const hide=(depthDraftFilter==='drafted'&&!drafted)||(depthDraftFilter==='available'&&drafted);
    el.style.display=hide?'none':'';
  });
}

async function ensureHistoricalViews(force=false){
  try{
    if(!players.length){
      const cur=await cacheGet('season:2026');
      if(cur?.value?.length){seasonData[2026]=cur.value;players=cur.value;finalizePlayers(players)}
    }
    for(const y of [2021,2022,2023,2024,2025]){
      if(seasonData[y]?.length&&!force)continue;
      const hit=await cacheGet('season:'+y);
      if(hit?.value?.length){seasonData[y]=hit.value;continue}
      try{
        const rows=await fetchSeason(y);
        if(rows?.length)await cachePut('season:'+y,rows);
      }catch(e){console.warn('Fantasy Lens historical cache repair failed for',y,e)}
    }
    // Health is derived from weekly history and can become stale/empty independently
    // of the season cache. Rebuild it when the current player set has no usable health.
    const hasHealth=players.some(p=>p.healthPct!=null&&Number(p.healthPct)>0);
    if(players.length&&(!hasHealth||force)){
      try{await enrichHealth(2026)}catch(e){console.warn('Fantasy Lens health repair failed',e)}
    }
    render();
  }catch(e){console.warn('Fantasy Lens cache hydration failed',e)}
}

window.addEventListener('load',()=>{
  installDepthDraftFilters();
  const root=document.querySelector('#depthResults');
  if(root)new MutationObserver(()=>applyDepthDraftFilter()).observe(root,{childList:true,subtree:true});
  document.querySelector('#exploreBtn')?.addEventListener('click',()=>setTimeout(applyDepthDraftFilter,25));
  document.querySelector('#runDepth')?.addEventListener('click',()=>setTimeout(applyDepthDraftFilter,400));
  document.querySelector('#depthSearch')?.addEventListener('input',()=>setTimeout(applyDepthDraftFilter,0));
  document.querySelectorAll('#viewNav [data-view]').forEach(b=>b.addEventListener('click',()=>{
    if(['overview','matrix','health'].includes(b.dataset.view))ensureHistoricalViews(false);
  }));
  setTimeout(()=>{
    try{if(['overview','matrix','health'].includes(currentView))ensureHistoricalViews(false)}catch{}
    applyDepthDraftFilter();
  },300);
});
