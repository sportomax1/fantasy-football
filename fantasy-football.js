/* Fantasy Lens v39 — draft-night UX architecture, dashboard, deep links, and decision support. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@0b54e5f4c2db8d5f2b84ef47496e5f051c62b2e6/fantasy-football.js"><\/script>');

(function(){
  const BOARD_KEY='fantasyLensLeagueDraftBoardV1';
  const LEAGUE_KEY='fantasyLensLeagueSettingsV1';
  const ROSTER_KEY='fantasyLensRosterSettingsV37';
  const ADP_KEY='fantasyLensAdpSourcesV1';
  const DENSITY_KEY='fantasyLensDensityV39';
  const ESPN_DEFAULT={QB:1,RB:2,WR:2,TE:1,FLEX:1,DEF:1,K:1,BE:7};
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const readJson=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||'null');return x??f}catch{return f}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const canonicalTeam=v=>{const t=String(v||'').toUpperCase().trim();if(['WAS','WSH','WFT'].includes(t))return'WAS';if(t==='LA')return'LAR';return t};
  const espnTeam=t=>canonicalTeam(t)==='WAS'?'WSH':canonicalTeam(t);
  const teamLogo=t=>t?`https://a.espncdn.com/i/teamlogos/nfl/500/${canonicalTeam(t)==='WAS'?'wsh':canonicalTeam(t).toLowerCase()}.png`:'';
  const headshot=id=>id?`https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(id)}.png`:'';
  let applyingHash=false, hashTimer=null, commandIndex=-1, leagueObserver=null, bestObserver=null, renderWrapped=false, activated=false;
  let density=localStorage.getItem(DENSITY_KEY)||'compact';

  function playersList(){return typeof players!=='undefined'&&Array.isArray(players)?players:[]}
  function draftBoard(){return readJson(BOARD_KEY,null)}
  function league(){return Object.assign({flex:['RB','WR','TE'],myTeam:''},readJson(LEAGUE_KEY,{}))}
  function roster(){return Object.assign({},ESPN_DEFAULT,readJson(ROSTER_KEY,{}))}
  function ownerMatch(name,b=draftBoard()){const n=norm(name);return n&&b?.owners?.find(o=>norm(o)===n)||''}
  function currentOwner(){return ownerMatch(league().myTeam)}
  function findPlayer(pick){
    const ps=playersList();
    if(pick?.playerId){const x=ps.find(p=>String(p.id)===String(pick.playerId));if(x)return x}
    const n=norm(pick?.display||pick?.name||'');return n?ps.find(p=>norm(p.name)===n)||null:null;
  }
  function adpConsensus(id){
    const all=readJson(ADP_KEY,{}),vals=[];
    for(const src of Object.values(all||{})){const v=Number(src?.ranks?.[String(id)]);if(Number.isFinite(v))vals.push(v)}
    return vals.length?{avg:vals.reduce((a,b)=>a+b,0)/vals.length,min:Math.min(...vals),max:Math.max(...vals),n:vals.length}:null;
  }
  function overallPick(pick,b=draftBoard()){
    const n=b?.owners?.length||0,r=Math.max(1,Number(pick?.round)||1),slot=Number(pick?.slot);
    if(n&&Number.isFinite(slot)&&slot>=1&&slot<=n)return (r-1)*n+(r%2===1?slot:n-slot+1);
    return Number(pick?.seq)||r;
  }
  function projectionRanks(){
    const m=new Map();
    [...playersList()].sort((a,b)=>Number(b.fantasy||0)-Number(a.fantasy||0)).forEach((p,i)=>m.set(String(p.id),i+1));
    return m;
  }
  function gradeLetter(s){if(s>=97)return'A+';if(s>=93)return'A';if(s>=90)return'A-';if(s>=87)return'B+';if(s>=83)return'B';if(s>=80)return'B-';if(s>=77)return'C+';if(s>=73)return'C';if(s>=70)return'C-';if(s>=67)return'D+';if(s>=63)return'D';if(s>=60)return'D-';return'F'}
  function gradeClass(s){return s>=90?'gA':s>=80?'gB':s>=70?'gC':s>=60?'gD':'gF'}

  function addStyles(){
    if(document.querySelector('#fantasyLensV39Styles'))return;
    const s=document.createElement('style');s.id='fantasyLensV39Styles';s.textContent=`
      :root{--v39-sticky-top:42px}
      .navSepV39{width:1px;height:27px;background:#ccd4cf;margin:0 2px;flex:0 0 1px}
      #viewNav{align-items:center!important}
      #dashboardBtnV39.on{background:var(--navy)!important;color:#fff!important}
      #contextToolbarV39{display:none;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0 8px;padding:7px;background:#f5f5f0;border:1px solid var(--line);border-radius:11px}
      #contextToolbarV39.show{display:flex}.contextTitleV39{font-size:8px;color:var(--muted);font-weight:800;margin-right:2px}
      #contextToolbarV39 .field{min-height:31px}.contextPosV39.on{background:var(--navy)!important;color:#fff!important}
      .commandWrapV39{position:relative;min-width:220px;flex:0 1 310px}.commandInputV39{width:100%;height:31px!important;padding:0 32px 0 10px!important;font-size:9px!important}
      .commandKeyV39{position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:7px;color:#75838e;border:1px solid #93a0a8;border-radius:4px;padding:1px 3px;pointer-events:none}
      .commandResultsV39{display:none;position:absolute;z-index:900;top:36px;left:0;width:min(440px,90vw);max-height:360px;overflow:auto;background:#fff;border:1px solid #cdd6d0;border-radius:11px;box-shadow:0 14px 38px #0003;padding:4px}
      .commandResultsV39.open{display:block}.commandRowV39{display:grid;grid-template-columns:35px minmax(0,1fr) 22px;gap:7px;align-items:center;width:100%;border:0;background:transparent;padding:6px;border-radius:8px;text-align:left;color:var(--ink);cursor:pointer}
      .commandRowV39:hover,.commandRowV39.sel{background:#edf1ed}.commandRowV39 .face{width:35px;height:35px;border-radius:8px;object-fit:cover;background:#edf0ed}.commandRowV39 .logo{width:21px;height:21px;object-fit:contain}.commandRowV39 b{display:block;font-size:9px}.commandRowV39 small{display:block;font-size:7px;color:var(--muted);margin-top:2px}
      #densityBtnV39{white-space:nowrap}
      body.densityCompactV39 #tablewrap th,body.densityCompactV39 #tablewrap td{padding-top:4px!important;padding-bottom:4px!important}body.densityCompactV39 .playercell .head,body.densityCompactV39 .playerCell .head{width:30px!important;height:30px!important}body.densityCompactV39 .viewNav .btn{padding-top:7px!important;padding-bottom:7px!important}
      body.densityComfortableV39 #tablewrap th,body.densityComfortableV39 #tablewrap td{padding-top:9px!important;padding-bottom:9px!important}body.densityComfortableV39 .playercell .head,body.densityComfortableV39 .playerCell .head{width:44px!important;height:44px!important}body.densityComfortableV39 .viewNav .btn{padding:10px 12px!important}
      .app{padding-bottom:32px}#draftStatusStripV39{position:fixed;left:0;right:0;bottom:0;z-index:950;background:#142b3df7;color:#eef6f7;border-top:1px solid #ffffff16;border-bottom:1px solid #0004;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:5px 14px;font-size:8px;min-height:30px}
      #draftStatusStripV39 b{font-size:9px;color:#fff}.statusItemV39{display:inline-flex;gap:4px;align-items:center;white-space:nowrap}.statusMutedV39{color:#a9bbc7}
      .fullV39{padding:0!important;background:#08141eea!important}.fullV39>.modalbox{width:100vw!important;max-width:none!important;height:100vh!important;max-height:100vh!important;margin:0!important;border-radius:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}.fullV39 .careerbody{flex:1;min-height:0;overflow:auto!important}
      .dashGridV39{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:9px}.dashCardV39{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px;min-width:0}.dashCardV39 h3{margin:0 0 7px;font-size:11px}.dashCardV39.big{grid-column:span 6}.dashCardV39.med{grid-column:span 4}.dashCardV39.small{grid-column:span 3}.dashMetricV39{font-size:26px;font-weight:800;line-height:1}.dashSubV39{font-size:8px;color:var(--muted);margin-top:4px}.needsV39{display:flex;gap:5px;flex-wrap:wrap}.needChipV39{padding:4px 7px;border-radius:999px;background:#edf1ee;font-size:8px;font-weight:800}.needChipV39.hot{background:#fff0c7;color:#765100}
      .dashListV39{display:grid;gap:5px}.dashPlayerV39{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:6px;align-items:center;border-top:1px solid #edf0ed;padding-top:5px}.dashPlayerV39:first-child{border-top:0;padding-top:0}.dashPlayerV39 img{width:30px;height:30px;border-radius:7px;object-fit:cover;background:#edf0ed}.dashPlayerV39 b{display:block;font-size:9px}.dashPlayerV39 small{font-size:7px;color:var(--muted)}.surviveV39{font-size:8px;font-weight:850}
      .runBarV39{display:flex;gap:5px;align-items:flex-end;height:72px}.runColV39{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px}.runColV39 i{display:block;width:100%;max-width:34px;background:#738596;border-radius:4px 4px 0 0;min-height:2px}.runColV39 small{font-size:7px;color:var(--muted)}
      .teamHeaderClickableV39{cursor:pointer!important;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}.teamHeaderClickableV39:hover{background:#dde6e0!important}
      .draftGradeBadgeV38{cursor:pointer!important}.teamDrillSummaryV39{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:7px;margin-bottom:9px}.teamDrillPicksV39{overflow:auto;border:1px solid var(--line);border-radius:10px}.teamDrillPicksV39 table{width:100%;border-collapse:collapse}.teamDrillPicksV39 th,.teamDrillPicksV39 td{padding:7px;border-bottom:1px solid #edf0ed;font-size:9px;text-align:left}.teamDrillPicksV39 th{position:sticky;top:0;background:#e9eeeb}
      .gradeExplainGridV39{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:9px 0}.gradePartV39{border:1px solid var(--line);border-radius:9px;background:#fff;padding:8px;text-align:center}.gradePartV39 b{font-size:17px;display:block}.gradePartV39 small{font-size:7px;color:var(--muted)}
      .valueAtNextV39{display:block;margin-top:2px;font-size:7px;font-weight:800}.valueAtNextV39.gone{color:#9c3831}.valueAtNextV39.coin{color:#8a6410}.valueAtNextV39.safe{color:#0b6a49}
      #careerModal{z-index:1000!important}#teamDrillModalV39,#dashboardModalV39{z-index:650!important}#leagueDraftMainModalV35,#myTeamModalV35{z-index:500!important}
      @media(max-width:1000px){.commandWrapV39{order:5;min-width:190px}.dashCardV39.big,.dashCardV39.med{grid-column:span 12}.dashCardV39.small{grid-column:span 6}.teamDrillSummaryV39{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:650px){.navSepV39{display:none}.dashCardV39.small{grid-column:span 12}.gradeExplainGridV39{grid-template-columns:repeat(2,1fr)}#draftStatusStripV39{gap:8px;padding:5px 8px}}
    `;document.head.appendChild(s);
  }

  function applyDensity(next=density){
    density=next==='comfortable'?'comfortable':'compact';localStorage.setItem(DENSITY_KEY,density);
    document.body.classList.toggle('densityCompactV39',density==='compact');
    document.body.classList.toggle('densityComfortableV39',density==='comfortable');
    const b=document.querySelector('#densityBtnV39');if(b)b.textContent=density==='compact'?'↕ Compact':'↕ Comfortable';
  }
  function installDensity(){
    const bar=document.querySelector('.appbarInner');if(!bar)return;
    let b=document.querySelector('#densityBtnV39');if(!b){b=document.createElement('button');b.id='densityBtnV39';b.className='btn';const cache=document.querySelector('#cacheState');bar.insertBefore(b,cache||null);b.onclick=()=>applyDensity(density==='compact'?'comfortable':'compact')}
    applyDensity();
  }

  function installCommand(){
    const bar=document.querySelector('.appbarInner'),title=bar?.querySelector('.appTitle');if(!bar||!title)return;
    let wrap=document.querySelector('#commandWrapV39');if(!wrap){wrap=document.createElement('div');wrap.id='commandWrapV39';wrap.className='commandWrapV39';wrap.innerHTML='<input id="commandInputV39" class="field commandInputV39" placeholder="Search any player…"><span class="commandKeyV39">Ctrl K</span><div id="commandResultsV39" class="commandResultsV39"></div>';title.insertAdjacentElement('afterend',wrap)}
    const input=wrap.querySelector('#commandInputV39'),results=wrap.querySelector('#commandResultsV39');
    const draw=()=>{
      const q=norm(input.value),rows=q?playersList().filter(p=>norm(`${p.name} ${p.team} ${p.pos}`).includes(q)).sort((a,b)=>Number(a.posRank||99)-Number(b.posRank||99)).slice(0,8):[];
      commandIndex=rows.length?0:-1;results.innerHTML=rows.map((p,i)=>`<button class="commandRowV39 ${i===0?'sel':''}" data-command-player="${esc(p.id)}"><img class="face" src="${headshot(p.id)}" onerror="this.style.visibility='hidden'"><span><b>${esc(p.name)}</b><small>${esc(canonicalTeam(p.team))} · ${esc(p.pos)} · #${p.posRank||'—'} · ${Math.round(Number(p.fantasy||0))} proj FP</small></span><img class="logo" src="${teamLogo(p.team)}" onerror="this.style.display='none'"></button>`).join('');
      results.classList.toggle('open',rows.length>0);
      results.querySelectorAll('[data-command-player]').forEach(b=>b.onclick=()=>{openPlayerFromAnywhere(b.dataset.commandPlayer);input.value='';results.classList.remove('open')});
    };
    input.oninput=draw;input.onfocus=draw;
    input.onkeydown=e=>{
      const rows=[...results.querySelectorAll('[data-command-player]')];
      if(e.key==='ArrowDown'&&rows.length){e.preventDefault();commandIndex=(commandIndex+1)%rows.length}
      else if(e.key==='ArrowUp'&&rows.length){e.preventDefault();commandIndex=(commandIndex-1+rows.length)%rows.length}
      else if(e.key==='Enter'&&rows.length){e.preventDefault();rows[Math.max(0,commandIndex)]?.click();return}
      else if(e.key==='Escape'){results.classList.remove('open');input.blur();return}
      rows.forEach((r,i)=>r.classList.toggle('sel',i===commandIndex));
    };
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))results.classList.remove('open')},{capture:true});
    if(!document.body.dataset.commandKeysV39){document.body.dataset.commandKeysV39='1';document.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select()}else if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(tag)){e.preventDefault();input.focus()}})}
  }

  function installNavArchitecture(){
    const nav=document.querySelector('#viewNav');if(!nav)return;
    const best=document.querySelector('#bestAvailableMainV36'),draft=nav.querySelector('[data-view="draft"]');
    let dash=document.querySelector('#dashboardBtnV39');if(!dash){dash=document.createElement('button');dash.id='dashboardBtnV39';dash.className='btn';dash.textContent='🎯 Dashboard';(best||draft)?.insertAdjacentElement('afterend',dash);dash.onclick=openDashboard}
    nav.querySelectorAll('.navSepV39').forEach(x=>x.remove());
    const overview=nav.querySelector('[data-view="overview"]'),depth=document.querySelector('#exploreBtn');
    for(const anchor of [overview,depth])if(anchor){const sep=document.createElement('span');sep.className='navSepV39';anchor.insertAdjacentElement('beforebegin',sep)}
    const orderLabels={'draft':'📋 Draft Board','overview':'👀 Overview','matrix':'📊 Year Matrix','health':'🩺 Health','weekly':'📅 Weekly Matchups'};
    nav.querySelectorAll('[data-view]').forEach(b=>{if(orderLabels[b.dataset.view])b.textContent=orderLabels[b.dataset.view]});
    if(document.querySelector('#bestAvailableMainV36'))document.querySelector('#bestAvailableMainV36').textContent='⭐ Best Available';
    if(depth)depth.textContent='🪜 Depth';if(document.querySelector('#defenseBtn'))document.querySelector('#defenseBtn').textContent='🛡️ Defense';if(document.querySelector('#kickerBtn'))document.querySelector('#kickerBtn').textContent='🥾 Kicker';if(document.querySelector('#leagueDraftMainV35'))document.querySelector('#leagueDraftMainV35').textContent='🏆 League Draft';if(document.querySelector('#myTeamBtnV35'))document.querySelector('#myTeamBtnV35').textContent='👤 My Team';
    if(!nav.dataset.v39Hash){nav.dataset.v39Hash='1';nav.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setTimeout(()=>{syncContextToolbar();syncDraftBest();updateStatusStrip();syncHashFromUI(b)},30)})}
  }

  function originalPosButton(label){
    const root=document.querySelector('#positions');if(!root)return null;
    return [...root.querySelectorAll('button')].find(b=>norm(b.textContent)===norm(label))||null;
  }
  function syncContextToolbar(){
    let box=document.querySelector('#contextToolbarV39'),nav=document.querySelector('#viewNav');if(!nav)return;
    if(!box){box=document.createElement('div');box.id='contextToolbarV39';box.className='';nav.insertAdjacentElement('afterend',box)}
    const view=typeof currentView==='undefined'?'draft':currentView,draftish=view==='draft';
    const filters=document.querySelector('.draftFilters');if(filters)filters.style.display=draftish?'':'none';
    if(!['overview','matrix','health'].includes(view)){box.classList.remove('show');box.innerHTML='';return}
    const labels={overview:'Overview filters',matrix:'Year Matrix filters',health:'Health filters'};
    const teams=[...new Set(playersList().map(p=>canonicalTeam(p.team)).filter(t=>t&&t!=='FA'&&t!=='—'))].sort();
    box.className='show';box.innerHTML=`<span class="contextTitleV39">${labels[view]}</span><input class="field" id="contextSearchV39" placeholder="Search player…" value="${esc(document.querySelector('#search')?.value||'')}"><span id="contextPosV39">${['ALL','QB','RB','WR','TE','FLEX'].filter(x=>x!=='FLEX'||originalPosButton('FLEX')).map(p=>`<button class="btn contextPosV39" data-context-pos="${p}">${p}</button>`).join('')}</span><select class="field" id="contextTeamV39"><option value="ALL">All teams</option>${teams.map(t=>`<option value="${t}" ${canonicalTeam(typeof state!=='undefined'?state.team:'')===t?'selected':''}>${t}</option>`).join('')}</select><button class="btn" id="contextClearV39">Clear</button>`;
    const search=box.querySelector('#contextSearchV39');search.oninput=()=>{const o=document.querySelector('#search');if(o)o.value=search.value;if(typeof render==='function')render()};
    box.querySelectorAll('[data-context-pos]').forEach(b=>{const ob=originalPosButton(b.dataset.contextPos);b.classList.toggle('on',!!ob&&(ob.classList.contains('on')||ob.classList.contains('posMultiOnV34')));b.onclick=()=>{originalPosButton(b.dataset.contextPos)?.click();setTimeout(syncContextToolbar,0)}});
    box.querySelector('#contextTeamV39').onchange=e=>{if(typeof state!=='undefined'){state.team=e.target.value==='WAS'?'WSH':e.target.value;if(typeof render==='function')render()}};
    box.querySelector('#contextClearV39').onclick=()=>{const o=document.querySelector('#search');if(o)o.value='';originalPosButton('ALL')?.click();if(typeof state!=='undefined')state.team='ALL';if(typeof render==='function')render();setTimeout(syncContextToolbar,0)};
  }

  function syncDraftBest(){
    const view=typeof currentView==='undefined'?'draft':currentView,mode=localStorage.getItem('fantasyLensDraftMainModeV35')||'board',best=document.querySelector('#bestStrip'),table=document.querySelector('#tablewrap'),cards=document.querySelector('#cards'),status=document.querySelector('.status');
    if(view!=='draft'){if(best)best.style.display='none';return}
    if(best)best.style.display=mode==='best'?'block':'none';
    if(table)table.style.display=mode==='best'?'none':'';
    if(cards)cards.style.display=mode==='best'?'none':'';
    if(status)status.style.display=mode==='best'?'none':'';
    const d=document.querySelector('#viewNav [data-view="draft"]'),b=document.querySelector('#bestAvailableMainV36'),dash=document.querySelector('#dashboardBtnV39');
    d?.classList.toggle('on',mode!=='best');b?.classList.toggle('on',mode==='best');dash?.classList.remove('on');
  }

  function rosterNeeds(owner=currentOwner()){
    const b=draftBoard(),r=roster(),cfg=league();if(!owner||!b?.picks)return[];
    const picks=b.picks.filter(p=>p.owner===owner),counts={};picks.forEach(p=>counts[p.pos]=(counts[p.pos]||0)+1);
    const out=[];
    for(const k of ['QB','RB','WR','TE','DEF','K']){const n=Math.max(0,(r[k]||0)-(counts[k]||0));if(n)out.push({pos:k,label:k==='DEF'?'D/ST':k,n,priority:n>0?'starter':'depth'})}
    const flexEligible=new Set(cfg.flex||['RB','WR','TE']),extraFlex=[...flexEligible].reduce((a,p)=>a+Math.max(0,(counts[p]||0)-(r[p]||0)),0),flexNeed=Math.max(0,(r.FLEX||0)-extraFlex);if(flexNeed)out.push({pos:'FLEX',label:'FLEX',n:flexNeed,priority:'starter'});
    const total=r.QB+r.RB+r.WR+r.TE+r.FLEX+r.DEF+r.K+r.BE,benchNeed=Math.max(0,total-picks.length-out.reduce((a,x)=>a+x.n,0));if(benchNeed)out.push({pos:'BE',label:'Bench',n:benchNeed,priority:'depth'});
    return out;
  }

  function currentPickNumber(){const b=draftBoard();if(!b?.picks?.length)return 0;return Math.max(...b.picks.map(p=>overallPick(p,b)).filter(Number.isFinite),b.picks.length)}
  function nextPickForOwner(owner=currentOwner()){
    const b=draftBoard(),n=b?.owners?.length||0;if(!owner||!n)return null;
    const first=b.picks?.find(p=>p.owner===owner&&Number(p.round)===1),firstSlot=Number(first?.slot)||b.owners.indexOf(owner)+1;if(firstSlot<1)return null;
    const cur=currentPickNumber();
    for(let r=1;r<=30;r++){const slot=r%2===1?firstSlot:n-firstSlot+1,p=(r-1)*n+slot;if(p>cur)return{overall:p,round:r,slot}}
    return null;
  }
  function recentRun(windowSize=7){
    const b=draftBoard(),picks=[...(b?.picks||[])].sort((a,b)=>overallPick(a)-overallPick(b)).slice(-windowSize),counts={QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};picks.forEach(p=>counts[p.pos]=(counts[p.pos]||0)+1);
    const [pos,count]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]||['',0];return{picks,counts,pos,count,text:count>=3?`🔥 ${count} ${pos==='DEF'?'D/ST':pos} in last ${picks.length} picks`:`No major positional run in last ${picks.length||0} picks`};
  }
  function availablePlayers(){const drafted=typeof draftedIds!=='undefined'?draftedIds:new Set();return playersList().filter(p=>p.active!==false&&!drafted.has(String(p.id)))}
  function surviveProbability(player,nextPick){
    if(!player||!nextPick)return null;const a=adpConsensus(player.id),rank=a?.avg||projectionRanks().get(String(player.id));if(!Number.isFinite(rank))return null;const sigma=a?6:10,p=1/(1+Math.exp((nextPick-rank)/sigma));return clamp(Math.round(p*100),1,99);
  }
  function survivalLabel(p){return p==null?'No ADP':p<25?'Likely gone':p<60?'50/50':'Likely there'}
  function teamGradeEstimate(owner=currentOwner()){
    const b=draftBoard();if(!owner||!b?.picks?.length)return null;const ranks=projectionRanks(),picks=b.picks.filter(p=>p.owner===owner),scores=[];
    for(const pick of picks){const player=findPlayer(pick),pickNo=overallPick(pick,b);let score=68;
      if(player){const adp=adpConsensus(player.id)?.avg,rank=ranks.get(String(player.id)),basis=adp||rank;if(Number.isFinite(basis))score=clamp(72+(basis-pickNo)*1.5,35,98);if(player.healthPct!=null)score=score*.9+clamp(Number(player.healthPct),40,100)*.1}
      else if(['K','DEF'].includes(pick.pos))score=Number(pick.round)>=10?78:Number(pick.round)>=8?70:58;
      scores.push({pick,score});
    }
    if(!scores.length)return null;let total=0,w=0;scores.forEach((x,i)=>{const wt=Math.max(1,1.35-i*.03);total+=x.score*wt;w+=wt});let s=total/w;const needs=rosterNeeds(owner).filter(x=>x.priority==='starter').reduce((a,x)=>a+x.n,0);s-=Math.min(10,needs*2);s=Math.round(clamp(s,35,99));return{score:s,letter:gradeLetter(s),picks:scores};
  }

  function pickGradeDetail(pick){
    const player=findPlayer(pick),b=draftBoard(),pickNo=overallPick(pick,b),adp=player?adpConsensus(player.id):null,rank=player?projectionRanks().get(String(player.id)):null;
    let value=68;if(player){const basis=adp?.avg||rank;if(Number.isFinite(basis))value=clamp(55+(basis-pickNo)*1.8,20,98)}else if(['K','DEF'].includes(pick.pos))value=Number(pick.round)>=10?82:Number(pick.round)>=8?70:55;
    const projection=player?clamp(Number(player.pct)||55,1,100):65,health=player?.healthPct!=null?clamp(Number(player.healthPct),30,100):75;
    const needs=rosterNeeds(pick.owner),needPos=needs.some(n=>n.pos===pick.pos||(n.pos==='FLEX'&&['RB','WR','TE'].includes(pick.pos))),fit=needPos?95:72;
    const timing=['K','DEF'].includes(pick.pos)?clamp(45+Number(pick.round||1)*4,35,95):clamp(90-(Number(player?.posRank||30)-1)*1.2,45,95);
    const score=Math.round(clamp(value*.4+projection*.25+fit*.15+health*.1+timing*.1,35,99));
    return{score,letter:gradeLetter(score),value:Math.round(value),projection:Math.round(projection),fit:Math.round(fit),health:Math.round(health),timing:Math.round(timing),pickNo,basis:adp?`Consensus ADP ${adp.avg.toFixed(1)} across ${adp.n} source${adp.n===1?'':'s'}`:rank?`Projection rank ${rank}`:'No ADP/projection ranking'};
  }

  function installStatusStrip(){let strip=document.querySelector('#draftStatusStripV39'),header=document.querySelector('.appbar');if(!strip&&header){strip=document.createElement('div');strip.id='draftStatusStripV39';header.insertAdjacentElement('afterend',strip)}updateStatusStrip()}
  function updateStatusStrip(){
    const strip=document.querySelector('#draftStatusStripV39');if(!strip)return;const b=draftBoard(),cur=currentPickNumber(),next=nextPickForOwner(),needs=rosterNeeds().filter(x=>x.priority==='starter'),run=recentRun(7),grade=teamGradeEstimate(),avail=availablePlayers().length;
    const teams=b?.owners?.length||0,total=teams?teams*(roster().QB+roster().RB+roster().WR+roster().TE+roster().FLEX+roster().DEF+roster().K+roster().BE):0;
    strip.innerHTML=`<span class="statusItemV39">🏈 <b>${cur?`Pick ${cur+1}`:'No draft imported'}</b>${total?`<span class="statusMutedV39">of ${total}</span>`:''}</span><span class="statusItemV39">🎯 Next <b>${next?next.overall:'—'}</b>${next?`<span class="statusMutedV39">R${next.round}</span>`:''}</span><span class="statusItemV39">🧩 Need <b>${needs.length?needs.slice(0,3).map(n=>n.label+(n.n>1?'×'+n.n:'')).join(' / '):currentOwner()?'Bench / depth':'declare My Team'}</b></span><span class="statusItemV39">${run.count>=3?'🔥':'↔️'} <b>${esc(run.text.replace(/^🔥\s*/,''))}</b></span><span class="statusItemV39">📦 <b>${avail}</b><span class="statusMutedV39">skill players available</span></span><span class="statusItemV39">📝 Grade <b>${grade?grade.letter+' '+grade.score:'—'}</b></span>`;
  }

  function dashboardPlayerRows(list,next){
    return list.slice(0,8).map(p=>{const prob=surviveProbability(p,next?.overall),cls=prob==null?'':prob<25?'gone':prob<60?'coin':'safe';return`<div class="dashPlayerV39" data-dash-player="${esc(p.id)}"><img src="${headshot(p.id)}" onerror="this.style.visibility='hidden'"><span><b>${esc(p.name)}</b><small>${esc(canonicalTeam(p.team))} · ${esc(p.pos)} #${p.posRank||'—'} · ${Math.round(Number(p.fantasy||0))} FP${adpConsensus(p.id)?' · ADP '+adpConsensus(p.id).avg.toFixed(1):''}</small></span><span class="surviveV39 ${cls}">${prob==null?'—':prob+'%'}<small style="display:block">${survivalLabel(prob)}</small></span></div>`}).join('');
  }
  function ensureDashboard(){
    let m=document.querySelector('#dashboardModalV39');if(m)return m;m=document.createElement('div');m.className='modal fullV39';m.id='dashboardModalV39';m.innerHTML='<div class="modalbox"><div class="modalhead"><div><h2>🎯 Draft Dashboard</h2><small style="color:#aebdca">Next pick · roster needs · positional runs · value-at-next-pick</small></div><button class="btn close" id="closeDashboardV39">×</button></div><div class="careerbody" id="dashboardBodyV39"></div></div>';document.body.appendChild(m);m.querySelector('#closeDashboardV39').onclick=()=>{m.classList.remove('open');document.querySelector('#dashboardBtnV39')?.classList.remove('on');syncHashView()};m.onclick=e=>{if(e.target===m)m.querySelector('#closeDashboardV39').click()};return m;
  }
  function openDashboard(){const m=ensureDashboard();renderDashboard();m.classList.add('open');document.querySelector('#dashboardBtnV39')?.classList.add('on');writeHash({view:'dashboard'})}
  function renderDashboard(){
    const root=document.querySelector('#dashboardBodyV39');if(!root)return;const owner=currentOwner(),next=nextPickForOwner(owner),needs=rosterNeeds(owner),run=recentRun(7),grade=teamGradeEstimate(owner),available=availablePlayers(),flex=new Set(league().flex||['RB','WR','TE']);
    const priorityPositions=new Set(needs.filter(n=>n.priority==='starter').flatMap(n=>n.pos==='FLEX'?[...flex]:n.pos==='BE'?[]:[n.pos]));
    const needAvail=[...available].filter(p=>!priorityPositions.size||priorityPositions.has(p.pos)).sort((a,b)=>Number(b.fantasy||0)-Number(a.fantasy||0));
    const valueAvail=[...available].sort((a,b)=>{const pa=surviveProbability(a,next?.overall)??100,pb=surviveProbability(b,next?.overall)??100;const ra=Number(a.posRank||99),rb=Number(b.posRank||99);return (pa-pb)||ra-rb});
    const counts=run.counts,max=Math.max(1,...Object.values(counts));
    root.innerHTML=`<div class="dashGridV39"><section class="dashCardV39 small"><h3>Next pick</h3><div class="dashMetricV39">${next?next.overall:'—'}</div><div class="dashSubV39">${next?`Round ${next.round}, slot ${next.slot} · ${Math.max(0,next.overall-currentPickNumber()-1)} picks away`:'Declare My Team + import owner-tagged results'}</div></section><section class="dashCardV39 small"><h3>Team grade</h3><div class="dashMetricV39">${grade?grade.letter:'—'}</div><div class="dashSubV39">${grade?grade.score+'/100 current draft estimate':'Needs imported team ownership'}</div></section><section class="dashCardV39 small"><h3>Roster needs</h3><div class="needsV39">${needs.length?needs.map(n=>`<span class="needChipV39 ${n.priority==='starter'?'hot':''}">${esc(n.label)}${n.n>1?' ×'+n.n:''}</span>`).join(''):'<span class="dashSubV39">No declared team / starter needs filled</span>'}</div></section><section class="dashCardV39 small"><h3>Current run</h3><div style="font-size:14px;font-weight:800">${esc(run.text)}</div><div class="runBarV39">${Object.entries(counts).map(([p,c])=>`<span class="runColV39"><i style="height:${Math.round(c/max*52)}px"></i><small>${p==='DEF'?'DST':p} ${c}</small></span>`).join('')}</div></section><section class="dashCardV39 big"><h3>Best available for your needs</h3><div class="dashListV39">${dashboardPlayerRows(needAvail,next)||'<div class="dashSubV39">Load player data to populate recommendations.</div>'}</div></section><section class="dashCardV39 big"><h3>Value at next pick</h3><div class="dashSubV39" style="margin-bottom:7px">Survival estimate uses imported consensus ADP when available; projection rank is the fallback. Low survival = consider taking now.</div><div class="dashListV39">${dashboardPlayerRows(valueAvail,next)||'<div class="dashSubV39">Import ADP to improve this estimate.</div>'}</div></section></div>`;
    root.querySelectorAll('[data-dash-player]').forEach(x=>x.onclick=()=>openPlayerFromAnywhere(x.dataset.dashPlayer,'dashboardModalV39'));
  }

  function decorateBestValue(){
    const root=document.querySelector('#bestStrip');if(!root)return;const next=nextPickForOwner();
    root.querySelectorAll('.bestAvailWhoV33').forEach(who=>{who.querySelectorAll('.valueAtNextV39').forEach(x=>x.remove());const name=who.querySelector('b')?.textContent||'',p=playersList().find(x=>norm(x.name)===norm(name));if(!p)return;const prob=surviveProbability(p,next?.overall),tag=document.createElement('span');tag.className='valueAtNextV39 '+(prob==null?'':prob<25?'gone':prob<60?'coin':'safe');tag.textContent=next?`Next pick: ${prob==null?'no ADP':prob+'% survive · '+survivalLabel(prob)}`:'Declare My Team for next-pick odds';who.querySelector('.bestAvailTextV35')?.appendChild(tag)||who.appendChild(tag)});
  }

  function ensureTeamDrill(){
    let m=document.querySelector('#teamDrillModalV39');if(m)return m;m=document.createElement('div');m.className='modal fullV39';m.id='teamDrillModalV39';m.innerHTML='<div class="modalbox"><div class="modalhead"><div><h2 id="teamDrillTitleV39">Team Draft Review</h2><small id="teamDrillSubV39" style="color:#aebdca"></small></div><button class="btn close" id="closeTeamDrillV39">×</button></div><div class="careerbody" id="teamDrillBodyV39"></div></div>';document.body.appendChild(m);m.querySelector('#closeTeamDrillV39').onclick=()=>m.classList.remove('open');m.onclick=e=>{if(e.target===m)m.classList.remove('open')};return m;
  }
  function openTeamDrill(owner){
    const m=ensureTeamDrill(),b=draftBoard(),picks=(b?.picks||[]).filter(p=>p.owner===owner).sort((a,b)=>overallPick(a)-overallPick(b)),grade=teamGradeEstimate(owner),counts={};picks.forEach(p=>counts[p.pos]=(counts[p.pos]||0)+1);
    m.querySelector('#teamDrillTitleV39').textContent=`🏆 ${owner}`;m.querySelector('#teamDrillSubV39').textContent=`${picks.length} picks · click any skill player for full profile`;
    m.querySelector('#teamDrillBodyV39').innerHTML=`<div class="teamDrillSummaryV39"><div class="profileMetricV38"><b>${grade?grade.letter:'—'}</b><small>OVERALL GRADE</small></div><div class="profileMetricV38"><b>${grade?grade.score:'—'}</b><small>SCORE / 100</small></div><div class="profileMetricV38"><b>${counts.RB||0}/${counts.WR||0}</b><small>RB / WR</small></div><div class="profileMetricV38"><b>${counts.QB||0}/${counts.TE||0}</b><small>QB / TE</small></div><div class="profileMetricV38"><b>${(counts.K||0)+(counts.DEF||0)}</b><small>K + D/ST</small></div></div><div class="teamDrillPicksV39"><table><thead><tr><th>Pick</th><th>Player</th><th>Pos</th><th>ADP</th><th>Grade</th><th>Why</th></tr></thead><tbody>${picks.map(p=>{const g=pickGradeDetail(p),pl=findPlayer(p),adp=pl?adpConsensus(pl.id):null;return`<tr><td>#${g.pickNo}<small style="display:block;color:var(--muted)">R${p.round||'—'}</small></td><td>${pl?`<button class="btn" data-team-player="${esc(pl.id)}">${esc(p.display)}</button>`:esc(p.display)}</td><td>${p.pos==='DEF'?'D/ST':esc(p.pos)}</td><td>${adp?adp.avg.toFixed(1):'—'}</td><td><button class="draftGradeBadgeV38 ${g.score>=90?'gradeA':g.score>=80?'gradeB':g.score>=70?'gradeC':g.score>=60?'gradeD':'gradeF'}" data-team-grade-pick="${esc(p.seq||g.pickNo)}"><strong>${g.letter}</strong> ${g.score}</button></td><td>${esc(g.basis)}</td></tr>`}).join('')}</tbody></table></div>`;
    const body=m.querySelector('#teamDrillBodyV39');body.querySelectorAll('[data-team-player]').forEach(x=>x.onclick=()=>openPlayerFromAnywhere(x.dataset.teamPlayer,'teamDrillModalV39'));body.querySelectorAll('[data-team-grade-pick]').forEach(x=>x.onclick=()=>{const p=picks.find(p=>String(p.seq||overallPick(p))===String(x.dataset.teamGradePick));if(p)openPickDrill(p)});m.classList.add('open');
  }
  function openPickDrill(pick){
    const m=ensureTeamDrill(),g=pickGradeDetail(pick),pl=findPlayer(pick);m.querySelector('#teamDrillTitleV39').textContent=`Pick #${g.pickNo} — ${pick.display}`;m.querySelector('#teamDrillSubV39').textContent=`${pick.owner} · Round ${pick.round||'—'} · ${g.basis}`;
    m.querySelector('#teamDrillBodyV39').innerHTML=`<div class="teamDrillSummaryV39"><div class="profileMetricV38"><b>${g.letter}</b><small>PICK GRADE</small></div><div class="profileMetricV38"><b>${g.score}</b><small>SCORE / 100</small></div><div class="profileMetricV38"><b>#${g.pickNo}</b><small>OVERALL PICK</small></div><div class="profileMetricV38"><b>${pl?'#'+(pl.posRank||'—'):'—'}</b><small>POSITION RANK</small></div><div class="profileMetricV38"><b>${pl&&adpConsensus(pl.id)?adpConsensus(pl.id).avg.toFixed(1):'—'}</b><small>CONSENSUS ADP</small></div></div><div class="gradeExplainGridV39">${[['Value',g.value],['Projection',g.projection],['Roster fit',g.fit],['Health',g.health],['Timing',g.timing]].map(([l,v])=>`<div class="gradePartV39"><b>${v}</b><small>${l.toUpperCase()}</small></div>`).join('')}</div><div class="profilePanelV38"><h3>Grade explanation</h3><p style="font-size:9px;line-height:1.5;margin:0">40% draft value, 25% projected positional strength, 15% roster fit, 10% availability, and 10% positional/timing value. ${esc(g.basis)}. This is a Fantasy Lens heuristic intended for relative draft analysis, not a prediction of season outcome.</p>${pl?`<button class="btn" id="pickProfileV39" style="margin-top:9px">Open ${esc(pl.name)} profile</button>`:''}</div>`;
    m.querySelector('#pickProfileV39')?.addEventListener('click',()=>openPlayerFromAnywhere(pl.id,'teamDrillModalV39'));m.classList.add('open');
  }

  function decorateLeagueBoard(){
    const modal=document.querySelector('#leagueDraftMainModalV35'),table=modal?.querySelector('.leagueBoardV35'),b=draftBoard();if(!table||!b?.owners?.length)return;
    const ths=[...table.querySelectorAll('thead th')].slice(1);ths.forEach((th,i)=>{const owner=b.owners[i];if(!owner||th.dataset.v39Owner===owner)return;th.dataset.v39Owner=owner;th.classList.add('teamHeaderClickableV39');th.title='Open team draft review';th.onclick=e=>{if(e.target.closest('.draftGradeBadgeV38'))return;openTeamDrill(owner)};const tg=th.querySelector('.draftGradeBadgeV38');if(tg)tg.onclick=e=>{e.stopPropagation();openTeamDrill(owner)}});
    const rounds=[...new Set((b.picks||[]).map(p=>Number(p.round)||1))].sort((a,b)=>a-b),by=new Map();for(const p of b.picks)by.set(`${Number(p.round)||1}|${p.owner}`,p);
    [...table.querySelectorAll('tbody tr')].forEach((tr,ri)=>{const round=rounds[ri]||Number(tr.firstElementChild?.textContent.replace(/\D/g,''))||1;[...tr.children].slice(1).forEach((td,ci)=>{const p=by.get(`${round}|${b.owners[ci]}`),badge=td.querySelector('.draftGradeBadgeV38');if(p&&badge&&!badge.dataset.v39Grade){badge.dataset.v39Grade='1';badge.title=(badge.title?badge.title+' · ':'')+'Click for grade breakdown';badge.onclick=e=>{e.stopPropagation();openPickDrill(p)}}})});
  }
  function observeLeague(){const modal=document.querySelector('#leagueDraftMainModalV35');if(!modal)return;if(leagueObserver)leagueObserver.disconnect();leagueObserver=new MutationObserver(()=>setTimeout(decorateLeagueBoard,20));leagueObserver.observe(modal,{childList:true,subtree:true});decorateLeagueBoard()}

  function openPlayerFromAnywhere(id,sourceModal){if(sourceModal)document.querySelector('#'+sourceModal)?.classList.remove('open');document.querySelector('#leagueDraftMainModalV35')?.classList.remove('open');setTimeout(()=>{if(typeof window.career==='function')window.career(String(id));else if(typeof career==='function')career(String(id));writeHash({player:String(id)})},25)}

  function hashParams(){return new URLSearchParams(location.hash.replace(/^#/,''))}
  function writeHash(updates,replace=true){if(applyingHash)return;const q=hashParams();for(const [k,v] of Object.entries(updates)){if(v==null||v==='')q.delete(k);else q.set(k,String(v))}const h='#'+q.toString();if(location.hash===h)return;replace?history.replaceState(null,'',h):location.hash=h}
  function syncHashView(){const view=typeof currentView==='undefined'?'draft':currentView,mode=localStorage.getItem('fantasyLensDraftMainModeV35')||'board';writeHash({view:view==='draft'&&mode==='best'?'best':view,player:null,tab:null,year:null})}
  function syncHashFromUI(button){if(button.id==='dashboardBtnV39'){writeHash({view:'dashboard'});return}if(button.id==='bestAvailableMainV36'){writeHash({view:'best'});return}if(button.id==='exploreBtn'){writeHash({view:'depth'});return}if(button.id==='defenseBtn'){writeHash({view:'defense'});return}if(button.id==='kickerBtn'){writeHash({view:'kicker'});return}if(button.id==='leagueDraftMainV35'){writeHash({view:'league'});return}if(button.id==='myTeamBtnV35'){writeHash({view:'myteam'});return}if(button.dataset.view)writeHash({view:button.dataset.view})}
  function applyHash(){clearTimeout(hashTimer);hashTimer=setTimeout(()=>{const q=hashParams(),view=q.get('view'),player=q.get('player'),tab=q.get('tab'),year=q.get('year');applyingHash=true;try{const click=id=>document.querySelector(id)?.click();if(view==='best')click('#bestAvailableMainV36');else if(view==='dashboard')openDashboard();else if(view==='depth')click('#exploreBtn');else if(view==='defense')click('#defenseBtn');else if(view==='kicker')click('#kickerBtn');else if(view==='league')click('#leagueDraftMainV35');else if(view==='myteam')click('#myTeamBtnV35');else if(['draft','overview','matrix','health','weekly'].includes(view))click(`#viewNav [data-view="${view}"]`);if(player)setTimeout(()=>{if(typeof window.career==='function')window.career(player);setTimeout(()=>{if(tab){const b=[...document.querySelectorAll('#profileChromeV38 [data-profile-tab]')].find(x=>x.dataset.profileTab===tab);b?.click()}if(year){const s=document.querySelector('#profileWeekYearV38');if(s){s.value=year;s.dispatchEvent(new Event('change',{bubbles:true}))}}},250)},180)}finally{setTimeout(()=>applyingHash=false,500)}},20)}
  function installDeepLinks(){if(!window._fantasyV39Hash){window._fantasyV39Hash=true;window.addEventListener('hashchange',applyHash)}const modal=document.querySelector('#careerModal');if(modal&&!modal.dataset.v39Hash){modal.dataset.v39Hash='1';modal.addEventListener('click',e=>{const b=e.target.closest('[data-profile-tab]');if(b)writeHash({tab:b.dataset.profileTab})});modal.addEventListener('change',e=>{if(e.target.id==='profileWeekYearV38')writeHash({tab:'weekly',year:e.target.value})})}if(location.hash)applyHash();else syncHashView()}

  function wrapRender(){if(renderWrapped||typeof window.render!=='function')return;const old=window.render;window.render=function(){const out=old.apply(this,arguments);setTimeout(()=>{installNavArchitecture();syncContextToolbar();syncDraftBest();decorateBestValue();decorateLeagueBoard();updateStatusStrip()},0);return out};renderWrapped=true}
  function observeBest(){const root=document.querySelector('#bestStrip');if(!root)return;if(bestObserver)bestObserver.disconnect();bestObserver=new MutationObserver(()=>setTimeout(decorateBestValue,20));bestObserver.observe(root,{childList:true,subtree:true});decorateBestValue()}

  function activate(){
    if(activated){installNavArchitecture();installCommand();syncContextToolbar();syncDraftBest();observeLeague();observeBest();decorateBestValue();decorateLeagueBoard();updateStatusStrip();return}
    activated=true;
    addStyles();installDensity();installCommand();installNavArchitecture();installStatusStrip();syncContextToolbar();syncDraftBest();ensureDashboard();ensureTeamDrill();observeLeague();observeBest();wrapRender();installDeepLinks();decorateBestValue();decorateLeagueBoard();updateStatusStrip();
    const run=document.querySelector('#run');if(run&&!run.dataset.v39Bound){run.dataset.v39Bound='1';run.addEventListener('click',()=>setTimeout(()=>{installCommand();renderDashboard();updateStatusStrip();decorateBestValue()},1200))}
    const imp=document.querySelector('#parseDraftBtn');if(imp&&!imp.dataset.v39Bound){imp.dataset.v39Bound='1';imp.addEventListener('click',()=>setTimeout(()=>{updateStatusStrip();renderDashboard();decorateLeagueBoard();decorateBestValue()},800))}
    setInterval(()=>{updateStatusStrip();decorateLeagueBoard()},2500);
  }
  window.addEventListener('load',()=>{setTimeout(activate,1700);setTimeout(activate,3200)});
})();
