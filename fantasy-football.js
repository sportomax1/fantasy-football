/* Fantasy Lens v37 — reliable view hydration, roster-aware My Team, profile layering, Washington aliases. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@9eff0f8577a2593141f0291d9e7e91db02d4497e/fantasy-football.js"><\/script>');

(function(){
  const BOARD_KEY='fantasyLensLeagueDraftBoardV1';
  const LEAGUE_KEY='fantasyLensLeagueSettingsV1';
  const ROSTER_KEY='fantasyLensRosterSettingsV37';
  const ESPN_DEFAULT={QB:1,RB:2,WR:2,TE:1,FLEX:1,DEF:1,K:1,BE:7};
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const readJson=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||'null');return x??f}catch{return f}};
  const writeJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const canonicalTeam=v=>{const t=String(v||'').toUpperCase().trim();if(['WAS','WSH','WFT'].includes(t))return'WAS';if(t==='LA')return'LAR';return t};
  const teamLogo=t=>`https://a.espncdn.com/i/teamlogos/nfl/500/${canonicalTeam(t)==='WAS'?'wsh':canonicalTeam(t).toLowerCase()}.png`;
  const espnFace=id=>id?`https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(id)}.png`:'';
  const sleeperFace=id=>id?`https://sleepercdn.com/content/nfl/players/${encodeURIComponent(id)}.jpg`:'';
  let sleeperDirPromise=null, viewToken=0, filteredWrapped=false, boardObserver=null, myTeamObserver=null;

  function addStyles(){
    if(document.querySelector('#fantasyLensV37Styles'))return;
    const s=document.createElement('style');s.id='fantasyLensV37Styles';s.textContent=`
      .viewLoadingV37{padding:20px;text-align:center;color:var(--muted);font-size:10px;background:#fff;border:1px solid var(--line);border-radius:12px}
      #rosterSettingsV37{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}#rosterSettingsV37 h3{margin:0 0 7px;font-size:12px}#rosterSettingsV37 .rosterGridV37{display:grid;grid-template-columns:repeat(4,minmax(95px,1fr));gap:7px}#rosterSettingsV37 label{font-size:8px;color:var(--muted)}#rosterSettingsV37 input,#rosterSettingsV37 select{width:100%;margin-top:3px}.rosterSummaryV37{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:9px}.rosterSummaryV37 b{font-size:11px}.myTeamSettingV35{display:none!important}
      .myTeamLayoutV37{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:10px;overflow:auto;min-height:0}.rosterSectionV37{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}.rosterSectionV37 h3{margin:0;padding:9px 10px;background:#e9eeeb;font-size:11px}.rosterSlotsV37{padding:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}.rosterSlotV37{display:grid;grid-template-columns:42px minmax(0,1fr) 27px;gap:7px;align-items:center;border:1px solid #e5e9e6;border-radius:10px;padding:6px;min-height:58px}.rosterSlotV37.empty{opacity:.55;border-style:dashed}.rosterSlotV37 .slotTagV37{grid-column:1/-1;font-size:7px;font-weight:900;color:var(--muted);letter-spacing:.05em;margin-bottom:-3px}.rosterSlotV37 .faceV37{width:42px;height:42px;border-radius:9px;object-fit:cover;background:#edf0ed}.rosterSlotV37 .logoV37{width:26px;height:26px;object-fit:contain}.rosterSlotV37 button{border:0;background:none;padding:0;text-align:left;color:inherit;font:inherit;cursor:pointer}.rosterSlotV37 b{display:block;font-size:10px}.rosterSlotV37 small{display:block;color:var(--muted);font-size:7px;margin-top:2px}.rosterExtrasV37{padding:7px;font-size:8px;color:var(--muted)}
      #leagueDraftMainModalV35 .leaguePickNameV35.clickableV35,#myTeamModalV35 [data-profile-id]{position:relative;z-index:2}.leaguePickV35 .leaguePickFaceV35.defLogoV37{object-fit:contain;background:#fff;padding:3px}.leaguePickV35 .leaguePickFaceV35.kFaceV37{object-fit:cover}
      @media(max-width:850px){#rosterSettingsV37 .rosterGridV37{grid-template-columns:repeat(2,1fr)}.myTeamLayoutV37{grid-template-columns:1fr}.rosterSlotsV37{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function board(){return readJson(BOARD_KEY,null)}
  function league(){return Object.assign({multiPosition:true,flex:['RB','WR','TE'],myTeam:''},readJson(LEAGUE_KEY,{}))}
  function roster(){return Object.assign({},ESPN_DEFAULT,readJson(ROSTER_KEY,{}))}
  function saveRoster(x){const clean={};for(const k of Object.keys(ESPN_DEFAULT))clean[k]=Math.max(0,Math.min(20,Math.round(Number(x[k])||0)));writeJson(ROSTER_KEY,clean);return clean}
  function playersList(){return typeof players!=='undefined'&&Array.isArray(players)?players:[]}
  function findSkill(pick){
    const ps=playersList();if(pick?.playerId){const h=ps.find(p=>String(p.id)===String(pick.playerId));if(h)return h}
    const n=norm(pick?.display||pick?.name||'');if(!n)return null;
    return ps.find(p=>norm(p.name)===n)||null;
  }
  function ownerMatch(name,b=board()){const n=norm(name);return n&&b?.owners?.find(o=>norm(o)===n)||''}

  async function sleeperDir(){
    if(sleeperDirPromise)return sleeperDirPromise;
    sleeperDirPromise=(async()=>{try{if(typeof loadSleeperDirectory==='function')return await loadSleeperDirectory(false);const r=await fetch('https://api.sleeper.app/v1/players/nfl');return r.ok?await r.json():{}}catch{return{}}})();
    return sleeperDirPromise;
  }
  async function sleeperByName(){const d=await sleeperDir(),m=new Map();for(const [id,p] of Object.entries(d||{})){const name=p?.full_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ');if(name)m.set(norm(name),{id,p})}return m}

  function wrapWashingtonFiltering(){
    if(filteredWrapped||typeof window.filtered!=='function')return;const old=window.filtered;window.filtered=function(){
      let oldTeam,oldSearch;const search=document.querySelector('#search');try{
        if(typeof state!=='undefined'){oldTeam=state.team;if(canonicalTeam(state.team)==='WAS')state.team='WSH'}
        if(search){oldSearch=search.value;const q=norm(oldSearch);if(['was','wsh','wft','washington','washington commanders','commanders'].includes(q))search.value='WSH'}
        return old.apply(this,arguments);
      }finally{if(typeof state!=='undefined'&&oldTeam!==undefined)state.team=oldTeam;if(search&&oldSearch!==undefined)search.value=oldSearch}
    };filteredWrapped=true;
  }

  async function ensureCurrentPlayers(){
    if(playersList().length)return true;
    try{if(typeof cacheGet==='function'){const hit=await cacheGet('season:2026');if(hit?.value?.length){seasonData[2026]=hit.value;players=hit.value;if(typeof finalizePlayers==='function')finalizePlayers(players);return true}}}catch{}
    document.querySelector('#run')?.click();
    for(let i=0;i<50;i++){if(playersList().length)return true;await new Promise(r=>setTimeout(r,250))}
    return playersList().length>0;
  }
  async function switchViewReliable(view){
    const token=++viewToken;
    currentView=view;localStorage.setItem('fantasyLensView',view);if(typeof state!=='undefined'){state.sort=view==='health'?'healthPct':'fantasy';state.dir=-1}
    const table=document.querySelector('#tablewrap');if(table&&!playersList().length)table.innerHTML='<div class="viewLoadingV37">Loading player data…</div>';
    const ok=await ensureCurrentPlayers();if(!ok){if(table)table.innerHTML='<div class="viewLoadingV37">Player data could not be loaded. Use LOAD DATA and retry.</div>';return}
    if(typeof render==='function')render();
    if(['overview','matrix','health'].includes(view)&&typeof ensureHistoricalViews==='function'){
      const meta=document.querySelector('#viewMeta');if(meta)meta.textContent='Loading historical seasons…';
      try{await ensureHistoricalViews(false)}catch(e){console.warn('historical view load failed',view,e)}
      if(token===viewToken&&typeof render==='function')render();
    }
  }
  function wireReliableTabs(){
    const nav=document.querySelector('#viewNav');if(!nav)return;
    for(const view of ['draft','overview','matrix','health','weekly']){
      const b=nav.querySelector(`[data-view="${view}"]`);if(!b||b.dataset.v37Reliable==='1')continue;b.dataset.v37Reliable='1';b.onclick=e=>{e.preventDefault();e.stopPropagation();switchViewReliable(view)};
    }
  }

  function syncMainButtonsV37(){
    const b=board(),cfg=league(),known=!!(b?.picks?.length&&b?.owners?.length),owner=ownerMatch(cfg.myTeam,b),leagueBtn=document.querySelector('#leagueDraftMainV35'),mine=document.querySelector('#myTeamBtnV35');
    if(leagueBtn){leagueBtn.disabled=!known;leagueBtn.classList.toggle('navUnknownV35',!known);leagueBtn.title=known?`${b.picks.length} owner-tagged picks detected`:'Import owner-tagged draft results to enable'}
    if(mine){const ready=known&&!!owner;mine.disabled=!ready;mine.classList.toggle('navUnknownV35',!ready);mine.title=!known?'Import draft results first':!cfg.myTeam?'Choose your fantasy team in Scoring → League Roster Settings':!owner?`Team “${cfg.myTeam}” was not found in the imported draft`:`Open ${owner}`}
  }

  function installRosterSettings(){
    const body=document.querySelector('#settingsModal .careerbody');if(!body)return;let box=document.querySelector('#rosterSettingsV37');if(!box){box=document.createElement('section');box.id='rosterSettingsV37';body.appendChild(box)}
    const r=roster(),b=board(),cfg=league(),owners=b?.owners||[],starterKeys=['QB','RB','WR','TE','FLEX','DEF','K'];
    const ownerOptions=['<option value="">Select your fantasy team…</option>',...owners.map(o=>`<option value="${esc(o)}" ${norm(o)===norm(cfg.myTeam)?'selected':''}>${esc(o)}</option>`)].join('');
    box.innerHTML=`<h3>League Roster Settings</h3><div class="webHint">ESPN standard default: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB/WR/TE), 1 D/ST, 1 K and 7 bench = 16 drafted players.</div><div class="rosterSummaryV37"><label style="min-width:220px">Your fantasy team<select class="field" id="myTeamSelectV37">${ownerOptions}</select></label><span>Starters <b id="starterCountV37"></b></span><span>Bench <b id="benchCountV37"></b></span><span>Total draft size <b id="totalCountV37"></b></span><button class="btn" id="resetEspnRosterV37" type="button">ESPN Defaults</button></div><div class="rosterGridV37">${[...starterKeys,'BE'].map(k=>`<label>${k==='DEF'?'D/ST':k==='BE'?'Bench':k}<input class="field rosterNumV37" type="number" min="0" max="20" data-roster="${k}" value="${r[k]}"></label>`).join('')}</div>`;
    const updateTotals=()=>{const x={...r};box.querySelectorAll('[data-roster]').forEach(i=>x[i.dataset.roster]=Math.max(0,Math.round(Number(i.value)||0)));const starters=starterKeys.reduce((a,k)=>a+x[k],0);box.querySelector('#starterCountV37').textContent=starters;box.querySelector('#benchCountV37').textContent=x.BE;box.querySelector('#totalCountV37').textContent=starters+x.BE;return x};
    updateTotals();box.querySelectorAll('[data-roster]').forEach(i=>i.onchange=()=>{saveRoster(updateTotals());renderMyTeamV37()});
    box.querySelector('#resetEspnRosterV37').onclick=()=>{saveRoster(ESPN_DEFAULT);installRosterSettings();renderMyTeamV37()};
    const sel=box.querySelector('#myTeamSelectV37');if(sel)sel.onchange=()=>{const next=league();next.myTeam=sel.value;writeJson(LEAGUE_KEY,next);syncMainButtonsV37();renderMyTeamV37()};
  }

  function projection(pick){const p=findSkill(pick);return Number(p?.fantasy||0)}
  function assignRoster(picks,r,cfg){
    const un=[...picks],starts=[],take=(pos,n,label)=>{for(let i=0;i<n;i++){const cand=un.filter(p=>p.pos===pos).sort((a,b)=>projection(b)-projection(a))[0];if(cand){un.splice(un.indexOf(cand),1);starts.push({slot:n>1?`${label}${i+1}`:label,pick:cand})}else starts.push({slot:n>1?`${label}${i+1}`:label,pick:null})}};
    take('QB',r.QB,'QB');take('RB',r.RB,'RB');take('WR',r.WR,'WR');take('TE',r.TE,'TE');
    const flexEligible=new Set((cfg.flex||['RB','WR','TE']).map(String));for(let i=0;i<r.FLEX;i++){const cand=un.filter(p=>flexEligible.has(p.pos)).sort((a,b)=>projection(b)-projection(a))[0];if(cand){un.splice(un.indexOf(cand),1);starts.push({slot:r.FLEX>1?`FLEX${i+1}`:'FLEX',pick:cand})}else starts.push({slot:r.FLEX>1?`FLEX${i+1}`:'FLEX',pick:null})}
    take('DEF',r.DEF,'D/ST');take('K',r.K,'K');
    un.sort((a,b)=>(Number(a.round)||99)-(Number(b.round)||99)||(Number(a.slot)||99)-(Number(b.slot)||99));return{starts,bench:un.slice(0,r.BE),extra:un.slice(r.BE)};
  }
  async function mediaForPick(pick,nameMap){
    if(!pick)return{face:'',logo:'',pid:''};const p=findSkill(pick),pid=p?.id||pick.playerId||'';if(pick.pos==='DEF')return{face:teamLogo(pick.nflTeam),logo:teamLogo(pick.nflTeam),pid:''};if(pick.pos==='K'){const h=nameMap?.get(norm(pick.display));return{face:h?sleeperFace(h.id):'',logo:teamLogo(pick.nflTeam||h?.p?.team),pid:''}}return{face:pid?espnFace(pid):'',logo:teamLogo(pick.nflTeam||p?.team),pid};
  }
  async function slotHtml(slot,pick,nameMap){
    if(!pick)return `<article class="rosterSlotV37 empty"><div class="slotTagV37">${esc(slot)}</div><div class="faceV37"></div><div><b>Open slot</b><small>No drafted player assigned</small></div><div></div></article>`;
    const m=await mediaForPick(pick,nameMap),click=!!(m.pid&&typeof career==='function');return `<article class="rosterSlotV37"><div class="slotTagV37">${esc(slot)}</div>${m.face?`<img class="faceV37" src="${m.face}" onerror="this.style.visibility='hidden'">`:'<div class="faceV37"></div>'}<div>${click?`<button data-profile-id="${esc(m.pid)}"><b>${esc(pick.display)}</b></button>`:`<b>${esc(pick.display)}</b>`}<small>R${pick.round||'—'}${pick.slot!=null?' · pick '+pick.slot:''} · ${pick.pos==='DEF'?'D/ST':esc(pick.pos)} · ${canonicalTeam(pick.nflTeam)}</small></div>${m.logo?`<img class="logoV37" src="${m.logo}" onerror="this.style.visibility='hidden'">`:'<div></div>'}</article>`;
  }
  async function renderMyTeamV37(){
    const modal=document.querySelector('#myTeamModalV35');if(!modal)return;const b=board(),cfg=league(),owner=ownerMatch(cfg.myTeam,b),body=modal.querySelector('.careerbody'),title=modal.querySelector('#myTeamTitleV35');if(!body)return;if(title)title.textContent=owner?`My Team — ${owner}`:'My Team';
    if(!owner){body.innerHTML='<div class="leagueBoardEmpty">Choose your fantasy team in Scoring → League Roster Settings after importing owner-tagged draft results.</div>';return}
    const picks=(b?.picks||[]).filter(p=>p.owner===owner).map(p=>({...p,nflTeam:canonicalTeam(p.nflTeam)})),r=roster(),layout=assignRoster(picks,r,cfg),nameMap=await sleeperByName();
    const starterHtml=(await Promise.all(layout.starts.map(x=>slotHtml(x.slot,x.pick,nameMap)))).join('');const benchHtml=(await Promise.all(layout.bench.map((p,i)=>slotHtml(`BE${i+1}`,p,nameMap)))).join('');
    body.innerHTML=`<div class="careerstatus">${picks.length} drafted · ${layout.starts.filter(x=>x.pick).length}/${layout.starts.length} starter slots filled · ${layout.bench.length}/${r.BE} bench slots filled</div><div class="myTeamLayoutV37"><section class="rosterSectionV37"><h3>Starters</h3><div class="rosterSlotsV37">${starterHtml}</div></section><section class="rosterSectionV37"><h3>Bench</h3><div class="rosterSlotsV37">${benchHtml||'<div class="rosterExtrasV37">No bench players assigned yet.</div>'}</div>${layout.extra.length?`<div class="rosterExtrasV37">${layout.extra.length} player${layout.extra.length===1?'':'s'} beyond configured roster size. Increase Bench in League Roster Settings if intentional.</div>`:''}</section></div>`;
    bindProfileLayering(modal);
  }

  function bindProfileLayering(root){
    if(!root||root.dataset.v37Profile==='1')return;root.dataset.v37Profile='1';root.addEventListener('click',e=>{const b=e.target.closest('[data-profile-id]');if(!b||!root.contains(b))return;const id=b.dataset.profileId;if(!id||typeof career!=='function')return;e.preventDefault();e.stopPropagation();root.classList.remove('open');setTimeout(()=>career(id),40)},true);
  }
  async function repairLeagueBoardMedia(){
    const modal=document.querySelector('#leagueDraftMainModalV35');if(!modal)return;bindProfileLayering(modal);const nameMap=await sleeperByName();
    modal.querySelectorAll('.leaguePickV35').forEach(card=>{
      const btn=card.querySelector('.leaguePickNameV35'),name=btn?.textContent.trim()||'',small=card.querySelector('small')?.textContent||'',pos=(small.match(/·\s*(QB|RB|WR|TE|K|D\/ST|DEF)\b/i)||[])[1]?.toUpperCase()||'',team=canonicalTeam((small.match(/^([A-Z]{2,3})\s*·/)||[])[1]||'');
      const skill=playersList().find(p=>norm(p.name)===norm(name));if(skill&&btn){btn.dataset.profileId=String(skill.id);btn.classList.add('clickableV35')}
      const face=card.querySelector('.leaguePickFaceV35');if(pos==='K'&&face){const h=nameMap.get(norm(name));if(h){face.src=sleeperFace(h.id);face.classList.add('kFaceV37');face.style.visibility='visible'}}
      if((pos==='D/ST'||pos==='DEF')&&face&&team){face.src=teamLogo(team);face.classList.add('defLogoV37');face.style.visibility='visible'}
      const logo=card.querySelector('.leaguePickLogoV35');if(logo&&team){logo.src=teamLogo(team);logo.style.visibility='visible'}
    });
  }

  function observeModals(){
    const leagueModal=document.querySelector('#leagueDraftMainModalV35');if(leagueModal&&!leagueModal.dataset.v37Obs){leagueModal.dataset.v37Obs='1';boardObserver=new MutationObserver(()=>setTimeout(repairLeagueBoardMedia,20));boardObserver.observe(leagueModal,{childList:true,subtree:true});bindProfileLayering(leagueModal);repairLeagueBoardMedia()}
    const my=document.querySelector('#myTeamModalV35');if(my&&!my.dataset.v37Obs){my.dataset.v37Obs='1';myTeamObserver=new MutationObserver(()=>{if(my.classList.contains('open')&&!my.querySelector('.myTeamLayoutV37'))setTimeout(renderMyTeamV37,20)});myTeamObserver.observe(my,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});bindProfileLayering(my)}
    const mine=document.querySelector('#myTeamBtnV35');if(mine&&!mine.dataset.v37Click){mine.dataset.v37Click='1';mine.addEventListener('click',()=>setTimeout(renderMyTeamV37,30))}
    const leagueBtn=document.querySelector('#leagueDraftMainV35');if(leagueBtn&&!leagueBtn.dataset.v37Click){leagueBtn.dataset.v37Click='1';leagueBtn.addEventListener('click',()=>setTimeout(repairLeagueBoardMedia,30))}
  }

  function normalizeBoardWashington(){
    const b=board();if(!b?.picks?.length)return;let changed=false;for(const p of b.picks){const t=canonicalTeam(p.nflTeam);if(t!==p.nflTeam){p.nflTeam=t;changed=true}}if(changed)writeJson(BOARD_KEY,b);
  }
  function wireSettings(){const b=document.querySelector('#settingsBtn');if(b&&!b.dataset.v37Settings){b.dataset.v37Settings='1';b.addEventListener('click',()=>setTimeout(installRosterSettings,30))}const imp=document.querySelector('#parseDraftBtn');if(imp&&!imp.dataset.v37Sync){imp.dataset.v37Sync='1';imp.addEventListener('click',()=>setTimeout(()=>{normalizeBoardWashington();installRosterSettings();syncMainButtonsV37()},250))}}

  function activate(){
    addStyles();normalizeBoardWashington();wrapWashingtonFiltering();wireReliableTabs();wireSettings();installRosterSettings();syncMainButtonsV37();observeModals();
    setTimeout(()=>{wrapWashingtonFiltering();wireReliableTabs();wireSettings();installRosterSettings();syncMainButtonsV37();observeModals();repairLeagueBoardMedia();},900);
  }
  window.addEventListener('load',()=>{setTimeout(activate,700);setTimeout(activate,1600)});
})();