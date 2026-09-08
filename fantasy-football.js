/* Fantasy Lens v36 — unified nav, visual polish, special-team media, matrix gradients, stable depth controls. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@8a20bc1b98e161bb444596b9138e50835601fa5c/fantasy-football.js"><\/script>');

(function(){
  const MATRIX_GRAD_KEY='fantasyLensMatrixGradientV36';
  const DEPTH_FILTER_KEY='fantasyLensDepthDraftFilter';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const teamCode=v=>{const t=String(v||'').toUpperCase().trim();return t==='WSH'?'WAS':t==='LA'?'LAR':t};
  const teamLogo=t=>`https://a.espncdn.com/i/teamlogos/nfl/500/${teamCode(t)==='WAS'?'wsh':teamCode(t).toLowerCase()}.png`;
  const sleeperFace=id=>id?`https://sleepercdn.com/content/nfl/players/${encodeURIComponent(id)}.jpg`:'';
  let renderWrapped=false,dirPromise=null,depthObserver=null,depthTimer=null,depthApplying=false;

  function addStyles(){
    if(document.querySelector('#fantasyLensV36Styles'))return;
    const s=document.createElement('style');s.id='fantasyLensV36Styles';s.textContent=`
      body,.field,.btn,input,select,textarea,button,table{font-family:"Segoe UI Variable","Aptos","Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif!important}
      body{letter-spacing:-.006em}.btn{font-weight:700!important}.viewNav .btn{font-weight:750!important;letter-spacing:-.012em}.appTitle b,h1,h2,h3,b,strong,.name{font-weight:750!important}.webHint,small,.cacheState{letter-spacing:0!important}
      #draftModeTabsV35{display:none!important}
      #bestAvailableMainV36.on{background:var(--navy)!important;color:#fff!important}
      .specialFaceV36{width:34px!important;height:34px!important;border-radius:9px!important;object-fit:cover!important;background:#edf0ed!important;flex:0 0 auto}
      #kickerTable .kickerPrimary{display:flex!important;align-items:center!important;gap:7px!important}
      #kickerTable .kickerPrimary>img:first-child{width:24px!important;height:24px!important;object-fit:contain!important;flex:0 0 auto}
      #defenseHistoryTable .defTeam>img:first-child{display:block!important;visibility:visible!important;width:27px!important;height:27px!important;object-fit:contain!important}
      .bestAvailMediaV35 .dstMainLogoV36{width:29px!important;height:29px!important;object-fit:contain!important;background:transparent!important;border-radius:0!important}
      .bestAvailMediaV35 .kickerFaceV36{width:30px!important;height:30px!important;border-radius:8px!important;object-fit:cover!important;background:#edf0ed!important}
      .matrixGradientBtnV36.on{background:var(--navy)!important;color:#fff!important}.matrixGradV36{transition:background-color .12s ease,box-shadow .12s ease}.matrixGradV36 b{color:inherit!important}
      #depthDraftFilters .depthDraftFilter.on{background:var(--navy)!important;color:#fff!important}.depthDraftToggleV36{margin-left:auto!important;padding:3px 5px!important;font-size:7px!important;line-height:1!important;flex:0 0 auto}.depthDraftToggleV36.on{background:#687684!important;color:#fff!important}.depthDraftedV36{opacity:.42!important;filter:grayscale(1)}.depthDraftedV36 b{text-decoration:none!important}.depthMini,.depthSlotPlayer{gap:6px!important}.depthToolbar{align-items:center!important;flex-wrap:wrap!important}.depthToolbar #depthSearch{min-width:220px!important}.depthFilterSummaryV36{font-size:8px;color:var(--muted);margin-left:auto}
      @media(max-width:900px){.viewNav{gap:4px}.viewNav .btn{font-size:9px!important}.depthToolbar #depthSearch{min-width:150px!important;width:100%!important}}
    `;document.head.appendChild(s);
  }

  function getDirectory(){
    if(dirPromise)return dirPromise;
    dirPromise=(async()=>{
      try{
        if(typeof loadSleeperDirectory==='function')return await loadSleeperDirectory(false);
        const r=await fetch('https://api.sleeper.app/v1/players/nfl');return r.ok?await r.json():{};
      }catch(e){console.warn('player directory unavailable',e);return{}}
    })();
    return dirPromise;
  }

  function setNavLabels(){
    const nav=document.querySelector('#viewNav');if(!nav)return;
    const labels={draft:'📋 Draft Board',overview:'👀 Overview',matrix:'📊 Year Matrix',health:'🩺 Health',weekly:'📅 Weekly Matchups'};
    nav.querySelectorAll('[data-view]').forEach(b=>{if(labels[b.dataset.view])b.textContent=labels[b.dataset.view]});
    const depth=document.querySelector('#exploreBtn'),def=document.querySelector('#defenseBtn'),kick=document.querySelector('#kickerBtn'),league=document.querySelector('#leagueDraftMainV35'),mine=document.querySelector('#myTeamBtnV35');
    if(depth)depth.textContent='🪜 Depth';if(def)def.textContent='🛡️ Defense';if(kick)kick.textContent='🥾 Kicker';if(league)league.textContent='🏆 League Draft';if(mine)mine.textContent='👤 My Team';
  }

  function draftModeButton(mode){return document.querySelector(`#draftModeTabsV35 [data-draft-mode="${mode}"]`)}
  function setDraftMode(mode){const b=draftModeButton(mode);if(b)b.click();else{try{localStorage.setItem('fantasyLensDraftMainModeV35',mode)}catch{}}setTimeout(syncNavState,0)}
  function ensureMainBestTab(){
    const nav=document.querySelector('#viewNav'),draft=nav?.querySelector('[data-view="draft"]');if(!nav||!draft)return;
    let best=document.querySelector('#bestAvailableMainV36');if(!best){best=document.createElement('button');best.className='btn';best.id='bestAvailableMainV36';best.type='button';draft.insertAdjacentElement('afterend',best)}
    best.textContent='⭐ Best Available';
    best.onclick=()=>{
      if(typeof currentView!=='undefined'&&currentView!=='draft'){
        currentView='draft';localStorage.setItem('fantasyLensView','draft');
        if(typeof state!=='undefined'){state.sort='fantasy';state.dir=-1}
        if(typeof render==='function')render();
      }
      setDraftMode('best');
    };
    if(!draft.dataset.v36Mode){draft.dataset.v36Mode='1';draft.addEventListener('click',()=>setTimeout(()=>setDraftMode('board'),0))}
    const hidden=document.querySelector('#draftModeTabsV35');if(hidden)hidden.style.display='none';
    setNavLabels();syncNavState();
  }
  function syncNavState(){
    const best=document.querySelector('#bestAvailableMainV36'),draft=document.querySelector('#viewNav [data-view="draft"]'),isDraft=typeof currentView==='undefined'||currentView==='draft',mode=localStorage.getItem('fantasyLensDraftMainModeV35')||'board';
    if(best)best.classList.toggle('on',isDraft&&mode==='best');
    if(draft)draft.classList.toggle('on',isDraft&&mode!=='best');
    if(!isDraft&&best)best.classList.remove('on');
  }

  async function decorateSpecialMedia(){
    const dir=await getDirectory(),byName=new Map();
    for(const [id,p] of Object.entries(dir||{})){
      const full=p?.full_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ');if(full)byName.set(norm(full),{id,p});
    }
    document.querySelectorAll('#kickerTable tbody tr').forEach(tr=>{
      const cell=tr.querySelector('.kickerPrimary');if(!cell)return;cell.querySelectorAll('.specialFaceV36').forEach(x=>x.remove());
      const name=cell.querySelector('small')?.textContent||'',hit=byName.get(norm(name));if(!hit)return;
      const img=document.createElement('img');img.className='specialFaceV36';img.alt='';img.src=sleeperFace(hit.id);img.onerror=()=>img.style.display='none';const teamImg=cell.querySelector(':scope > img');if(teamImg)teamImg.insertAdjacentElement('afterend',img);else cell.prepend(img);
    });
    document.querySelectorAll('#defenseHistoryTable tbody tr').forEach(tr=>{
      const cell=tr.querySelector('.defTeam');if(!cell)return;const txt=cell.querySelector(':scope > span')?.textContent||'',team=teamCode(txt);if(!team)return;let img=cell.querySelector(':scope > img');if(!img){img=document.createElement('img');cell.prepend(img)}img.src=teamLogo(team);img.style.display='';img.style.visibility='visible';img.onerror=()=>img.style.visibility='hidden';
    });
    document.querySelectorAll('#bestStrip .bestAvailColV33').forEach(col=>{
      const title=col.querySelector('.bestAvailTitleV33')?.textContent.trim().toUpperCase();
      col.querySelectorAll('.bestAvailWhoV33').forEach(who=>{
        const media=who.querySelector('.bestAvailMediaV35'),name=who.querySelector('b')?.textContent.trim()||'',small=who.querySelector('small')?.textContent||'';if(!media)return;
        if(title==='D/ST'){
          const team=teamCode((name.match(/^([A-Z]{2,3})\b/)||[])[1]||'');if(!team)return;media.innerHTML=`<img class="dstMainLogoV36" src="${teamLogo(team)}" alt="" onerror="this.style.visibility='hidden'">`;
        }else if(title==='K'){
          const hit=byName.get(norm(name));if(!hit)return;const team=teamCode(hit.p?.team||(small.match(/^([A-Z]{2,3})\b/)||[])[1]||'');media.innerHTML=`<img class="kickerFaceV36" src="${sleeperFace(hit.id)}" alt="" onerror="this.style.visibility='hidden'">${team?`<img class="logoV35" src="${teamLogo(team)}" alt="" onerror="this.style.visibility='hidden'">`:''}`;
        }
      });
    });
  }

  function matrixGradientEnabled(){return localStorage.getItem(MATRIX_GRAD_KEY)!=='off'}
  function ensureMatrixGradient(){
    const tools=document.querySelector('#matrixTools');if(!tools||typeof currentView!=='undefined'&&currentView!=='matrix')return;
    let b=tools.querySelector('.matrixGradientBtnV36');if(!b){b=document.createElement('button');b.className='btn matrixGradientBtnV36';b.type='button';b.onclick=()=>{localStorage.setItem(MATRIX_GRAD_KEY,matrixGradientEnabled()?'off':'on');ensureMatrixGradient();applyMatrixGradient()};tools.appendChild(b)}
    b.textContent='🎨 Gradients';b.classList.toggle('on',matrixGradientEnabled());b.title='Color numeric Year Matrix cells from weaker to stronger within each stat row';
  }
  function parseCellNum(td){const t=String(td?.textContent||'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return t?Number(t[0]):null}
  function colorCells(cells,invert){
    const vals=cells.map(parseCellNum),good=vals.filter(Number.isFinite);if(!good.length)return;const min=Math.min(...good),max=Math.max(...good),den=max-min||1;
    cells.forEach((td,i)=>{const v=vals[i];if(!Number.isFinite(v))return;let q=(v-min)/den;if(invert)q=1-q;const hue=Math.round(q*120);td.classList.add('matrixGradV36');td.style.backgroundColor=`hsl(${hue} 65% 91%)`;td.style.boxShadow=`inset 0 -2px 0 hsl(${hue} 58% 48% / .45)`});
  }
  function clearMatrixGradient(){document.querySelectorAll('.matrixGradV36').forEach(td=>{td.classList.remove('matrixGradV36');td.style.backgroundColor='';td.style.boxShadow=''})}
  function applyMatrixGradient(){
    clearMatrixGradient();if(!matrixGradientEnabled()||typeof currentView!=='undefined'&&currentView!=='matrix')return;
    const table=document.querySelector('.matrixTable');if(!table)return;const active=document.querySelector('#matrixTools .matrixMetric.on')?.dataset.metric||'';
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.querySelectorAll(':scope > td')],label=tr.querySelector('.matrixMetricLabel');let targets=[],metric=active;
      if(label){metric=norm(label.textContent);const idx=cells.indexOf(label),after=cells.slice(idx+1);targets=[...after.slice(0,6),after.at(-1)].filter(Boolean)}
      else targets=[...cells.slice(1,7),cells.at(-1)].filter(Boolean);
      const invert=metric==='turnovers'||metric==='to';colorCells(targets,invert);
    });
  }

  function playerForDepthCard(card){
    const b=card.querySelector('b');if(!b||typeof players==='undefined')return null;const name=norm(b.textContent.replace(/drafted/ig,''));if(!name)return null;return players.find(p=>norm(p.name)===name)||null;
  }
  function depthFilter(){return localStorage.getItem(DEPTH_FILTER_KEY)||'all'}
  function bindDepthFilterBox(){
    let box=document.querySelector('#depthDraftFilters'),bar=document.querySelector('.depthToolbar'),search=document.querySelector('#depthSearch');if(!bar)return;
    if(box&&!box.dataset.v36){const fresh=box.cloneNode(true);box.replaceWith(fresh);box=fresh}
    if(!box){box=document.createElement('span');box.id='depthDraftFilters';box.innerHTML='<button class="btn depthDraftFilter" data-df="all">All</button><button class="btn depthDraftFilter" data-df="available">Available</button><button class="btn depthDraftFilter" data-df="drafted">Drafted</button>';bar.insertBefore(box,search||null)}
    box.dataset.v36='1';box.querySelectorAll('[data-df]').forEach(b=>{b.classList.toggle('on',b.dataset.df===depthFilter());b.onclick=()=>{localStorage.setItem(DEPTH_FILTER_KEY,b.dataset.df);scheduleDepth(0)}});
    let summary=bar.querySelector('.depthFilterSummaryV36');if(!summary){summary=document.createElement('span');summary.className='depthFilterSummaryV36';bar.appendChild(summary)}
  }
  function observeDepth(root){
    depthObserver?.disconnect();depthObserver=new MutationObserver(()=>scheduleDepth(35));depthObserver.observe(root,{childList:true,subtree:true});
  }
  function stabilizeDepthRoot(){
    let root=document.querySelector('#depthResults');if(!root)return null;
    if(!root.dataset.v36Stable){const clone=root.cloneNode(true);clone.dataset.v36Stable='1';root.replaceWith(clone);root=clone}
    observeDepth(root);bindDepthFilterBox();return root;
  }
  function scheduleDepth(ms=20){clearTimeout(depthTimer);depthTimer=setTimeout(applyDepthStable,ms)}
  function applyDepthStable(){
    if(depthApplying)return;depthApplying=true;let root=document.querySelector('#depthResults');if(!root){depthApplying=false;return}if(!root.dataset.v36Stable)root=stabilizeDepthRoot();depthObserver?.disconnect();bindDepthFilterBox();const filter=depthFilter();let total=0,shown=0;
    root.querySelectorAll('.depthMini,.depthSlotPlayer').forEach(card=>{
      total++;card.querySelectorAll('.depthDraftToggleV33,.depthDraftToggleV36,.depthDraftTag').forEach(x=>x.remove());const p=playerForDepthCard(card),drafted=!!(p&&draftedIds.has(String(p.id)));card.classList.remove('depthDraftedV33');card.classList.toggle('depthDraftedV36',drafted);
      const visible=filter==='all'||(filter==='drafted'&&drafted)||(filter==='available'&&!drafted);card.style.display=visible?'':'none';if(visible)shown++;
      if(p){const b=document.createElement('button');b.type='button';b.className='btn depthDraftToggleV36'+(drafted?' on':'');b.textContent=drafted?'Drafted':'Draft';b.onclick=e=>{e.stopPropagation();if(typeof toggleDraft==='function')toggleDraft(String(p.id));scheduleDepth(0)};card.appendChild(b)}
    });
    root.querySelectorAll('tr').forEach(tr=>{const cards=[...tr.querySelectorAll('.depthMini,.depthSlotPlayer')];if(cards.length&&filter!=='all')tr.style.display=cards.some(c=>c.style.display!=='none')?'':'none';else tr.style.display=''});
    document.querySelectorAll('#depthDraftFilters [data-df]').forEach(b=>b.classList.toggle('on',b.dataset.df===filter));const summary=document.querySelector('.depthFilterSummaryV36');if(summary)summary.textContent=`${shown}/${total} players shown`;
    depthApplying=false;observeDepth(root);
  }
  function installDepthAudit(){
    const run=document.querySelector('#runDepth'),open=document.querySelector('#exploreBtn'),search=document.querySelector('#depthSearch');
    if(open&&!open.dataset.v36Depth){open.dataset.v36Depth='1';open.addEventListener('click',()=>scheduleDepth(220))}
    if(run&&!run.dataset.v36Depth){run.dataset.v36Depth='1';run.addEventListener('click',()=>scheduleDepth(650))}
    if(search&&!search.dataset.v36Depth){search.dataset.v36Depth='1';search.addEventListener('input',()=>scheduleDepth(35))}
    stabilizeDepthRoot();scheduleDepth(0);
  }

  function wrapRender(){
    if(renderWrapped||typeof window.render!=='function')return;const old=window.render;window.render=function(){const out=old.apply(this,arguments);setTimeout(()=>{ensureMainBestTab();setNavLabels();syncNavState();ensureMatrixGradient();applyMatrixGradient();decorateSpecialMedia()},0);return out};renderWrapped=true;
  }
  function wireSpecialOpenRefresh(){
    for(const id of ['defenseBtn','kickerBtn']){const b=document.querySelector('#'+id);if(!b||b.dataset.v36Media)continue;b.dataset.v36Media='1';b.addEventListener('click',()=>{setTimeout(decorateSpecialMedia,200);setTimeout(decorateSpecialMedia,900)})}
  }

  function activate(){
    addStyles();ensureMainBestTab();setNavLabels();wrapRender();wireSpecialOpenRefresh();ensureMatrixGradient();applyMatrixGradient();decorateSpecialMedia();installDepthAudit();syncNavState();
    setTimeout(()=>{ensureMainBestTab();setNavLabels();wireSpecialOpenRefresh();ensureMatrixGradient();applyMatrixGradient();decorateSpecialMedia();installDepthAudit();syncNavState()},900);
  }
  window.addEventListener('load',()=>{setTimeout(activate,1900);setTimeout(activate,2900)});
})();
