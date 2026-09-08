/* Fantasy Lens v33 — draft-night board + depth drafting polish. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@51e99d78d2f50c591909c641051fa0c0874b45d4/fantasy-football.js"><\/script>');

(function(){
  const DEF_KEY='fantasyLensDraftedDefenses';
  const K_KEY='fantasyLensDraftedKickers';
  const SPECIAL_CACHE='fantasyLensBestSpecialV33';
  const DEPTH_FILTER_KEY='fantasyLensDepthDraftFilter';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const readSet=key=>{try{return new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{return new Set()}};
  const saveSet=(key,set)=>localStorage.setItem(key,JSON.stringify([...set]));
  const teamCode=v=>{const t=String(v||'').toUpperCase().trim();return t==='WSH'?'WAS':t==='LA'?'LAR':t};
  const DEF_FALLBACK=['HOU','SEA','LAR','PHI','MIN','KC','PIT','DEN','BAL','CLE','SF','NE','BUF','JAX','IND','TB','LAC','DET','NO','GB','NYG','CIN','NYJ','TEN','CAR','DAL','WAS','ATL','CHI','LV','ARI','MIA'];
  let specialBoard={kickers:[],defenses:[]},specialLoading=false,depthBusy=false;

  function addV33Styles(){
    if(document.querySelector('#fantasyLensV33Styles'))return;
    const s=document.createElement('style');s.id='fantasyLensV33Styles';s.textContent=`
      /* one drafted indicator only: the toggle button itself */
      .specialDraftTag{display:none!important}
      .appbar #resetDraft.topResetV33{background:#3b2022!important;color:#ffd9d7!important;border-color:#744044!important;margin-left:auto}
      .appbar #resetDraft.topResetV33:hover{background:#562c30!important}
      .searchWrapV33{position:relative;min-width:180px;width:100%}.searchWrapV33 #search{width:100%;padding-right:34px}.searchClearV33{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:25px;height:25px;padding:0!important;border-radius:7px!important;display:grid;place-items:center;font-size:13px!important;line-height:1;background:#edf0ed!important;color:#52616d!important;border:0!important}.searchClearV33:disabled{opacity:.25;cursor:default}
      #bestStrip.bestStripV33{display:block!important;margin:7px 0}.bestAvailableWrapV33{background:#fff;border:1px solid var(--line);border-radius:13px;overflow:hidden}.bestAvailableHeadV33{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 9px;border-bottom:1px solid var(--line)}.bestAvailableHeadV33 b{font-size:10px}.bestAvailableHeadV33 small{font-size:8px;color:var(--muted)}.bestAvailableScrollV33{overflow:auto}.bestAvailableGridV33{display:grid;grid-template-columns:repeat(6,minmax(170px,1fr));min-width:1020px}.bestAvailColV33{border-right:1px solid var(--line);min-width:0}.bestAvailColV33:last-child{border-right:0}.bestAvailTitleV33{position:sticky;top:0;background:#e9eeeb;padding:6px 7px;font-size:9px;font-weight:950;letter-spacing:.05em;z-index:1}.bestAvailRowV33{display:grid;grid-template-columns:21px minmax(0,1fr) auto;align-items:center;gap:5px;padding:4px 6px;border-top:1px solid #edf0ed;min-height:34px}.bestAvailN_V33{font-size:8px;color:var(--muted);font-weight:900}.bestAvailWhoV33{min-width:0;cursor:pointer}.bestAvailWhoV33 b{display:block;font-size:8.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bestAvailWhoV33 small{display:block;font-size:7px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bestAvailDraftV33{padding:3px 5px!important;font-size:7px!important;border-radius:6px!important}.bestAvailEmptyV33{padding:9px;color:var(--muted);font-size:8px}
      .depthMini,.depthSlotPlayer{position:relative}.depthDraftToggleV33{margin-left:auto!important;padding:3px 5px!important;font-size:7px!important;line-height:1!important;flex:0 0 auto}.depthDraftToggleV33.on{background:#687684!important;color:#fff!important}.depthDraftedV33{opacity:.42!important;filter:grayscale(1)}.depthDraftedV33 b{text-decoration:none!important}.depthDraftedV33 .depthDraftTag{display:none!important}#depthDraftFilters .depthDraftFilter.on{background:var(--navy)!important;color:#fff!important}
      @media(max-width:900px){.draftFilters .searchWrapV33{grid-column:1/3}.appbar #resetDraft.topResetV33{margin-left:0}.bestAvailableGridV33{grid-template-columns:repeat(6,minmax(155px,1fr));min-width:930px}}
    `;document.head.appendChild(s);
  }

  function moveResetAndInstallSearchClear(){
    const reset=document.querySelector('#resetDraft'),bar=document.querySelector('.appbarInner'),cache=document.querySelector('#cacheState');
    if(reset&&bar&&!reset.classList.contains('topResetV33')){
      reset.classList.add('topResetV33');reset.textContent='Reset Draft';
      if(cache)bar.insertBefore(reset,cache);else bar.appendChild(reset);
    }
    const input=document.querySelector('#search');if(!input)return;
    let wrap=input.closest('.searchWrapV33');
    if(!wrap){
      wrap=document.createElement('div');wrap.className='searchWrapV33';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
      const b=document.createElement('button');b.type='button';b.className='btn searchClearV33';b.title='Clear search';b.setAttribute('aria-label','Clear search');b.textContent='×';wrap.appendChild(b);
      b.onclick=()=>{input.value='';input.focus();b.disabled=true;if(typeof render==='function')render()};
      const sync=()=>{b.disabled=!input.value};input.addEventListener('input',sync);input.addEventListener('keydown',e=>{if(e.key==='Escape'&&input.value){input.value='';sync();if(typeof render==='function')render()}});sync();
    }
  }

  function toggleSpecial(kind,key){
    const storage=kind==='DEF'?DEF_KEY:K_KEY,set=readSet(storage);if(set.has(key))set.delete(key);else set.add(key);saveSet(storage,set);
    if(typeof render==='function')render();setTimeout(()=>{decorateSpecialViews();renderBestAvailableV33()},0);
  }

  function decorateSpecialViews(){
    const defs=readSet(DEF_KEY),ks=readSet(K_KEY);
    document.querySelectorAll('#defenseHistoryTable tbody tr').forEach(tr=>{
      tr.querySelectorAll('.specialDraftTag').forEach(x=>x.remove());
      let b=tr.querySelector('.specialDraftToggle'),team=teamCode(tr.querySelector('.defTeam>span')?.textContent||'');if(!team)return;const on=defs.has(team),cell=tr.querySelector('.defTeam');tr.classList.toggle('specialDraftedRow',on);
      if(!b&&cell){b=document.createElement('button');b.className='btn specialDraftToggle';b.type='button';cell.appendChild(b)}
      if(b){b.textContent=on?'Drafted':'Draft';b.classList.toggle('on',on);b.onclick=e=>{e.stopPropagation();toggleSpecial('DEF',team)}}
    });
    document.querySelectorAll('#kickerTable tbody tr').forEach(tr=>{
      tr.querySelectorAll('.specialDraftTag').forEach(x=>x.remove());
      const raw=tr.querySelector('.kickerPrimary small')?.textContent||'',key=norm(raw);if(!key||key.includes('no 2026 kicker projection'))return;const on=ks.has(key),cell=tr.querySelector('.kickerPrimary');tr.classList.toggle('specialDraftedRow',on);let b=tr.querySelector('.specialDraftToggle');
      if(!b&&cell){b=document.createElement('button');b.className='btn specialDraftToggle';b.type='button';cell.appendChild(b)}
      if(b){b.textContent=on?'Drafted':'Draft';b.classList.toggle('on',on);b.onclick=e=>{e.stopPropagation();toggleSpecial('K',key)}}
    });
  }

  function cachedSpecial(){try{const x=JSON.parse(localStorage.getItem(SPECIAL_CACHE)||'null');return x&&Date.now()-x.ts<6*60*60*1000?x.value:null}catch{return null}}
  async function loadSpecialBoard(){
    if(specialLoading)return;const hit=cachedSpecial();if(hit){specialBoard=hit;renderBestAvailableV33();return}
    specialLoading=true;
    try{
      let dir={};try{dir=typeof loadSleeperDirectory==='function'?await loadSleeperDirectory(false):await (await fetch('https://api.sleeper.app/v1/players/nfl')).json()}catch{}
      const [kr,dr]=await Promise.allSettled([
        fetch('https://api.sleeper.com/projections/nfl/2026?season_type=regular&position[]=K&order_by=pts_std').then(r=>r.ok?r.json():[]),
        fetch('https://api.sleeper.com/projections/nfl/2026?season_type=regular&position[]=DEF&order_by=pts_std').then(r=>r.ok?r.json():[])
      ]);
      const kickers=[];
      for(const row of Array.isArray(kr.value)?kr.value:[]){
        const id=String(row.player_id||row.player?.player_id||''),p=dir?.[id]||row.player||{},pos=String(row.position||p.position||p.fantasy_positions?.[0]||'').toUpperCase();if(pos!=='K')continue;
        const team=teamCode(row.team||p.team||''),name=row.player?.full_name||p.full_name||[p.first_name,p.last_name].filter(Boolean).join(' ');if(!name||!team)continue;
        const x=row.stats||row,direct=Number(x.pts_std??x.pts_half_ppr??row.pts_std??row.pts_half_ppr),pts=Number.isFinite(direct)?direct:Number(x.fgm||0)*3+Number(x.xpm||0);
        if(Number.isFinite(pts))kickers.push({name,team,pts,key:norm(name)});
      }
      kickers.sort((a,b)=>b.pts-a.pts);kickers.forEach((x,i)=>x.rank=i+1);
      const defVals=[];
      for(const row of Array.isArray(dr.value)?dr.value:[]){const team=teamCode(row.team||row.player?.team||row.player_id||row.player?.player_id||'');if(!team||team.length>3)continue;const x=row.stats||row,pts=Number(x.pts_std??x.pts_half_ppr??row.pts_std??row.pts_half_ppr);if(Number.isFinite(pts))defVals.push({team,pts})}
      defVals.sort((a,b)=>b.pts-a.pts);const seen=new Set(),defenses=[];for(const d of defVals){if(seen.has(d.team))continue;seen.add(d.team);defenses.push({...d,rank:defenses.length+1})}
      if(defenses.length<20){defenses.length=0;DEF_FALLBACK.forEach((team,i)=>defenses.push({team,rank:i+1,pts:null}))}
      specialBoard={kickers,defenses};try{localStorage.setItem(SPECIAL_CACHE,JSON.stringify({ts:Date.now(),value:specialBoard}))}catch{}
    }catch(e){console.warn('Best available K/DST load failed',e);specialBoard={kickers:[],defenses:DEF_FALLBACK.map((team,i)=>({team,rank:i+1,pts:null}))}}
    finally{specialLoading=false;renderBestAvailableV33()}
  }

  function skillTop(pos){
    if(typeof players==='undefined')return[];let base=players.filter(p=>p.pos===pos&&!draftedIds.has(String(p.id)));
    try{base=base.filter(p=>typeof isVisiblePlayer==='function'?isVisiblePlayer(p,true):true)}catch{}
    return base.sort((a,b)=>Number(b.fantasy||0)-Number(a.fantasy||0)).slice(0,10);
  }
  function skillRow(p,i){return `<div class="bestAvailRowV33"><span class="bestAvailN_V33">${i+1}</span><div class="bestAvailWhoV33" data-career="${p.id}"><b>${p.name}</b><small>${p.team} · #${p.posRank||'—'} ${p.pos} · ${Math.round(Number(p.fantasy||0))} FP</small></div><button class="btn bestAvailDraftV33" data-skill-draft="${p.id}">Draft</button></div>`}
  function specialRow(x,i,kind){const drafted=kind==='K'?readSet(K_KEY).has(x.key):readSet(DEF_KEY).has(x.team),label=kind==='K'?x.name:`${x.team} D/ST`,sub=kind==='K'?`${x.team} · #${x.rank} K · ${Math.round(Number(x.pts||0))} proj FP`:`#${x.rank} projected defense${x.pts!=null?' · '+Math.round(x.pts)+' FP':''}`;return `<div class="bestAvailRowV33"><span class="bestAvailN_V33">${i+1}</span><div class="bestAvailWhoV33"><b>${label}</b><small>${sub}</small></div><button class="btn bestAvailDraftV33" data-special-kind="${kind}" data-special-key="${kind==='K'?encodeURIComponent(x.key):x.team}">${drafted?'Drafted':'Draft'}</button></div>`}
  function renderBestAvailableV33(){
    const root=document.querySelector('#bestStrip');if(!root)return;if(typeof currentView!=='undefined'&&currentView!=='draft'){root.innerHTML='';root.classList.remove('bestStripV33');return}
    root.classList.add('bestStripV33');
    const defs=readSet(DEF_KEY),ks=readSet(K_KEY),kickers=(specialBoard.kickers||[]).filter(x=>!ks.has(x.key)).slice(0,10),defsAvail=(specialBoard.defenses||[]).filter(x=>!defs.has(x.team)).slice(0,10);
    const cols=[['QB',skillTop('QB').map(skillRow)],['RB',skillTop('RB').map(skillRow)],['WR',skillTop('WR').map(skillRow)],['TE',skillTop('TE').map(skillRow)],['K',kickers.map((x,i)=>specialRow(x,i,'K'))],['D/ST',defsAvail.map((x,i)=>specialRow(x,i,'DEF'))]];
    root.innerHTML=`<div class="bestAvailableWrapV33"><div class="bestAvailableHeadV33"><b>Top 10 Best Available</b><small>2026 projection order · drafted selections removed</small></div><div class="bestAvailableScrollV33"><div class="bestAvailableGridV33">${cols.map(([label,rows])=>`<section class="bestAvailColV33"><div class="bestAvailTitleV33">${label}</div>${rows.length?rows.join(''):`<div class="bestAvailEmptyV33">${(label==='K'||label==='D/ST')&&specialLoading?'Loading projections…':'No available entries'}</div>`}</section>`).join('')}</div></div></div>`;
    root.querySelectorAll('[data-skill-draft]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(typeof toggleDraft==='function')toggleDraft(b.dataset.skillDraft);setTimeout(renderBestAvailableV33,0)});
    root.querySelectorAll('[data-career]').forEach(x=>x.onclick=()=>{if(typeof career==='function')career(x.dataset.career)});
    root.querySelectorAll('[data-special-kind]').forEach(b=>b.onclick=e=>{e.stopPropagation();const kind=b.dataset.specialKind,key=kind==='K'?decodeURIComponent(b.dataset.specialKey):b.dataset.specialKey;toggleSpecial(kind,key)});
    if((!specialBoard.kickers?.length||!specialBoard.defenses?.length)&&!specialLoading)setTimeout(loadSpecialBoard,0);
  }

  function depthPlayerFromCard(card){
    const b=card.querySelector('b');if(!b||typeof players==='undefined')return null;const clone=b.cloneNode(true);clone.querySelectorAll('.depthDraftTag,.depthDraftToggleV33,.specialDraftTag').forEach(x=>x.remove());const name=norm(clone.textContent.replace(/drafted/ig,''));if(!name)return null;return players.find(p=>norm(p.name)===name)||null;
  }
  function installDepthFilterButtonsV33(){
    const bar=document.querySelector('.depthToolbar');if(!bar)return;let box=document.querySelector('#depthDraftFilters');if(!box){box=document.createElement('span');box.id='depthDraftFilters';box.style.cssText='display:inline-flex;gap:6px;align-items:center';const search=document.querySelector('#depthSearch');bar.insertBefore(box,search||null)}
    const current=localStorage.getItem(DEPTH_FILTER_KEY)||'all';box.innerHTML=['all','available','drafted'].map(v=>`<button class="btn depthDraftFilter ${v===current?'on':''}" data-df="${v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>{localStorage.setItem(DEPTH_FILTER_KEY,b.dataset.df);applyDepthDraftV33()});
  }
  function applyDepthDraftV33(){
    if(depthBusy)return;depthBusy=true;
    try{
      installDepthFilterButtonsV33();const root=document.querySelector('#depthResults');if(!root)return;const filter=localStorage.getItem(DEPTH_FILTER_KEY)||'all';
      root.querySelectorAll('tr').forEach(tr=>{tr.style.display='';tr.style.opacity='';tr.style.textDecoration=''});
      root.querySelectorAll('.depthMini,.depthSlotPlayer').forEach(card=>{
        card.querySelectorAll('.depthDraftToggleV33').forEach(x=>x.remove());card.style.textDecoration='';const p=depthPlayerFromCard(card);if(!p){card.style.display='';card.classList.remove('depthDraftedV33');return}
        const drafted=draftedIds.has(String(p.id));card.classList.toggle('depthDraftedV33',drafted);card.style.display=(filter==='drafted'&&!drafted)||(filter==='available'&&drafted)?'none':'';
        const b=document.createElement('button');b.type='button';b.className='btn depthDraftToggleV33'+(drafted?' on':'');b.textContent=drafted?'Drafted':'Draft';b.onclick=e=>{e.stopPropagation();toggleDraft(String(p.id));setTimeout(applyDepthDraftV33,0)};card.appendChild(b);
      });
      document.querySelectorAll('#depthDraftFilters .depthDraftFilter').forEach(b=>b.classList.toggle('on',b.dataset.df===filter));
    }finally{depthBusy=false}
  }
  function installDepthFix(){
    try{applyDepthDraftFilter=applyDepthDraftV33;installDepthDraftFilters=installDepthFilterButtonsV33}catch{}
    const root=document.querySelector('#depthResults');if(root&&!root.dataset.v33Observer){root.dataset.v33Observer='1';new MutationObserver(()=>setTimeout(applyDepthDraftV33,0)).observe(root,{childList:true,subtree:true})}
    document.querySelector('#exploreBtn')?.addEventListener('click',()=>setTimeout(applyDepthDraftV33,120));document.querySelector('#runDepth')?.addEventListener('click',()=>setTimeout(applyDepthDraftV33,500));document.querySelector('#depthSearch')?.addEventListener('input',()=>setTimeout(applyDepthDraftV33,20));
  }

  function wrapSpecialButtons(){
    for(const id of ['defenseBtn','kickerBtn']){const b=document.querySelector('#'+id);if(!b||b.dataset.v33Wrapped==='1')continue;const old=b.onclick;b.dataset.v33Wrapped='1';b.onclick=function(e){const out=old?.call(this,e);let n=0,t=setInterval(()=>{decorateSpecialViews();if(++n>20)clearInterval(t)},120);return out}}
  }
  function install(){
    addV33Styles();moveResetAndInstallSearchClear();wrapSpecialButtons();decorateSpecialViews();installDepthFix();
    try{renderBestStrip=renderBestAvailableV33}catch{window.renderBestStrip=renderBestAvailableV33}
    if(typeof currentView!=='undefined'&&currentView==='draft'){renderBestAvailableV33();setTimeout(loadSpecialBoard,50)}
  }
  window.addEventListener('load',()=>{setTimeout(install,500);setTimeout(()=>{install();if(typeof render==='function')render()},1250)});
})();