/* Fantasy Lens v38 — draft grades, clean draft/best split, and unified player profile. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@8c05f9971d71acad6ebcdb82dc6cfd1220a77ea4/fantasy-football.js"><\/script>');

(function(){
  const BOARD_KEY='fantasyLensLeagueDraftBoardV1';
  const ADP_KEY='fantasyLensAdpSourcesV1';
  const ROSTER_KEY='fantasyLensRosterSettingsV37';
  const LEAGUE_KEY='fantasyLensLeagueSettingsV1';
  const SPECIAL_CACHE='fantasyLensBestSpecialV33';
  const ESPN_DEFAULT={QB:1,RB:2,WR:2,TE:1,FLEX:1,DEF:1,K:1,BE:7};
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const readJson=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||'null');return x??f}catch{return f}};
  const canonicalTeam=v=>{const t=String(v||'').toUpperCase().trim();if(['WAS','WSH','WFT'].includes(t))return'WAS';if(t==='LA')return'LAR';return t};
  const teamSlug=t=>canonicalTeam(t)==='WAS'?'wsh':canonicalTeam(t).toLowerCase();
  const teamLogo=t=>t?`https://a.espncdn.com/i/teamlogos/nfl/500/${teamSlug(t)}.png`:'';
  const espnFace=id=>id?`https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(id)}.png`:'';
  let oldCareer=null, oldSeasonLog=null, profileToken=0, boardObserver=null, renderWrapped=false, grading=false;
  const weekRankCache=new Map(), scheduleCache=new Map();

  function playersList(){return typeof players!=='undefined'&&Array.isArray(players)?players:[]}
  function board(){return readJson(BOARD_KEY,null)}
  function roster(){return Object.assign({},ESPN_DEFAULT,readJson(ROSTER_KEY,{}))}
  function league(){return Object.assign({flex:['RB','WR','TE']},readJson(LEAGUE_KEY,{}))}
  function findPlayer(pick){
    const ps=playersList();
    if(pick?.playerId){const h=ps.find(p=>String(p.id)===String(pick.playerId));if(h)return h}
    const n=norm(pick?.display||pick?.name||'');return n?ps.find(p=>norm(p.name)===n)||null:null;
  }
  function seasonPlayer(id,y){return (typeof seasonData!=='undefined'&&seasonData?.[y]||[]).find(p=>String(p.id)===String(id))||null}

  function addStyles(){
    if(document.querySelector('#fantasyLensV38Styles'))return;
    const s=document.createElement('style');s.id='fantasyLensV38Styles';s.textContent=`
      #careerModal{z-index:520!important}#careerModal .modalbox{width:min(1280px,96vw)!important;max-width:1280px!important;min-height:78vh;max-height:94vh;display:flex;flex-direction:column}#careerModal .careerbody{min-height:0;overflow:auto}
      #leagueDraftMainModalV35,#myTeamModalV35{z-index:210!important}
      .draftGradeBadgeV38{display:inline-flex;align-items:center;justify-content:center;gap:3px;border-radius:7px;padding:3px 5px;font-size:7px;font-weight:900;line-height:1;white-space:nowrap;background:#ffffffde;color:#17212b;box-shadow:0 1px 4px #0002}.draftGradeBadgeV38 strong{font-size:9px}.draftGradeBadgeV38.gradeA{background:#d9f4e6;color:#0a5d3d}.draftGradeBadgeV38.gradeB{background:#e6f2d2;color:#47600c}.draftGradeBadgeV38.gradeC{background:#fff0c2;color:#725000}.draftGradeBadgeV38.gradeD{background:#f8d8c9;color:#8a3a18}.draftGradeBadgeV38.gradeF{background:#f4cccc;color:#8b2222}
      .leaguePickV35{position:relative}.leaguePickV35>.draftGradeBadgeV38{position:absolute;top:4px;right:4px}.leaguePickV35 .leaguePickLogoV35{margin-top:16px}.teamGradeV38{display:flex;align-items:center;gap:5px;margin-top:4px}.teamGradeV38 small{font-size:7px;color:var(--muted);font-weight:700}.gradeExplainV38{font-size:8px;color:var(--muted);padding:6px 8px;border:1px solid var(--line);background:#fff;border-radius:9px}
      #draftModeTabsV35{display:none!important}
      .profileTabsV38{display:flex;gap:5px;align-items:center;margin:10px 0 8px;position:sticky;top:0;z-index:3;background:var(--paper);padding:5px 0}.profileTabsV38 .on{background:var(--navy)!important;color:#fff!important}.profileQuickV38{display:grid;grid-template-columns:repeat(6,minmax(110px,1fr));gap:6px;margin:9px 0}.profileMetricV38{border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px}.profileMetricV38 b{display:block;font-size:17px;line-height:1.05}.profileMetricV38 small{display:block;color:var(--muted);font-size:7px;margin-top:3px;font-weight:800}.profileOverviewV38{display:grid;grid-template-columns:1fr 1fr;gap:8px}.profilePanelV38{background:#fff;border:1px solid var(--line);border-radius:11px;padding:10px}.profilePanelV38 h3{font-size:11px;margin:0 0 7px}.profileListV38{display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:9px}.profileListV38 span:nth-child(odd){color:var(--muted)}
      .profileYearTableV38,.profileWeekTableV38{min-width:900px}.profileYearTableV38 td,.profileYearTableV38 th,.profileWeekTableV38 td,.profileWeekTableV38 th{font-size:9px;padding:7px}.profileWeekControlsV38{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.profileWeekSummaryV38{display:grid;grid-template-columns:repeat(4,minmax(100px,1fr));gap:6px;margin:7px 0}.profileWeekSummaryV38 .profileMetricV38 b{font-size:15px}.weeklyRankGoodV38{font-weight:900;color:#0b6a49}.weeklyRankMidV38{font-weight:900;color:#8a6410}.weeklyRankLowV38{font-weight:900;color:#9c3831}
      .profileBackV38{margin-left:auto}.profileHeroSubV38{display:flex;gap:5px;align-items:center;flex-wrap:wrap;color:var(--muted);font-size:9px}.profileHeroSubV38 img{width:18px;height:18px;object-fit:contain}
      @media(max-width:900px){.profileQuickV38{grid-template-columns:repeat(3,1fr)}.profileOverviewV38{grid-template-columns:1fr}.profileWeekSummaryV38{grid-template-columns:repeat(2,1fr)}}
    `;document.head.appendChild(s);
  }

  function adpConsensus(id){
    const all=readJson(ADP_KEY,{}),vals=[];
    for(const src of Object.values(all||{})){const v=Number(src?.ranks?.[String(id)]);if(Number.isFinite(v))vals.push(v)}
    return vals.length?{avg:vals.reduce((a,b)=>a+b,0)/vals.length,min:Math.min(...vals),max:Math.max(...vals),n:vals.length}:null;
  }
  function projectionRanks(){const rows=[...playersList()].sort((a,b)=>Number(b.fantasy||0)-Number(a.fantasy||0)),m=new Map();rows.forEach((p,i)=>m.set(String(p.id),i+1));return m}
  function specialBoard(){const hit=readJson(SPECIAL_CACHE,null);return hit?.value||hit||{kickers:[],defenses:[]}}
  function specialRank(pick){const sp=specialBoard();if(pick.pos==='DEF'){const x=(sp.defenses||[]).find(d=>canonicalTeam(d.team)===canonicalTeam(pick.nflTeam));return Number(x?.rank)||null}if(pick.pos==='K'){const x=(sp.kickers||[]).find(k=>norm(k.name)===norm(pick.display));return Number(x?.rank)||null}return null}
  function overallPick(pick,b){
    const n=b?.owners?.length||0,r=Math.max(1,Number(pick.round)||1),slot=Number(pick.slot);
    if(n&&Number.isFinite(slot)&&slot>=1&&slot<=n)return (r-1)*n+(r%2===1?slot:n-slot+1);
    return Number(pick.seq)||r;
  }
  function needScore(pick,prior,r,cfg){
    const pos=pick.pos,counts={};for(const p of prior)counts[p.pos]=(counts[p.pos]||0)+1;
    const need={QB:r.QB,RB:r.RB,WR:r.WR,TE:r.TE,DEF:r.DEF,K:r.K};
    if(pos==='DEF'||pos==='K')return (counts[pos]||0)<(need[pos]||0)?12:5;
    if((counts[pos]||0)<(need[pos]||0))return 15;
    const flex=new Set(cfg.flex||['RB','WR','TE']),flexUsed=prior.filter(p=>flex.has(p.pos)).length-(r.RB+r.WR+r.TE);
    if(flex.has(pos)&&flexUsed<r.FLEX)return 13;
    return 9;
  }
  function timingScore(pick,player){
    const round=Number(pick.round)||1;
    if(['K','DEF'].includes(pick.pos))return round>=12?10:round>=10?8:round>=8?5:round>=6?2:0;
    const pr=Number(player?.posRank)||40;return clamp(10-(pr-1)*0.22,3,10);
  }
  function letter(score){if(score>=97)return'A+';if(score>=93)return'A';if(score>=90)return'A-';if(score>=87)return'B+';if(score>=83)return'B';if(score>=80)return'B-';if(score>=77)return'C+';if(score>=73)return'C';if(score>=70)return'C-';if(score>=67)return'D+';if(score>=63)return'D';if(score>=60)return'D-';return'F'}
  function gradeClass(score){return score>=90?'gradeA':score>=80?'gradeB':score>=70?'gradeC':score>=60?'gradeD':'gradeF'}
  function gradePick(pick,b,rankMap,r,cfg){
    const player=findPlayer(pick),pickNo=overallPick(pick,b),prior=(b.picks||[]).filter(x=>x.owner===pick.owner&&overallPick(x,b)<pickNo),adp=player?adpConsensus(player.id):null,projRank=player?rankMap.get(String(player.id)):null,sRank=specialRank(pick);
    let valueBasis=adp?.avg||projRank||null,valueScore;
    if(['K','DEF'].includes(pick.pos))valueScore=clamp(62+(sRank?Math.max(-12,18-sRank):0)+(Number(pick.round||1)>=10?10:0),35,92);
    else if(valueBasis)valueScore=clamp(55+(valueBasis-pickNo)*1.8,15,98);else valueScore=58;
    const projPct=player?clamp(Number(player.pct)||55,1,100):sRank?clamp(105-sRank*3,25,100):55;
    const need=needScore(pick,prior,r,cfg),health=player&&player.healthPct!=null&&Number.isFinite(Number(player.healthPct))?clamp(Number(player.healthPct),30,100):75,timing=timingScore(pick,player);
    const raw=valueScore*.40+projPct*.25+need/15*15+health*.10+timing;
    const score=Math.round(clamp(raw,35,99));
    const basis=adp?`Consensus ADP ${adp.avg.toFixed(1)} (${adp.n} source${adp.n===1?'':'s'})`:projRank?`Projection rank ${projRank}`:sRank?`${pick.pos==='DEF'?'D/ST':'K'} projection rank ${sRank}`:'No ADP/projection rank';
    return{score,letter:letter(score),pickNo,valueScore:Math.round(valueScore),projPct:Math.round(projPct),need,health:Math.round(health),timing,basis};
  }
  function teamGrade(owner,b,grades,r){
    const picks=(b.picks||[]).filter(p=>p.owner===owner),gs=picks.map(p=>grades.get(p));if(!gs.length)return{score:0,letter:'—'};
    let sum=0,w=0;gs.forEach((g,i)=>{const wt=Math.max(1,1.35-i*.035);sum+=g.score*wt;w+=wt});let score=sum/w;
    const starters=r.QB+r.RB+r.WR+r.TE+r.FLEX+r.DEF+r.K;
    if(picks.length>=starters){const c={};picks.forEach(p=>c[p.pos]=(c[p.pos]||0)+1);let miss=0;for(const k of ['QB','RB','WR','TE','DEF','K'])miss+=Math.max(0,(r[k]||0)-(c[k]||0));const flexNeed=Math.max(0,r.FLEX-Math.max(0,(c.RB||0)-r.RB)-Math.max(0,(c.WR||0)-r.WR)-Math.max(0,(c.TE||0)-r.TE));miss+=flexNeed;score-=Math.min(8,miss*2.5)}
    score=Math.round(clamp(score,35,99));return{score,letter:letter(score)};
  }

  function gradeLeagueBoard(){
    const modal=document.querySelector('#leagueDraftMainModalV35'),table=modal?.querySelector('.leagueBoardV35'),b=board();if(!modal||!table||!b?.picks?.length||grading)return;
    grading=true;boardObserver?.disconnect();
    const rankMap=projectionRanks(),r=roster(),cfg=league(),grades=new Map();for(const p of b.picks)grades.set(p,gradePick(p,b,rankMap,r,cfg));
    const headers=[...table.querySelectorAll('thead th')].slice(1);headers.forEach((th,i)=>{th.querySelector('.teamGradeV38')?.remove();const owner=b.owners?.[i];if(!owner)return;const g=teamGrade(owner,b,grades,r),box=document.createElement('div');box.className='teamGradeV38';box.innerHTML=`<span class="draftGradeBadgeV38 ${gradeClass(g.score)}"><strong>${g.letter}</strong> ${g.score}</span><small>team grade</small>`;th.appendChild(box)});
    const rounds=[...new Set((b.picks||[]).map(p=>Number(p.round)||1))].sort((a,b)=>a-b),by=new Map();for(const p of b.picks)by.set(`${Number(p.round)||1}|${p.owner}`,p);
    [...table.querySelectorAll('tbody tr')].forEach((tr,ri)=>{const round=rounds[ri]||Number(tr.firstElementChild?.textContent.replace(/\D/g,''))||1;[...tr.children].slice(1).forEach((td,ci)=>{const p=by.get(`${round}|${b.owners?.[ci]}`),card=td.querySelector('.leaguePickV35');if(!p||!card)return;card.querySelector('.draftGradeBadgeV38')?.remove();const g=grades.get(p),badge=document.createElement('span');badge.className=`draftGradeBadgeV38 ${gradeClass(g.score)}`;badge.title=`Pick ${g.pickNo}: ${g.basis}. Value ${g.valueScore}/100; projection ${g.projPct}/100; roster fit ${g.need}/15; health ${g.health}/100; timing ${g.timing}/10.`;badge.innerHTML=`<strong>${g.letter}</strong> ${g.score}`;card.appendChild(badge);const btn=card.querySelector('.leaguePickNameV35'),player=findPlayer(p);if(btn&&player){btn.dataset.v38Profile=player.id;btn.classList.add('clickableV35')}})});
    let explain=modal.querySelector('.gradeExplainV38');if(!explain){explain=document.createElement('div');explain.className='gradeExplainV38';const bar=modal.querySelector('.leagueBoardToolbarV35');bar?.insertAdjacentElement('afterend',explain)}if(explain)explain.textContent='Draft grades: 40% value vs imported consensus ADP (projection rank fallback), 25% projected positional strength, 15% roster fit, 10% availability, 10% positional/timing context. Team grade is a weighted average of picks with a roster-construction adjustment.';
    grading=false;if(boardObserver)boardObserver.observe(modal,{childList:true,subtree:true});
  }

  function closeBlockingModals(){for(const id of ['leagueDraftMainModalV35','myTeamModalV35','compareModal','exploreModal','defenseModal','kickerModal'])document.querySelector('#'+id)?.classList.remove('open')}
  function bindLeagueProfileClick(){
    const modal=document.querySelector('#leagueDraftMainModalV35');if(!modal||modal.dataset.v38Click==='1')return;modal.dataset.v38Click='1';modal.addEventListener('click',e=>{const b=e.target.closest('[data-v38-profile]');if(!b)return;e.preventDefault();e.stopPropagation();const id=b.dataset.v38Profile;closeBlockingModals();setTimeout(()=>openProfile(id,'overview'),30)},true)
  }
  function observeLeagueBoard(){
    const modal=document.querySelector('#leagueDraftMainModalV35');if(!modal)return;if(boardObserver)boardObserver.disconnect();boardObserver=new MutationObserver(()=>{clearTimeout(boardObserver._t);boardObserver._t=setTimeout(()=>{gradeLeagueBoard();bindLeagueProfileClick()},40)});boardObserver.observe(modal,{childList:true,subtree:true});gradeLeagueBoard();bindLeagueProfileClick();
  }

  function syncDraftVsBest(){
    const isDraft=typeof currentView==='undefined'||currentView==='draft',mode=localStorage.getItem('fantasyLensDraftMainModeV35')||'board',best=document.querySelector('#bestStrip'),table=document.querySelector('#tablewrap'),cards=document.querySelector('#cards'),status=document.querySelector('.status'),empty=document.querySelector('#empty');
    if(!isDraft)return;if(mode==='best'){if(best)best.style.display='block';if(table)table.style.display='none';if(cards)cards.style.display='none';if(status)status.style.display='none';if(empty)empty.style.display='none'}else{if(best)best.style.display='none';if(table)table.style.display='block';if(status)status.style.display='flex';if(empty&&playersList().length)empty.style.display='none'}
  }
  function wireDraftBest(){
    const draft=document.querySelector('#viewNav [data-view="draft"]'),best=document.querySelector('#bestAvailableMainV36');if(draft&&!draft.dataset.v38Clean){draft.dataset.v38Clean='1';draft.addEventListener('click',()=>{localStorage.setItem('fantasyLensDraftMainModeV35','board');setTimeout(syncDraftVsBest,0)})}if(best&&!best.dataset.v38Clean){best.dataset.v38Clean='1';best.addEventListener('click',()=>{localStorage.setItem('fantasyLensDraftMainModeV35','best');setTimeout(syncDraftVsBest,0)})}syncDraftVsBest();
  }

  async function ensurePlayers(){
    if(playersList().length)return true;try{if(typeof cacheGet==='function'){const hit=await cacheGet('season:2026');if(hit?.value?.length){seasonData[2026]=hit.value;players=hit.value;if(typeof finalizePlayers==='function')finalizePlayers(players);return true}}}catch{}document.querySelector('#run')?.click();for(let i=0;i<50;i++){if(playersList().length)return true;await new Promise(r=>setTimeout(r,250))}return playersList().length>0;
  }
  function adpText(id){const a=adpConsensus(id);return a?`${a.avg.toFixed(1)} avg${a.n>1?` · ${a.min.toFixed(0)}–${a.max.toFixed(0)}`:''}`:'—'}
  function threeYearAvg(id){const vals=[2023,2024,2025].map(y=>seasonPlayer(id,y)?.fantasy).filter(Number.isFinite);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null}
  function availability(base){return base?.healthPct!=null&&Number.isFinite(Number(base.healthPct))?Number(base.healthPct):null}
  function fpFmt(v){return Number.isFinite(Number(v))?Number(v).toFixed(1):'—'}

  async function openProfile(id,tab='overview',weekYear=2025){
    const token=++profileToken,ok=await ensurePlayers();if(!ok)return;const base=playersList().find(p=>String(p.id)===String(id));if(!base){if(oldCareer)return oldCareer(String(id));return}
    closeBlockingModals();const modal=document.querySelector('#careerModal'),hero=document.querySelector('#careerHero'),status=document.querySelector('#careerStatus'),grid=document.querySelector('#careerGrid'),title=document.querySelector('#careerTitle');if(!modal||!hero||!status||!grid)return;modal.classList.add('open');title.textContent=base.name;hero.innerHTML=`<div class="careerhero"><img class="head" src="${espnFace(base.id)}" onerror="this.style.visibility='hidden'"><div><div class="name" style="font-size:20px">${esc(base.name)}</div><div class="profileHeroSubV38"><img src="${teamLogo(base.team)}" onerror="this.style.display='none'"><span>${esc(base.pos)} · ${esc(canonicalTeam(base.team))}</span><span>Age ${base.age||'—'}</span><span>#${base.posRank||'—'} ${esc(base.pos)}</span></div></div></div>`;
    status.textContent='Preparing player profile…';grid.innerHTML='';
    try{if(typeof ensureHistoricalViews==='function')await ensureHistoricalViews(false)}catch(e){console.warn('profile history hydrate failed',e)}if(token!==profileToken)return;
    const y25=seasonPlayer(base.id,2025),avg3=threeYearAvg(base.id),avail=availability(base),adp=adpText(base.id);
    const quick=`<div class="profileQuickV38"><div class="profileMetricV38"><b>${fpFmt(base.fantasy)}</b><small>2026 PROJECTED FP</small></div><div class="profileMetricV38"><b>#${base.posRank||'—'}</b><small>2026 POSITION RANK</small></div><div class="profileMetricV38"><b>${fpFmt(y25?.fantasy)}</b><small>2025 FP</small></div><div class="profileMetricV38"><b>${fpFmt(avg3)}</b><small>3-YEAR AVG FP</small></div><div class="profileMetricV38"><b>${avail==null?'—':Math.round(avail)+'%'}</b><small>AVAILABILITY</small></div><div class="profileMetricV38"><b>${adp}</b><small>IMPORTED ADP</small></div></div>`;
    document.querySelector('#profileChromeV38')?.remove();
    const tabs=`<div class="profileTabsV38"><button class="btn" data-profile-tab="overview">Snapshot</button><button class="btn" data-profile-tab="yearly">Year by Year</button><button class="btn" data-profile-tab="weekly">Weekly Logs</button></div>`;
    hero.insertAdjacentHTML('afterend',`<div id="profileChromeV38">${quick}${tabs}</div>`);const chrome=document.querySelector('#profileChromeV38');chrome?.querySelectorAll('[data-profile-tab]').forEach(b=>b.onclick=()=>renderProfileTab(base,b.dataset.profileTab,weekYear));status.textContent='Projection, production, availability, ADP and weekly context in one profile.';renderProfileTab(base,tab,weekYear);
  }
  function setProfileTab(tab){document.querySelectorAll('#profileChromeV38 [data-profile-tab]').forEach(b=>b.classList.toggle('on',b.dataset.profileTab===tab))}
  function renderProfileTab(base,tab,weekYear){setProfileTab(tab);if(tab==='yearly')renderYearly(base);else if(tab==='weekly')renderWeekly(base,weekYear);else renderSnapshot(base)}
  function renderSnapshot(base){
    const grid=document.querySelector('#careerGrid'),rows=[2021,2022,2023,2024,2025].map(y=>seasonPlayer(base.id,y)).filter(Boolean),latest=seasonPlayer(base.id,2025),best=rows.length?[...rows].sort((a,b)=>Number(b.fantasy||0)-Number(a.fantasy||0))[0]:null,trend=rows.length>=2?Number(rows.at(-1).fantasy||0)-Number(rows.at(-2).fantasy||0):null,healthYears=base.healthYears||[],eligible=healthYears.length,missed=healthYears.reduce((a,h)=>a+Math.max(0,Number(h.sched||17)-Number(h.gp||0)),0);if(!grid)return;
    grid.innerHTML=`<div class="profileOverviewV38"><section class="profilePanelV38"><h3>Current draft context</h3><div class="profileListV38"><span>2026 projection</span><b>${fpFmt(base.fantasy)} FP</b><span>Position rank</span><b>#${base.posRank||'—'} ${esc(base.pos)}</b><span>Team depth</span><b>${base.depthOrder?`#${base.depthOrder} ${esc(base.depthPosition||base.pos)}`:'—'}</b><span>Imported ADP</span><b>${adpText(base.id)}</b><span>2025 production</span><b>${latest?fpFmt(latest.fantasy)+' FP':'—'}</b></div></section><section class="profilePanelV38"><h3>History + availability</h3><div class="profileListV38"><span>Best season in 2021–25</span><b>${best?(best.season||best.year)+' · '+fpFmt(best.fantasy)+' FP':'—'}</b><span>Latest YoY change</span><b>${trend==null?'—':`${trend>=0?'+':''}${trend.toFixed(1)} FP`}</b><span>Eligible health seasons</span><b>${eligible||'—'}</b><span>Games missed in eligible seasons</span><b>${eligible?missed:'—'}</b><span>Availability</span><b>${availability(base)==null?'—':Math.round(availability(base))+'%'}</b></div></section></div>`;
  }
  function renderYearly(base){
    const grid=document.querySelector('#careerGrid');if(!grid)return;const years=[2021,2022,2023,2024,2025,2026],rows=years.map(y=>seasonPlayer(base.id,y)||(y===2026?base:null)).filter(Boolean),vals=new Map(rows.map(r=>[r.season||r.year,r]));let prev=null;
    const body=years.map(y=>{const p=vals.get(y);if(!p)return`<tr><td><b>${y}</b></td><td colspan="8">No season record</td></tr>`;const sched=y>=2021?17:16,gp=Number(p.gp)||0,avail=gp?Math.min(100,Math.round(gp/sched*100)):null,yoy=prev==null?null:Number(p.fantasy||0)-prev;prev=Number(p.fantasy||0);return`<tr><td><b>${y}${y===2026?' PROJ':''}</b></td><td>#${p.posRank||'—'} ${esc(base.pos)}</td><td>${gp||'—'}${gp?' / '+sched:''}</td><td>${avail==null?'—':avail+'%'}</td><td><b>${fpFmt(p.fantasy)}</b></td><td>${Number(p.totalYds||0).toLocaleString()}</td><td>${p.totalTD??'—'}</td><td>${p.turnovers??'—'}</td><td>${yoy==null?'—':`${yoy>=0?'+':''}${yoy.toFixed(1)}`}</td></tr>`}).join('');
    grid.innerHTML=`<div class="careergrid"><table class="profileYearTableV38"><thead><tr><th>YEAR</th><th>POS RANK</th><th>GAMES</th><th>ACTIVE %</th><th>FP</th><th>TOTAL YDS</th><th>TD</th><th>TO</th><th>YOY FP</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function currentScoring(){try{return typeof scoring==='function'?scoring():{rec:.5,passTD:4,passYds:25,int:-2,td:6,yds:10,fum:-2}}catch{return{rec:.5,passTD:4,passYds:25,int:-2,td:6,yds:10,fum:-2}}}
  function calcFP(x){const s=currentScoring();return Number(x.passYds||0)/Math.max(1,s.passYds)+Number(x.passTD||0)*s.passTD+Number(x.ints||0)*s.int+(Number(x.rushYds||0)+Number(x.recYds||0))/Math.max(1,s.yds)+(Number(x.rushTD||0)+Number(x.recTD||0))*s.td+Number(x.rec||0)*s.rec+Number(x.lostFum||0)*s.fum}
  function sleeperFP(row){const x=row?.stats||row||{};return calcFP({passYds:x.pass_yd,passTD:x.pass_td,ints:x.pass_int,rushYds:x.rush_yd,rushTD:x.rush_td,rec:x.rec,recYds:x.rec_yd,recTD:x.rec_td,lostFum:x.fum_lost})}
  function sleeperActive(row){const x=row?.stats||row||{};return ['pass_att','pass_yd','rush_att','rush_yd','rec','rec_tgt','rec_yd','pass_td','rush_td','rec_td'].some(k=>Math.abs(Number(x[k]||0))>0)}
  function scoringSig(){try{return JSON.stringify(currentScoring())}catch{return'half'}}
  async function weekRank(year,week,pos,fp){
    const key=`${year}|${week}|${pos}|${scoringSig()}`;let scores=weekRankCache.get(key);if(!scores){try{const r=await fetch(`https://api.sleeper.com/stats/nfl/${year}/${week}?season_type=regular&position[]=${encodeURIComponent(pos)}&order_by=pts_half_ppr`);if(!r.ok)throw Error(r.status);const rows=await r.json();scores=(Array.isArray(rows)?rows:[]).filter(sleeperActive).map(sleeperFP).filter(Number.isFinite).sort((a,b)=>b-a);weekRankCache.set(key,scores)}catch{return null}}if(!scores.length)return null;return{rank:1+scores.filter(v=>v>fp+.005).length,total:scores.length}
  }
  async function teamSchedule(team,year){
    const t=canonicalTeam(team),key=`${t}|${year}`;if(scheduleCache.has(key))return scheduleCache.get(key);const out={};try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamSlug(t)}/schedule?season=${year}`);if(r.ok){const j=await r.json();for(const e of j.events||[]){const c=e.competitions?.[0],week=Number(e.week?.number||c?.week?.number||e.weekNumber);if(!week)continue;const comps=c?.competitors||[],opp=comps.find(x=>canonicalTeam(x.team?.abbreviation)!==t);if(opp)out[week]=canonicalTeam(opp.team?.abbreviation)}}}catch{}scheduleCache.set(key,out);return out
  }
  async function weeklyRows(base,year){
    const filter={players:{filterIds:{value:[Number(base.id)]},limit:1,sortPercOwned:{sortPriority:1,sortAsc:false},filterStatsForTopScoringPeriodIds:{value:18,additionalValue:[`00${year}`]}}};const data=await fetchJson(`${API}/seasons/${year}/segments/0/leaguedefaults/3?scoringPeriodId=0&view=kona_playercard`,filter),e=(data.players||[])[0],p=e?.player||e,weekly=(p?.stats||[]).filter(s=>Number(s.seasonId)===Number(year)&&Number(s.statSourceId)===0&&Number(s.statSplitTypeId)===1).sort((a,b)=>a.scoringPeriodId-b.scoringPeriodId),team=seasonPlayer(base.id,year)?.team||base.team,sched=await teamSchedule(team,year);
    return weekly.map(s=>{const x=s.stats||{},r={week:Number(s.scoringPeriodId),passYds:Number(x['3']||0),passTD:Number(x['4']||0),ints:Number(x['20']||0),rushYds:Number(x['24']||0),rushTD:Number(x['25']||0),rec:Number(x['41']??x['53']??0),recYds:Number(x['42']||0),recTD:Number(x['43']||0),lostFum:Number(x['72']||0)};r.totalYds=r.passYds+r.rushYds+r.recYds;r.totalTD=r.passTD+r.rushTD+r.recTD;r.turnovers=r.ints+r.lostFum;r.fantasy=calcFP(r);r.opp=sched[r.week]||'';return r}).filter(r=>r.totalYds||r.totalTD||r.turnovers||r.rec)
  }
  async function renderWeekly(base,year=2025){
    const grid=document.querySelector('#careerGrid'),status=document.querySelector('#careerStatus');if(!grid)return;const years=[2025,2024,2023,2022,2021];grid.innerHTML=`<div class="profileWeekControlsV38"><label>Season <select class="field" id="profileWeekYearV38">${years.map(y=>`<option ${y===Number(year)?'selected':''}>${y}</option>`).join('')}</select></label><span class="webHint">Weekly FP uses your current scoring settings; position finish compares same-position players that week.</span></div><div id="profileWeekBodyV38" class="viewLoadingV37">Loading ${year} weekly log…</div>`;grid.querySelector('#profileWeekYearV38').onchange=e=>renderWeekly(base,Number(e.target.value));const root=grid.querySelector('#profileWeekBodyV38');try{const rows=await weeklyRows(base,year);if(!rows.length){root.textContent='No weekly offensive activity found for this season.';return}status.textContent=`${rows.length} weekly games found · calculating ${base.pos} finishes…`;await Promise.allSettled(rows.map(async r=>r.rank=await weekRank(year,r.week,base.pos,r.fantasy)));const avg=rows.reduce((a,b)=>a+b.fantasy,0)/rows.length,best=[...rows].sort((a,b)=>b.fantasy-a.fantasy)[0],worst=[...rows].sort((a,b)=>a.fantasy-b.fantasy)[0],top12=rows.filter(r=>r.rank?.rank<=12).length;root.className='';root.innerHTML=`<div class="profileWeekSummaryV38"><div class="profileMetricV38"><b>${avg.toFixed(1)}</b><small>AVG FP / GAME</small></div><div class="profileMetricV38"><b>W${best.week} · ${best.fantasy.toFixed(1)}</b><small>BEST WEEK</small></div><div class="profileMetricV38"><b>W${worst.week} · ${worst.fantasy.toFixed(1)}</b><small>LOWEST WEEK</small></div><div class="profileMetricV38"><b>${top12}</b><small>TOP-12 ${esc(base.pos)} WEEKS</small></div></div><div class="careergrid"><table class="profileWeekTableV38"><thead><tr><th>WEEK</th><th>OPP</th><th>FP</th><th>${esc(base.pos)} RANK</th><th>YDS</th><th>TD</th><th>TO</th><th>REC</th><th>PASS</th><th>RUSH</th><th>REC YDS</th></tr></thead><tbody>${rows.map(r=>{const q=r.rank,cl=q?.rank<=12?'weeklyRankGoodV38':q?.rank<=24?'weeklyRankMidV38':'weeklyRankLowV38';return`<tr><td><b>W${r.week}</b></td><td>${r.opp||'—'}</td><td><b>${r.fantasy.toFixed(1)}</b></td><td class="${cl}">${q?`#${q.rank}<small style="display:block">of ${q.total}</small>`:'—'}</td><td>${Math.round(r.totalYds).toLocaleString()}</td><td>${r.totalTD}</td><td>${r.turnovers}</td><td>${r.rec}</td><td>${r.passYds}</td><td>${r.rushYds}</td><td>${r.recYds}</td></tr>`}).join('')}</tbody></table></div>`;status.textContent=`${year} weekly log · ${top12} top-12 ${base.pos} finishes · ${avg.toFixed(1)} FP/game.`}catch(e){root.className='viewLoadingV37';root.textContent='Weekly log failed: '+e.message}
  }

  function installProfileOverride(){
    if(!oldCareer&&typeof window.career==='function')oldCareer=window.career;if(!oldSeasonLog&&typeof window.seasonLog==='function')oldSeasonLog=window.seasonLog;window.career=(id)=>openProfile(String(id),'overview');window.seasonLog=(id,year)=>openProfile(String(id),'weekly',Number(year)||2025);
    const close=document.querySelector('#closeCareer');if(close&&!close.dataset.v38){close.dataset.v38='1';close.onclick=()=>document.querySelector('#careerModal')?.classList.remove('open')}
  }

  function wrapRender(){if(renderWrapped||typeof window.render!=='function')return;const old=window.render;window.render=function(){const out=old.apply(this,arguments);setTimeout(()=>{syncDraftVsBest();wireDraftBest();observeLeagueBoard()},0);return out};renderWrapped=true}
  function activate(){addStyles();installProfileOverride();wireDraftBest();observeLeagueBoard();wrapRender();setTimeout(()=>{installProfileOverride();wireDraftBest();observeLeagueBoard();gradeLeagueBoard();syncDraftVsBest()},700)}
  window.addEventListener('load',()=>{setTimeout(activate,800);setTimeout(activate,1700)});
})();
