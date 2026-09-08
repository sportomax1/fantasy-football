/* Fantasy Lens v30 bootstrap — hardened analysis-nav activation and click routing. */
(function(){
  const V27_URL='https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@e5105c1489b246674a8c960c53cdfeb46e3b3c27/fantasy-football.js';
  let retried=false;

  // Load the immutable advanced layer synchronously. It in turn loads the
  // established base layers, preserving the three-file repository layout.
  document.write('<script src="'+V27_URL+'"><\/script>');

  function ensureFinalNav(){
    const nav=document.querySelector('#viewNav');
    if(!nav)return false;

    const specs=[
      ['draft','Draft Board'],
      ['overview','Overview'],
      ['matrix','Year Matrix'],
      ['health','Health'],
      ['weekly','Weekly Matchups']
    ];
    const desired=[];

    for(const [view,label] of specs){
      let b=nav.querySelector(`[data-view="${view}"]`);
      if(!b){
        b=document.createElement('button');
        b.className='btn';
        b.dataset.view=view;
      }
      b.textContent=label;
      desired.push(b);
    }

    const depth=document.querySelector('#exploreBtn');
    const defense=document.querySelector('#defenseBtn');
    const kicker=document.querySelector('#kickerBtn');
    if(depth){depth.textContent='Depth';depth.classList.add('btn');desired.push(depth)}
    if(defense){defense.textContent='Defense';defense.classList.add('btn','dataViewBtn');desired.push(defense)}
    if(kicker){kicker.textContent='Kicker';kicker.classList.add('btn','dataViewBtn');desired.push(kicker)}

    // Remove legacy header copies if an older chained layer created them.
    document.querySelector('.appbarInner #exploreBtn')?.remove();
    document.querySelector('.appbarInner #defenseBtn')?.remove();
    document.querySelector('.appbarInner #kickerBtn')?.remove();
    document.querySelector('.appbarInner #specialBtn')?.remove();

    // Reorder only when necessary. Avoid repeatedly appendChild-ing already
    // ordered nodes, which can create a MutationObserver/reflow loop.
    desired.forEach((el,i)=>{
      const at=nav.children[i];
      if(at!==el)nav.insertBefore(el,at||null);
    });
    return desired.length===8;
  }

  function wireViewTabs(){
    const nav=document.querySelector('#viewNav');
    if(!nav||typeof render!=='function')return;

    // Replace the base delegated handler with one explicit route for all five
    // data views. Depth/Defense/Kicker keep their dedicated modal handlers.
    nav.onclick=e=>{
      const b=e.target.closest('[data-view]');
      if(!b||!nav.contains(b))return;
      const view=b.dataset.view;
      if(!['draft','overview','matrix','health','weekly'].includes(view))return;

      currentView=view;
      localStorage.setItem('fantasyLensView',currentView);
      state.sort=currentView==='health'?'healthPct':'fantasy';
      state.dir=-1;

      render();
      if(['overview','matrix','health'].includes(view)&&typeof ensureHistoricalViews==='function'){
        Promise.resolve(ensureHistoricalViews(false)).catch(err=>console.warn('historical view hydration failed',err));
      }
    };
  }

  function activateAdvancedViews(){
    try{
      if(typeof installMatchupSettings==='function')installMatchupSettings();
      if(typeof installDefenseModal==='function')installDefenseModal();
      if(typeof installKickerModal==='function')installKickerModal();
      ensureFinalNav();
      wireViewTabs();

      // Moving a DOM node preserves onclick, but explicitly restore Depth's
      // base action in case an older layer replaced it during initialization.
      if(typeof openLab==='function'&&document.querySelector('#exploreBtn'))document.querySelector('#exploreBtn').onclick=openLab;

      if(typeof render==='function')render();
      setTimeout(()=>{ensureFinalNav();wireViewTabs()},60);
    }catch(e){console.error('Fantasy Lens v30 activation failed',e)}
  }

  function advancedReady(){
    // Weekly Matchups is now static HTML, so its button alone is NOT proof
    // that the v27 advanced render layer actually initialized.
    return !!document.querySelector('#fantasyLensV27Styles') &&
      typeof render==='function' &&
      typeof installDefenseModal==='function' &&
      typeof installKickerModal==='function';
  }

  function retryAdvancedLayer(){
    if(retried){activateAdvancedViews();return}
    retried=true;
    const oldWrite=document.write;
    document.write=()=>{};
    const s=document.createElement('script');
    s.src=V27_URL+'?retry=v30-'+Date.now();
    s.onload=()=>{
      document.write=oldWrite;
      activateAdvancedViews();
    };
    s.onerror=()=>{
      document.write=oldWrite;
      console.error('Fantasy Lens v30 failed to reload advanced-view layer');
      ensureFinalNav();
      wireViewTabs();
    };
    document.body.appendChild(s);
  }

  window.addEventListener('load',()=>{
    setTimeout(()=>{
      ensureFinalNav();
      if(advancedReady())activateAdvancedViews();
      else retryAdvancedLayer();
    },100);
  });
})();

/* Fantasy Lens v31 polish — compact ALL matrix, readable special teams, smarter draft import. */
(function(){
  const DEF_KEY='fantasyLensDraftedDefenses', K_KEY='fantasyLensDraftedKickers';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const readSet=key=>{try{return new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{return new Set()}};
  const saveSet=(key,set)=>localStorage.setItem(key,JSON.stringify([...set]));
  const teamCode=v=>{const t=String(v||'').toUpperCase();return t==='WSH'?'WAS':t==='LA'?'LAR':t};

  function installPolishStyles(){
    if(document.querySelector('#fantasyLensV31Styles'))return;
    const s=document.createElement('style');s.id='fantasyLensV31Styles';s.textContent=`
      .fullDataModal .defRankTable tbody td:first-child .defTeam>span{color:#fff!important;font-weight:900!important}
      .fullDataModal .defRankTable tbody td:first-child .kickerPrimary>span>b{color:#fff!important}
      .matrixTable tr.matrixAllGroup td,.matrixTable tr.matrixAllGroupLast td{padding:2px 5px!important;height:22px!important;line-height:1!important;font-size:9px!important}
      .matrixTable tr.matrixAllGroup .miniTrend,.matrixTable tr.matrixAllGroupLast .miniTrend{height:17px!important;width:78px!important;display:block!important}
      .matrixTable tr.matrixAllGroup .trendCaption,.matrixTable tr.matrixAllGroupLast .trendCaption{display:none!important}
      .matrixTable .matrixPlayerCell{padding-top:3px!important;padding-bottom:3px!important;vertical-align:middle!important}
      .matrixTable .matrixPlayerCell .playerline{min-height:0!important;gap:5px!important}
      .matrixTable .matrixPlayerCell .head{width:28px!important;height:28px!important}
      .matrixTable .matrixMetricLabel{font-size:9px!important;line-height:1!important}
      .specialDraftedRow{opacity:.46!important}
      .specialDraftTag{display:inline-block;margin-left:7px;padding:2px 5px;border-radius:999px;background:#8c969e;color:#fff!important;font-size:8px;font-weight:900;letter-spacing:.04em}
    `;document.head.appendChild(s);
  }

  function extractPickName(line){
    let x=String(line||'').replace(/\s*\([^)]*\-\s*(?:K|DEF)\s*\)\s*$/i,'').trim();
    x=x.replace(/^\(\d+\)\s*[^-]+\-\s*/,'').trim();
    if(x.includes(',')){const [last,...rest]=x.split(','),first=rest.join(' ').trim();if(first&&last)return `${first} ${last}`.trim()}
    return x;
  }
  function isNoise(line){
    const x=String(line||'').trim();
    return /^round\s+\d+\s*$/i.test(x)||/^round by round results\s*$/i.test(x)||/^\*?\s*your team in bold\s*$/i.test(x)||/^your team\s*$/i.test(x)||/^draft results?\s*$/i.test(x);
  }

  function smartParseV31(text){
    const matched=new Map(),unmatched=[],ignored=[],special=[];
    const defSet=readSet(DEF_KEY),kSet=readSet(K_KEY);
    const roster=(window.players||((typeof players!=='undefined')?players:[])||[]).map(p=>({p,tokens:norm(p.name).split(' ').filter(Boolean)}));
    for(const raw of String(text||'').split(/\r?\n/)){
      const line=raw.trim();if(!line)continue;
      if(isNoise(line)){ignored.push(line);continue}
      const slot=line.match(/\(([A-Za-z]{2,3})\s*\-\s*(DEF|K)\s*\)/i);
      if(slot){
        const team=teamCode(slot[1]),kind=slot[2].toUpperCase();
        if(kind==='DEF'){
          defSet.add(team);special.push(`DEF ${team}`);continue;
        }
        const name=extractPickName(line),key=norm(name);
        if(key){kSet.add(key);special.push(`${name} (${team} K)`);continue}
      }
      const lineTokens=new Set(norm(line).split(' ').filter(Boolean));
      const hits=roster.filter(x=>x.tokens.length>=2&&x.tokens.every(t=>lineTokens.has(t)));
      if(hits.length){for(const x of hits)matched.set(String(x.p.id),x.p)}else unmatched.push(line);
    }
    saveSet(DEF_KEY,defSet);saveSet(K_KEY,kSet);
    return{matched:[...matched.values()],unmatched,ignored,special};
  }

  async function fixedImportV31(){
    const status=document.querySelector('#draftImportStatus'),box=document.querySelector('#draftImportText');if(!status||!box)return;
    const text=box.value;if(!text.trim()){status.textContent='Paste draft results first.';return}
    if(typeof players!=='undefined'&&!players.length){
      status.textContent='Player data is not loaded yet. Loading it now…';document.querySelector('#run')?.click();
      for(let i=0;i<60&&!players.length;i++)await new Promise(r=>setTimeout(r,500));
      if(!players.length){status.textContent='Could not load the player database. Tap LOAD DATA, then retry the import.';return}
    }
    const res=smartParseV31(text);
    for(const p of res.matched)draftedIds.add(String(p.id));
    if(typeof saveDrafted==='function')saveDrafted();if(typeof render==='function')render();
    if(typeof depthData!=='undefined'&&depthData&&document.querySelector('#exploreModal')?.classList.contains('open')&&typeof renderDepthMatrix==='function')renderDepthMatrix(depthData);
    decorateSpecialDrafted();
    const names=res.matched.map(p=>`${p.name} (${p.pos} ${p.team})`);
    status.textContent=`Matched ${res.matched.length} skill player${res.matched.length===1?'':'s'} and marked drafted.`+
      (res.special.length?`\nRecognized ${res.special.length} K/DEF pick${res.special.length===1?'':'s'} separately.`:'')+
      (names.length?`\n\nMATCHED PLAYERS:\n${names.join('\n')}`:'')+
      (res.special.length?`\n\nK / DEF:\n${res.special.join('\n')}`:'')+
      (res.ignored.length?`\n\nIgnored ${res.ignored.length} draft-format header/round line${res.ignored.length===1?'':'s'}.`:'')+
      (res.unmatched.length?`\n\nStill unmatched (${res.unmatched.length}):\n${res.unmatched.slice(0,30).join('\n')}`:'\n\nNo unexplained lines remain.');
  }

  function decorateSpecialDrafted(){
    const defs=readSet(DEF_KEY),ks=readSet(K_KEY);
    document.querySelectorAll('#defenseHistoryTable tbody tr').forEach(tr=>{
      const team=teamCode(tr.querySelector('.defTeam>span')?.textContent.trim());const on=defs.has(team);tr.classList.toggle('specialDraftedRow',on);
      const cell=tr.querySelector('.defTeam');if(on&&cell&&!cell.querySelector('.specialDraftTag'))cell.insertAdjacentHTML('beforeend','<span class="specialDraftTag">DRAFTED</span>');
    });
    document.querySelectorAll('#kickerTable tbody tr').forEach(tr=>{
      const name=norm(tr.querySelector('.kickerPrimary small')?.textContent||'');const on=name&&ks.has(name);tr.classList.toggle('specialDraftedRow',on);
      const cell=tr.querySelector('.kickerPrimary');if(on&&cell&&!cell.querySelector('.specialDraftTag'))cell.insertAdjacentHTML('beforeend','<span class="specialDraftTag">DRAFTED</span>');
    });
  }

  function wireSpecialRefresh(){
    for(const id of ['defenseBtn','kickerBtn']){
      const b=document.querySelector('#'+id);if(!b||b.dataset.v31Wrapped==='1')continue;
      const old=b.onclick;b.dataset.v31Wrapped='1';b.onclick=function(e){const out=old?.call(this,e);let n=0;const t=setInterval(()=>{decorateSpecialDrafted();if(++n>=20)clearInterval(t)},150);return out};
    }
  }

  function resetAllDraftedV31(){
    const defs=readSet(DEF_KEY),ks=readSet(K_KEY),skill=(typeof draftedIds!=='undefined'?draftedIds.size:0),total=skill+defs.size+ks.size;if(!total)return;
    if(!confirm(`Clear all ${total} drafted player/team selections?`))return;
    if(typeof draftedIds!=='undefined')draftedIds.clear();saveSet(DEF_KEY,new Set());saveSet(K_KEY,new Set());
    if(typeof saveDrafted==='function')saveDrafted();const d=document.querySelector('#draftedOnly');if(d)d.checked=false;localStorage.setItem('fantasyLensDraftedOnly','false');
    if(typeof render==='function')render();if(typeof depthData!=='undefined'&&depthData&&document.querySelector('#exploreModal')?.classList.contains('open')&&typeof renderDepthMatrix==='function')renderDepthMatrix(depthData);decorateSpecialDrafted();
  }

  function activateV31(){
    installPolishStyles();
    const dm=document.querySelector('#defenseModal .modalhead h2');if(dm)dm.textContent='Defense';
    const km=document.querySelector('#kickerModal .modalhead h2');if(km)km.textContent='Kicker';
    window.parseDraftText=smartParseV31;window.applyDraftImport=fixedImportV31;
    const p=document.querySelector('#parseDraftBtn');if(p)p.onclick=fixedImportV31;
    const r=document.querySelector('#resetDraft');if(r)r.onclick=resetAllDraftedV31;
    wireSpecialRefresh();decorateSpecialDrafted();
  }

  window.addEventListener('load',()=>{setTimeout(activateV31,450);setTimeout(activateV31,1200)});
})();