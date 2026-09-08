/* Fantasy Lens v25 — 3-file GitHub Pages build. */
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
  root.querySelectorAll('[data-player-id],[data-player-name],.depthPlayer,.depth-player,.depthChip,.depth-chip,.depthName,.depth-name,tr,li,.player,.depthRow,.depth-row').forEach(el=>{
    const id=String(el.dataset.playerId||el.dataset.espnId||''),txt=String(el.dataset.playerName||el.textContent||'').toLowerCase();
    const drafted=(id&&draftedIds.has(id))||[...names].some(n=>n&&txt.includes(n));
    if(drafted){el.style.opacity='.42';el.style.textDecoration='line-through'}else{el.style.opacity='';el.style.textDecoration=''}
    el.style.display=((depthDraftFilter==='drafted'&&!drafted)||(depthDraftFilter==='available'&&drafted))?'none':'';
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
      try{const rows=await fetchSeason(y);if(rows?.length)await cachePut('season:'+y,rows)}catch(e){console.warn('historical cache repair failed',y,e)}
    }
    const hasHealth=players.some(p=>p.healthPct!=null&&Number(p.healthPct)>0);
    if(players.length&&(!hasHealth||force)){
      try{await enrichHealth(2026)}catch(e){console.warn('health repair failed',e)}
    }
    render();
  }catch(e){console.warn('cache hydration failed',e)}
}

/* --------------------------------------------------------------------------
   Opening four-week matchup model
   Projection = 2026 Sleeper team-defense projection rank.
   Last year = 2025 half-PPR fantasy points allowed by opponent, by position.
   Both are converted to offense-friendly percentiles before weighting.
---------------------------------------------------------------------------- */
const TEAM_CODES=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WAS'];
const TEAM_SLUG={ARI:'ari',ATL:'atl',BAL:'bal',BUF:'buf',CAR:'car',CHI:'chi',CIN:'cin',CLE:'cle',DAL:'dal',DEN:'den',DET:'det',GB:'gb',HOU:'hou',IND:'ind',JAX:'jax',KC:'kc',LV:'lv',LAC:'lac',LAR:'lar',MIA:'mia',MIN:'min',NE:'ne',NO:'no',NYG:'nyg',NYJ:'nyj',PHI:'phi',PIT:'pit',SF:'sf',SEA:'sea',TB:'tb',TEN:'ten',WAS:'wsh'};
const FALLBACK_DEF26={HOU:1,SEA:2,LAR:3,PHI:4,MIN:5,KC:6,PIT:7,DEN:8,BAL:9,CLE:10,SF:11,NE:12,BUF:13,JAX:14,IND:15,TB:16,LAC:17,DET:18,NO:19,GB:20,NYG:21,CIN:22,NYJ:23,TEN:24,CAR:25,DAL:26,WAS:27,ATL:28,CHI:29,LV:30,ARI:31,MIA:32};
const scheduleCache=new Map();
let projectionDefenseRanks=null;
let dvpRanks2025=null;
let defenseHistory=null;
let matchupRanksPromise=null;

function normTeam(v){
  const x=String(v||'').toUpperCase().trim();
  if(x==='WSH')return'WAS';
  if(x==='LA')return'LAR';
  return x;
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function readModelWeights(){
  let projection=45;
  try{const saved=JSON.parse(localStorage.getItem('fantasyLensMatchupWeights')||'{}');if(Number.isFinite(Number(saved.projection)))projection=Number(saved.projection)}catch{}
  projection=clamp(Math.round(projection),0,100);
  return{projection,last:100-projection};
}
function saveModelProjectionWeight(v){
  const projection=clamp(Math.round(Number(v)||0),0,100);
  localStorage.setItem('fantasyLensMatchupWeights',JSON.stringify({projection,last:100-projection}));
  return{projection,last:100-projection};
}
function rankToEase(rank){return 100*((clamp(Number(rank)||16.5,1,32)-1)/31)}
function rankColor(rank){const ease=100-rankToEase(rank);return `hsl(${Math.round(ease*1.2)} 72% 38% / .94)`}
function matchupColor(score){return `hsl(${Math.round(clamp(score,0,100)*1.2)} 72% 38% / .94)`}

function rankByValue(map,betterHigh=false){
  const rows=Object.entries(map).filter(([,v])=>Number.isFinite(Number(v))).sort((a,b)=>betterHigh?Number(b[1])-Number(a[1]):Number(a[1])-Number(b[1]));
  const out={};rows.forEach(([t],i)=>out[normTeam(t)]=i+1);return out;
}

function cachedJson(key,maxAgeMs){
  try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x&&x.ts&&Date.now()-x.ts<maxAgeMs)return x.value}catch{}
  return null;
}
function putCachedJson(key,value){try{localStorage.setItem(key,JSON.stringify({ts:Date.now(),value}))}catch{}}

async function loadProjectionDefenseRanks(force=false){
  if(projectionDefenseRanks&&!force)return projectionDefenseRanks;
  if(!force){const c=cachedJson('fantasyLensDefProjRank26',6*60*60*1000);if(c){projectionDefenseRanks=c;return c}}
  try{
    const u='https://api.sleeper.com/projections/nfl/2026?season_type=regular&position[]=DEF&order_by=pts_std';
    const r=await fetch(u),rows=await r.json(),vals={};
    for(const x of Array.isArray(rows)?rows:[]){
      const team=normTeam(x.team||x.player?.team||x.player_id||x.player?.player_id||x.player?.abbr);
      if(!TEAM_CODES.includes(team))continue;
      const s=x.stats||{};
      const pts=Number(s.pts_std??s.pts_half_ppr??s.pts_ppr??x.pts_std??x.pts_half_ppr??x.pts_ppr);
      if(Number.isFinite(pts))vals[team]=pts;
    }
    const ranks=rankByValue(vals,true);
    if(Object.keys(ranks).length>=28){projectionDefenseRanks=ranks;putCachedJson('fantasyLensDefProjRank26',ranks);return ranks}
  }catch(e){console.warn('2026 defense projection ranks failed',e)}
  projectionDefenseRanks={...FALLBACK_DEF26};
  return projectionDefenseRanks;
}

function sleeperRowPosition(row){
  const direct=String(row.position||row.player?.position||row.player_position||row.player?.fantasy_positions?.[0]||'').toUpperCase();
  if(['QB','RB','WR','TE'].includes(direct))return direct;
  try{
    const p=depthData?.[String(row.player_id||row.player?.player_id||'')];
    const pos=String(p?.position||p?.fantasy_positions?.[0]||'').toUpperCase();
    if(['QB','RB','WR','TE'].includes(pos))return pos;
  }catch{}
  return'';
}
function sleeperHalfPpr(row){
  const s=row.stats||row;
  const direct=Number(s.pts_half_ppr);
  if(Number.isFinite(direct))return direct;
  const rec=Number(s.rec||0),passY=Number(s.pass_yd||0),passTD=Number(s.pass_td||0),ints=Number(s.pass_int||0),rushY=Number(s.rush_yd||0),rushTD=Number(s.rush_td||0),recY=Number(s.rec_yd||0),recTD=Number(s.rec_td||0),fum=Number(s.fum_lost||0);
  return passY/25+passTD*4-ints*2+rushY/10+rushTD*6+recY/10+recTD*6+rec*.5-fum*2;
}
async function loadDvpRanks2025(force=false){
  if(dvpRanks2025&&!force)return dvpRanks2025;
  if(!force){const c=cachedJson('fantasyLensDvpRank2025',30*24*60*60*1000);if(c){dvpRanks2025=c;return c}}
  const totals={QB:{},RB:{},WR:{},TE:{}};
  try{
    const weeks=Array.from({length:18},(_,i)=>i+1);
    const results=[];
    for(let i=0;i<weeks.length;i+=6){
      const chunk=weeks.slice(i,i+6);
      const got=await Promise.all(chunk.map(async w=>{
        const u=`https://api.sleeper.com/stats/nfl/2025/${w}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&order_by=pts_half_ppr`;
        const r=await fetch(u);if(!r.ok)throw Error(`Sleeper week ${w}: ${r.status}`);return r.json();
      }));
      results.push(...got);
    }
    for(const rows of results){
      for(const row of Array.isArray(rows)?rows:[]){
        const pos=sleeperRowPosition(row),opp=normTeam(row.opponent||row.opponent_team||row.stats?.opponent||row.player?.opponent);
        if(!pos||!TEAM_CODES.includes(opp))continue;
        const pts=sleeperHalfPpr(row);if(!Number.isFinite(pts))continue;
        totals[pos][opp]=(totals[pos][opp]||0)+pts;
      }
    }
    const out={};
    for(const pos of ['QB','RB','WR','TE']){
      out[pos]=rankByValue(totals[pos],false);
      if(Object.keys(out[pos]).length<24)throw Error(`Incomplete ${pos} opponent data`);
    }
    dvpRanks2025=out;putCachedJson('fantasyLensDvpRank2025',out);return out;
  }catch(e){console.warn('2025 position-vs-defense ranks failed',e);dvpRanks2025=null;return null}
}

function collectStandingEntries(node,out=[]){
  if(!node||typeof node!=='object')return out;
  if(Array.isArray(node.standings?.entries))out.push(...node.standings.entries);
  if(Array.isArray(node.entries)&&node.entries.some(e=>e?.team))out.push(...node.entries);
  if(Array.isArray(node.children))node.children.forEach(c=>collectStandingEntries(c,out));
  return out;
}
function standingStat(entry,names){
  const stats=entry?.stats||[];
  for(const name of names){
    const s=stats.find(x=>String(x.name||x.abbreviation||'').toLowerCase()===String(name).toLowerCase());
    if(s){const v=Number(s.value??String(s.displayValue||'').replace(/,/g,''));if(Number.isFinite(v))return v}
  }
  return null;
}
async function loadDefenseHistory(force=false){
  if(defenseHistory&&!force)return defenseHistory;
  if(!force){const c=cachedJson('fantasyLensDefenseHistory5y',30*24*60*60*1000);if(c){defenseHistory=c;return c}}
  const years=[2025,2024,2023,2022,2021],out={};
  try{
    await Promise.all(years.map(async y=>{
      const r=await fetch(`https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${y}`);if(!r.ok)throw Error(`ESPN standings ${y}: ${r.status}`);const j=await r.json();
      const vals={};
      for(const e of collectStandingEntries(j,[])){
        const team=normTeam(e.team?.abbreviation||e.team?.shortDisplayName||e.team?.name);
        if(!TEAM_CODES.includes(team))continue;
        const pa=standingStat(e,['pointsAgainst','pointsagainst','pa']);
        const papg=standingStat(e,['avgPointsAgainst','pointsAgainstPerGame','pointsagainstpergame']);
        const gp=standingStat(e,['gamesPlayed','gp']);
        const value=pa!=null?pa:(papg!=null&&gp?papg*gp:papg);
        if(Number.isFinite(value))vals[team]=value;
      }
      const ranks=rankByValue(vals,false);
      out[y]={ranks,values:vals};
    }));
    if(Object.keys(out[2025]?.ranks||{}).length<28)throw Error('Incomplete ESPN defensive standings data');
    defenseHistory=out;putCachedJson('fantasyLensDefenseHistory5y',out);return out;
  }catch(e){console.warn('five-year defense history failed',e);defenseHistory=out;return out}
}

async function ensureMatchupRanks(force=false){
  if(matchupRanksPromise&&!force)return matchupRanksPromise;
  matchupRanksPromise=Promise.all([loadProjectionDefenseRanks(force),loadDvpRanks2025(force),loadDefenseHistory(force)]).finally(()=>{matchupRanksPromise=null});
  return matchupRanksPromise;
}

async function firstFour(team){
  if(scheduleCache.has(team))return scheduleCache.get(team);
  const slug=TEAM_SLUG[team];if(!slug)return[];
  try{
    const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${slug}/schedule?season=2026`),j=await r.json(),events=j.events||[],out=[];
    for(const e of events){
      const comp=e.competitions?.[0],cs=comp?.competitors||[],mine=cs.find(c=>normTeam(c.team?.abbreviation)===team),opp=cs.find(c=>c!==mine);
      if(!mine||!opp)continue;
      const type=Number(e.season?.type||e.seasonType?.type||2);if(type!==2)continue;
      out.push({opp:normTeam(opp.team?.abbreviation),away:mine.homeAway==='away'});if(out.length===4)break;
    }
    scheduleCache.set(team,out);return out;
  }catch(e){console.warn('schedule fetch failed',team,e);return[]}
}

function matchupGrade(opp,pos){
  const w=readModelWeights();
  const projRank=projectionDefenseRanks?.[opp]||FALLBACK_DEF26[opp]||16.5;
  const priorRank=dvpRanks2025?.[pos]?.[opp]||defenseHistory?.[2025]?.ranks?.[opp]||16.5;
  const projEase=rankToEase(projRank),priorEase=rankToEase(priorRank);
  return{score:Math.round((projEase*w.projection+priorEase*w.last)/100),projRank,priorRank,weights:w};
}

function installMatchupUI(){
  const meta=document.querySelector('.draftMeta');
  if(meta&&!document.querySelector('#matchupLegend')){
    const x=document.createElement('span');x.id='matchupLegend';x.innerHTML='<b>W1–W4:</b> red tough · yellow average · green favorable';meta.appendChild(x);
  }
}
function findPlayerForRenderedNode(el){
  const txt=String(el.textContent||'').toLowerCase();
  return players.find(x=>txt.includes(String(x.name||'').toLowerCase()));
}
async function decorateOpeningMatchups(force=false){
  installMatchupUI();if(!players?.length)return;
  await ensureMatchupRanks(false);
  const w=readModelWeights(),version=`${w.projection}-${Object.keys(dvpRanks2025?.QB||{}).length}-${Object.keys(projectionDefenseRanks||{}).length}`;
  const rows=[...document.querySelectorAll('#tablewrap tbody tr,.cards .card')];
  for(const el of rows){
    if(!force&&el.dataset.matchupVersion===version)continue;
    el.querySelector('.openingMatchups')?.remove();
    const p=findPlayerForRenderedNode(el);if(!p)continue;
    const games=await firstFour(p.team);if(!games.length)continue;
    const box=document.createElement('div');box.className='openingMatchups';box.style.cssText='display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;font-size:10px';
    box.innerHTML=games.map((g,i)=>{
      const m=matchupGrade(g.opp,p.pos);
      return `<span title="Week ${i+1} ${g.opp} • ${p.pos} 2025 defense rank #${m.priorRank} • 2026 projected defense rank #${m.projRank} • weights ${m.weights.last}% last year / ${m.weights.projection}% projection" style="background:${matchupColor(m.score)};color:white;padding:3px 6px;border-radius:6px;font-weight:800">W${i+1} ${g.away?'@':''}${g.opp} ${m.score}</span>`;
    }).join('');
    const target=el.querySelector('td:nth-child(2),.playerName,.name')||el.firstElementChild||el;target.appendChild(box);el.dataset.matchupVersion=version;
  }
}
function observeMatchups(){
  for(const sel of ['#tablewrap','#cards']){
    const root=document.querySelector(sel);if(root)new MutationObserver(()=>setTimeout(()=>decorateOpeningMatchups(false),30)).observe(root,{childList:true,subtree:true});
  }
}

/* --------------------------------------------------------------------------
   Settings UI — projection vs last-year percentile weighting
---------------------------------------------------------------------------- */
function installMatchupSettings(){
  if(document.querySelector('#matchupModelSettings'))return;
  const body=document.querySelector('#settingsModal .careerbody');if(!body)return;
  const s=document.createElement('section');s.id='matchupModelSettings';s.style.cssText='margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.12)';
  const w=readModelWeights();
  s.innerHTML=`<h3 style="margin:0 0 6px">Opening Matchup Model</h3><p style="color:var(--muted);font-size:11px;margin:0 0 10px">First four weeks. Blends 2026 projected team-defense percentile with 2025 fantasy points allowed to the player's position. The two weights always total 100%.</p><div style="display:grid;grid-template-columns:minmax(180px,1fr) 64px;gap:8px;align-items:center"><label>2026 projection weight <input id="matchProjWeight" type="range" min="0" max="100" step="5" value="${w.projection}" style="width:100%"></label><output id="matchProjOut">${w.projection}%</output><label>2025 positional defense weight <input id="matchLastWeight" type="range" min="0" max="100" step="5" value="${w.last}" style="width:100%" disabled></label><output id="matchLastOut">${w.last}%</output></div><button class="btn" id="refreshMatchupRanks" type="button" style="margin-top:10px">Refresh Defense Ranks</button><span id="matchupSettingsStatus" style="margin-left:8px;color:var(--muted);font-size:11px"></span>`;
  body.appendChild(s);
  const proj=s.querySelector('#matchProjWeight'),last=s.querySelector('#matchLastWeight'),po=s.querySelector('#matchProjOut'),lo=s.querySelector('#matchLastOut'),status=s.querySelector('#matchupSettingsStatus');
  proj.addEventListener('input',()=>{const nw=saveModelProjectionWeight(proj.value);last.value=nw.last;po.textContent=nw.projection+'%';lo.textContent=nw.last+'%';document.querySelectorAll('[data-matchup-version]').forEach(x=>delete x.dataset.matchupVersion);decorateOpeningMatchups(true)});
  s.querySelector('#refreshMatchupRanks').onclick=async()=>{status.textContent='Refreshing…';projectionDefenseRanks=null;dvpRanks2025=null;defenseHistory=null;await ensureMatchupRanks(true);status.textContent='Updated';renderDefenseHistory();decorateOpeningMatchups(true)};
}

/* --------------------------------------------------------------------------
   SPECIAL · Team Defense — five-year rank matrix
---------------------------------------------------------------------------- */
function installSpecialStyles(){
  if(document.querySelector('#fantasyLensSpecialStyles'))return;
  const st=document.createElement('style');st.id='fantasyLensSpecialStyles';st.textContent=`
    .defRankWrap{overflow:auto;max-height:68vh;border:1px solid rgba(255,255,255,.12);border-radius:10px}
    .defRankTable{width:100%;border-collapse:separate;border-spacing:0;font-size:12px;min-width:620px}
    .defRankTable th,.defRankTable td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.08);text-align:center;white-space:nowrap}
    .defRankTable th{position:sticky;top:0;background:#101821;z-index:2}.defRankTable th:first-child{left:0;z-index:3}.defRankTable td:first-child{position:sticky;left:0;background:#0d141c;text-align:left;font-weight:900;z-index:1}
    .defRankCell{font-weight:900;color:white;text-shadow:0 1px 2px rgba(0,0,0,.45);border-radius:7px;display:inline-block;min-width:42px;padding:5px 7px}
    .specialLegend{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 12px;color:var(--muted);font-size:11px}.specialLegend i{width:72px;height:9px;border-radius:99px;background:linear-gradient(90deg,hsl(0 72% 38%),hsl(60 72% 38%),hsl(120 72% 38%));display:inline-block}
  `;document.head.appendChild(st);
}
function installSpecialModal(){
  installSpecialStyles();
  const bar=document.querySelector('.appbarInner');
  if(bar&&!document.querySelector('#specialBtn')){
    const b=document.createElement('button');b.className='btn';b.id='specialBtn';b.textContent='SPECIAL';
    const anchor=document.querySelector('#importDraftBtn');bar.insertBefore(b,anchor||document.querySelector('#dataLabBtn')||null);
  }
  if(!document.querySelector('#specialModal')){
    const modal=document.createElement('div');modal.className='modal';modal.id='specialModal';
    modal.innerHTML='<div class="modalbox"><div class="modalhead"><div><h2>SPECIAL · Team Defense</h2><small style="color:#aebdca">Last five completed seasons · rank 1 = strongest defense</small></div><button class="btn close" id="closeSpecial">×</button></div><div class="careerbody"><div class="specialLegend"><span>Weak</span><i></i><span>Strong</span><span>• Green = better defensive rank, red = worse.</span></div><div class="careerstatus" id="defenseHistoryStatus">Load the five-year defense matrix.</div><div id="defenseHistoryTable"></div></div></div>';
    document.body.appendChild(modal);
  }
  const modal=document.querySelector('#specialModal');
  document.querySelector('#specialBtn').onclick=async()=>{modal.classList.add('open');document.querySelector('#defenseHistoryStatus').textContent='Loading 2025–2021 defense ranks…';await loadDefenseHistory(false);renderDefenseHistory()};
  document.querySelector('#closeSpecial').onclick=()=>modal.classList.remove('open');
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
}
function renderDefenseHistory(){
  const root=document.querySelector('#defenseHistoryTable'),status=document.querySelector('#defenseHistoryStatus');if(!root||!defenseHistory)return;
  const years=[2025,2024,2023,2022,2021],current=defenseHistory[2025]?.ranks||{};
  const teams=[...TEAM_CODES].sort((a,b)=>(current[a]||99)-(current[b]||99)||a.localeCompare(b));
  const rows=teams.map(team=>`<tr><td>${team}</td>${years.map(y=>{const rank=defenseHistory[y]?.ranks?.[team],raw=defenseHistory[y]?.values?.[team];if(!rank)return'<td>—</td>';return `<td title="${y} ${team}: ${raw==null?'':Math.round(raw)+' points allowed · '}defense rank #${rank}"><span class="defRankCell" style="background:${rankColor(rank)}">#${rank}</span></td>`}).join('')}</tr>`).join('');
  root.innerHTML=`<div class="defRankWrap"><table class="defRankTable"><thead><tr><th>Team</th>${years.map(y=>`<th>${y}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  const counts=years.map(y=>Object.keys(defenseHistory[y]?.ranks||{}).length);
  status.textContent=counts.every(n=>n>=28)?'Ranks are based on regular-season points allowed; #1 is strongest, #32 weakest.':'Some seasons returned incomplete standings data; unavailable cells are shown as —.';
}

window.addEventListener('load',()=>{
  installDepthDraftFilters();
  installMatchupSettings();
  installSpecialModal();
  const root=document.querySelector('#depthResults');if(root)new MutationObserver(()=>applyDepthDraftFilter()).observe(root,{childList:true,subtree:true});
  document.querySelector('#exploreBtn')?.addEventListener('click',()=>setTimeout(applyDepthDraftFilter,25));
  document.querySelector('#runDepth')?.addEventListener('click',()=>setTimeout(applyDepthDraftFilter,400));
  document.querySelector('#depthSearch')?.addEventListener('input',()=>setTimeout(applyDepthDraftFilter,0));
  document.querySelectorAll('#viewNav [data-view]').forEach(b=>b.addEventListener('click',()=>{if(['overview','matrix','health'].includes(b.dataset.view))ensureHistoricalViews(false);setTimeout(()=>decorateOpeningMatchups(false),60)}));
  setTimeout(()=>{
    try{if(['overview','matrix','health'].includes(currentView))ensureHistoricalViews(false)}catch{}
    applyDepthDraftFilter();observeMatchups();decorateOpeningMatchups(false);
  },500);
});
