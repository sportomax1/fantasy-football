/* Fantasy Lens v26 — 3-file GitHub Pages build. */
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

const TEAM_CODES=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WAS'];
const TEAM_SLUG={ARI:'ari',ATL:'atl',BAL:'bal',BUF:'buf',CAR:'car',CHI:'chi',CIN:'cin',CLE:'cle',DAL:'dal',DEN:'den',DET:'det',GB:'gb',HOU:'hou',IND:'ind',JAX:'jax',KC:'kc',LV:'lv',LAC:'lac',LAR:'lar',MIA:'mia',MIN:'min',NE:'ne',NO:'no',NYG:'nyg',NYJ:'nyj',PHI:'phi',PIT:'pit',SF:'sf',SEA:'sea',TB:'tb',TEN:'ten',WAS:'wsh'};
const FALLBACK_DEF26={HOU:1,SEA:2,LAR:3,PHI:4,MIN:5,KC:6,PIT:7,DEN:8,BAL:9,CLE:10,SF:11,NE:12,BUF:13,JAX:14,IND:15,TB:16,LAC:17,DET:18,NO:19,GB:20,NYG:21,CIN:22,NYJ:23,TEN:24,CAR:25,DAL:26,WAS:27,ATL:28,CHI:29,LV:30,ARI:31,MIA:32};
const scheduleCache=new Map();
let projectionDefenseRanks=null,dvpRanks2025=null,defenseHistory=null,matchupRanksPromise=null,sleeperDirectoryCache=null,kickerHistory=null,matchupDecorating=false,matchupRerun=false;

function normTeam(v){const x=String(v||'').toUpperCase().trim();if(x==='WSH')return'WAS';if(x==='LA')return'LAR';return x}
function teamLogoUrl(team){const t=normTeam(team),slug=t==='WAS'?'wsh':t.toLowerCase();return `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png`}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function readModelWeights(){let projection=45;try{const saved=JSON.parse(localStorage.getItem('fantasyLensMatchupWeights')||'{}');if(Number.isFinite(Number(saved.projection)))projection=Number(saved.projection)}catch{}projection=clamp(Math.round(projection),0,100);return{projection,last:100-projection}}
function saveModelProjectionWeight(v){const projection=clamp(Math.round(Number(v)||0),0,100);localStorage.setItem('fantasyLensMatchupWeights',JSON.stringify({projection,last:100-projection}));return{projection,last:100-projection}}
function rankToEase(rank){return 100*((clamp(Number(rank)||16.5,1,32)-1)/31)}
function rankColor(rank){const strength=100-rankToEase(rank);return `hsl(${Math.round(strength*1.2)} 72% 38% / .94)`}
function matchupColor(score){return `hsl(${Math.round(clamp(score,0,100)*1.2)} 72% 38% / .94)`}
function rankByValue(map,betterHigh=false){const rows=Object.entries(map).filter(([,v])=>Number.isFinite(Number(v))).sort((a,b)=>betterHigh?Number(b[1])-Number(a[1]):Number(a[1])-Number(b[1]));const out={};rows.forEach(([t],i)=>out[normTeam(t)]=i+1);return out}
function cachedJson(key,maxAgeMs){try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x&&x.ts&&Date.now()-x.ts<maxAgeMs)return x.value}catch{}return null}
function putCachedJson(key,value){try{localStorage.setItem(key,JSON.stringify({ts:Date.now(),value}))}catch{}}

async function loadSleeperDirectory(force=false){
  if(sleeperDirectoryCache&&!force)return sleeperDirectoryCache;
  if(depthData&&!force){sleeperDirectoryCache=depthData;return sleeperDirectoryCache}
  if(!force){const c=cachedJson('fantasyLensSleeperDirectoryV2',24*60*60*1000);if(c){sleeperDirectoryCache=c;return c}}
  try{const r=await fetch('https://api.sleeper.app/v1/players/nfl');if(!r.ok)throw Error('Sleeper players '+r.status);const j=await r.json();sleeperDirectoryCache=j;putCachedJson('fantasyLensSleeperDirectoryV2',j);return j}catch(e){console.warn('Sleeper directory failed',e);return depthData||{}}
}

async function loadProjectionDefenseRanks(force=false){
  if(projectionDefenseRanks&&!force)return projectionDefenseRanks;
  if(!force){const c=cachedJson('fantasyLensDefProjRank26V2',6*60*60*1000);if(c){projectionDefenseRanks=c;return c}}
  try{const r=await fetch('https://api.sleeper.com/projections/nfl/2026?season_type=regular&position[]=DEF&order_by=pts_std'),rows=await r.json(),vals={};for(const x of Array.isArray(rows)?rows:[]){const team=normTeam(x.team||x.player?.team||x.player_id||x.player?.player_id||x.player?.abbr);if(!TEAM_CODES.includes(team))continue;const s=x.stats||{},pts=Number(s.pts_std??s.pts_half_ppr??s.pts_ppr??x.pts_std??x.pts_half_ppr??x.pts_ppr);if(Number.isFinite(pts))vals[team]=pts}const ranks=rankByValue(vals,true);if(Object.keys(ranks).length>=28){projectionDefenseRanks=ranks;putCachedJson('fantasyLensDefProjRank26V2',ranks);return ranks}}catch(e){console.warn('2026 defense projection ranks failed',e)}
  projectionDefenseRanks={...FALLBACK_DEF26};return projectionDefenseRanks;
}

function sleeperHalfPpr(row){const s=row.stats||row,direct=Number(s.pts_half_ppr??row.pts_half_ppr);if(Number.isFinite(direct))return direct;const rec=Number(s.rec||0),passY=Number(s.pass_yd||0),passTD=Number(s.pass_td||0),ints=Number(s.pass_int||0),rushY=Number(s.rush_yd||0),rushTD=Number(s.rush_td||0),recY=Number(s.rec_yd||0),recTD=Number(s.rec_td||0),fum=Number(s.fum_lost||0);return passY/25+passTD*4-ints*2+rushY/10+rushTD*6+recY/10+recTD*6+rec*.5-fum*2}
function sleeperPos(row,directory){const direct=String(row.position||row.player?.position||row.player_position||row.player?.fantasy_positions?.[0]||'').toUpperCase();if(['QB','RB','WR','TE','K'].includes(direct))return direct;const id=String(row.player_id||row.player?.player_id||''),p=directory?.[id],pos=String(p?.position||p?.fantasy_positions?.[0]||'').toUpperCase();return ['QB','RB','WR','TE','K'].includes(pos)?pos:''}
function sleeperTeam(row,directory){const direct=normTeam(row.team||row.player?.team||row.stats?.team||row.team_abbr||row.player?.team_abbr);if(TEAM_CODES.includes(direct))return direct;const id=String(row.player_id||row.player?.player_id||'');return normTeam(directory?.[id]?.team||'')}
function sleeperOpponent(row){return normTeam(row.opponent||row.opponent_team||row.stats?.opponent||row.player?.opponent||'')}

async function loadDvpRanks2025(force=false){
  if(dvpRanks2025&&!force)return dvpRanks2025;
  if(!force){const c=cachedJson('fantasyLensDvpRank2025V2',14*24*60*60*1000);if(c){dvpRanks2025=c;return c}}
  const totals={QB:{},RB:{},WR:{},TE:{}},directory=await loadSleeperDirectory(false);
  try{const weeks=Array.from({length:18},(_,i)=>i+1),results=[];for(let i=0;i<weeks.length;i+=6){const got=await Promise.all(weeks.slice(i,i+6).map(async w=>{const r=await fetch(`https://api.sleeper.com/stats/nfl/2025/${w}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&order_by=pts_half_ppr`);if(!r.ok)throw Error(`Sleeper week ${w}: ${r.status}`);return r.json()}));results.push(...got)}for(const rows of results){for(const row of Array.isArray(rows)?rows:[]){const pos=sleeperPos(row,directory),opp=sleeperOpponent(row);if(!['QB','RB','WR','TE'].includes(pos)||!TEAM_CODES.includes(opp))continue;const pts=sleeperHalfPpr(row);if(Number.isFinite(pts))totals[pos][opp]=(totals[pos][opp]||0)+pts}}const out={};for(const pos of ['QB','RB','WR','TE']){out[pos]=rankByValue(totals[pos],false);if(Object.keys(out[pos]).length<28)throw Error(`Incomplete ${pos} opponent data (${Object.keys(out[pos]).length}/32)`)}dvpRanks2025=out;putCachedJson('fantasyLensDvpRank2025V2',out);return out}catch(e){console.warn('2025 position-vs-defense ranks failed',e);dvpRanks2025=null;return null}
}

function collectStandingEntries(node,out=[]){if(!node||typeof node!=='object')return out;if(Array.isArray(node.standings?.entries))out.push(...node.standings.entries);if(Array.isArray(node.entries)&&node.entries.some(e=>e?.team))out.push(...node.entries);if(Array.isArray(node.children))node.children.forEach(c=>collectStandingEntries(c,out));return out}
function standingStat(entry,names){const stats=entry?.stats||[];for(const name of names){const s=stats.find(x=>String(x.name||x.abbreviation||'').toLowerCase()===String(name).toLowerCase());if(s){const v=Number(s.value??String(s.displayValue||'').replace(/,/g,''));if(Number.isFinite(v))return v}}return null}
async function loadDefenseHistory(force=false){
  if(defenseHistory&&!force)return defenseHistory;
  if(!force){const c=cachedJson('fantasyLensDefenseHistory5yV2',30*24*60*60*1000);if(c){defenseHistory=c;return c}}
  const years=[2025,2024,2023,2022,2021],out={};
  try{await Promise.all(years.map(async y=>{const r=await fetch(`https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${y}`);if(!r.ok)throw Error(`ESPN standings ${y}: ${r.status}`);const j=await r.json(),vals={};for(const e of collectStandingEntries(j,[])){const team=normTeam(e.team?.abbreviation||e.team?.shortDisplayName||e.team?.name);if(!TEAM_CODES.includes(team))continue;const pa=standingStat(e,['pointsAgainst','pointsagainst','pa']),papg=standingStat(e,['avgPointsAgainst','pointsAgainstPerGame','pointsagainstpergame']),gp=standingStat(e,['gamesPlayed','gp']),value=pa!=null?pa:(papg!=null&&gp?papg*gp:papg);if(Number.isFinite(value))vals[team]=value}out[y]={ranks:rankByValue(vals,false),values:vals}}));defenseHistory=out;putCachedJson('fantasyLensDefenseHistory5yV2',out);return out}catch(e){console.warn('five-year defense history failed',e);defenseHistory=out;return out}
}

async function ensureMatchupRanks(force=false){if(matchupRanksPromise&&!force)return matchupRanksPromise;matchupRanksPromise=Promise.all([loadProjectionDefenseRanks(force),loadDvpRanks2025(force),loadDefenseHistory(force)]).finally(()=>{matchupRanksPromise=null});return matchupRanksPromise}
function eventWeekNumber(e){const c=e?.competitions?.[0],vals=[e?.week?.number,e?.weekNumber,c?.week?.number,c?.weekNumber,e?.seasonType?.week?.number];for(const v of vals){const n=Number(v);if(Number.isFinite(n)&&n>0)return n}return null}
function regularSeasonEvent(e){const t=Number(e?.season?.type??e?.seasonType?.type??e?.competitions?.[0]?.season?.type??0);if(t)return t===2;const text=String(e?.seasonType?.name||e?.seasonType?.typeName||'').toLowerCase();return !text||text.includes('regular')}
async function firstFour(team,force=false){
  team=normTeam(team);if(scheduleCache.has(team)&&!force)return scheduleCache.get(team);const slug=TEAM_SLUG[team];if(!slug)return[];
  try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${slug}/schedule?season=2026`);if(!r.ok)throw Error('ESPN schedule '+r.status);const j=await r.json(),candidates=[];for(const e of j.events||[]){if(!regularSeasonEvent(e))continue;const comp=e.competitions?.[0],cs=comp?.competitors||[],mine=cs.find(c=>normTeam(c.team?.abbreviation)===team),opp=cs.find(c=>c!==mine);if(!mine||!opp)continue;const oppCode=normTeam(opp.team?.abbreviation);if(!TEAM_CODES.includes(oppCode))continue;candidates.push({week:eventWeekNumber(e),date:new Date(e.date||comp?.date||0).getTime()||0,opp:oppCode,away:mine.homeAway==='away'})}candidates.sort((a,b)=>((a.week??99)-(b.week??99))||(a.date-b.date));const exact=[];for(let wk=1;wk<=4;wk++){const g=candidates.find(x=>x.week===wk);if(g)exact.push({...g,week:wk})}const out=exact.length===4?exact:candidates.slice(0,4).map((g,i)=>({...g,week:g.week||i+1}));scheduleCache.set(team,out);return out}catch(e){console.warn('schedule fetch failed',team,e);return[]}
}

function matchupGrade(opp,pos){const w=readModelWeights(),projRank=projectionDefenseRanks?.[opp]||FALLBACK_DEF26[opp]||16.5,positional=dvpRanks2025?.[pos]?.[opp],priorRank=positional||16.5,projEase=rankToEase(projRank),priorEase=rankToEase(priorRank);return{score:Math.round((projEase*w.projection+priorEase*w.last)/100),projRank,priorRank,weights:w,priorSource:positional?'2025 '+pos+' points allowed':'neutral fallback'}}
function installMatchupUI(){const meta=document.querySelector('.draftMeta');if(meta&&!document.querySelector('#matchupLegend')){const x=document.createElement('span');x.id='matchupLegend';x.innerHTML='<b>W1–W4:</b> red tough · yellow average · green favorable';meta.appendChild(x)}}
function findPlayerForRenderedNode(el){const txt=String(el.textContent||'').toLowerCase();return players.find(x=>txt.includes(String(x.name||'').toLowerCase()))}
async function decorateOpeningMatchups(force=false){
  if(matchupDecorating){matchupRerun=matchupRerun||force;return}matchupDecorating=true;
  try{installMatchupUI();if(!players?.length)return;await ensureMatchupRanks(false);const w=readModelWeights(),version=`v26-${w.projection}-${Object.keys(dvpRanks2025?.QB||{}).length}-${Object.keys(projectionDefenseRanks||{}).length}`,rows=[...document.querySelectorAll('#tablewrap tbody tr,.cards .card')];for(const el of rows){if(!force&&el.dataset.matchupVersion===version&&el.querySelectorAll('.openingMatchups').length===1)continue;el.querySelectorAll('.openingMatchups').forEach(x=>x.remove());const p=findPlayerForRenderedNode(el);if(!p||!['QB','RB','WR','TE'].includes(p.pos))continue;const games=await firstFour(p.team,false);if(!games.length)continue;const box=document.createElement('div');box.className='openingMatchups';box.style.cssText='display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;font-size:10px';box.innerHTML=games.map((g,i)=>{const m=matchupGrade(g.opp,p.pos),wk=g.week||i+1;return `<span title="Week ${wk} ${g.opp} • ${m.priorSource} rank ${Number.isInteger(m.priorRank)?'#'+m.priorRank:'N/A'} • 2026 projected defense #${m.projRank} • ${m.weights.last}% last year / ${m.weights.projection}% projection" style="background:${matchupColor(m.score)};color:white;padding:3px 6px;border-radius:6px;font-weight:800">W${wk} ${g.away?'@':''}${g.opp} ${m.score}</span>`}).join('');const target=el.querySelector('td:nth-child(2),.playerName,.name')||el.firstElementChild||el;target.appendChild(box);el.dataset.matchupVersion=version}}finally{matchupDecorating=false;if(matchupRerun){const rerun=matchupRerun;matchupRerun=false;setTimeout(()=>decorateOpeningMatchups(rerun),0)}}
}
function observeMatchups(){for(const sel of ['#tablewrap','#cards']){const root=document.querySelector(sel);if(!root)continue;let timer=null;new MutationObserver(muts=>{const onlyOurChips=muts.every(m=>[...m.addedNodes,...m.removedNodes].every(n=>n.nodeType!==1||n.classList?.contains('openingMatchups')));if(onlyOurChips)return;clearTimeout(timer);timer=setTimeout(()=>decorateOpeningMatchups(false),45)}).observe(root,{childList:true,subtree:true})}}

function installMatchupSettings(){
  if(document.querySelector('#matchupModelSettings'))return;const body=document.querySelector('#settingsModal .careerbody');if(!body)return;const s=document.createElement('section');s.id='matchupModelSettings';s.style.cssText='margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.12)';const w=readModelWeights();s.innerHTML=`<h3 style="margin:0 0 6px">Opening Matchup Model</h3><p style="color:var(--muted);font-size:11px;margin:0 0 10px">Weeks 1–4. 2025 rank is fantasy points allowed to that exact position (QB/RB/WR/TE). 2026 rank is projected overall team-defense strength. Higher chip score = easier matchup.</p><div style="display:grid;grid-template-columns:minmax(180px,1fr) 64px;gap:8px;align-items:center"><label>2026 projection weight <input id="matchProjWeight" type="range" min="0" max="100" step="5" value="${w.projection}" style="width:100%"></label><output id="matchProjOut">${w.projection}%</output><label>2025 positional defense weight <input id="matchLastWeight" type="range" min="0" max="100" step="5" value="${w.last}" style="width:100%" disabled></label><output id="matchLastOut">${w.last}%</output></div><button class="btn" id="refreshMatchupRanks" type="button" style="margin-top:10px">Refresh Matchups + Defense Ranks</button><span id="matchupSettingsStatus" style="margin-left:8px;color:var(--muted);font-size:11px"></span>`;body.appendChild(s);const proj=s.querySelector('#matchProjWeight'),last=s.querySelector('#matchLastWeight'),po=s.querySelector('#matchProjOut'),lo=s.querySelector('#matchLastOut'),status=s.querySelector('#matchupSettingsStatus');proj.addEventListener('input',()=>{const nw=saveModelProjectionWeight(proj.value);last.value=nw.last;po.textContent=nw.projection+'%';lo.textContent=nw.last+'%';document.querySelectorAll('[data-matchup-version]').forEach(x=>delete x.dataset.matchupVersion);decorateOpeningMatchups(true)});s.querySelector('#refreshMatchupRanks').onclick=async()=>{status.textContent='Refreshing…';projectionDefenseRanks=null;dvpRanks2025=null;defenseHistory=null;scheduleCache.clear();await ensureMatchupRanks(true);status.textContent='Updated';renderDefenseHistory();decorateOpeningMatchups(true)};
}

function installSpecialStyles(){if(document.querySelector('#fantasyLensSpecialStyles'))return;const st=document.createElement('style');st.id='fantasyLensSpecialStyles';st.textContent=`.defRankWrap{overflow:auto;max-height:68vh;border:1px solid rgba(255,255,255,.12);border-radius:10px}.defRankTable{width:100%;border-collapse:separate;border-spacing:0;font-size:12px;min-width:720px}.defRankTable th,.defRankTable td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.08);text-align:center;white-space:nowrap}.defRankTable th{position:sticky;top:0;background:#101821;z-index:2}.defRankTable th:first-child{left:0;z-index:3}.defRankTable td:first-child{position:sticky;left:0;background:#0d141c;text-align:left;font-weight:900;z-index:1}.defTeam{display:flex;align-items:center;gap:8px}.defTeam img{width:28px;height:28px;object-fit:contain}.defRankCell{font-weight:900;color:white;text-shadow:0 1px 2px rgba(0,0,0,.45);border-radius:7px;display:inline-block;min-width:46px;padding:5px 7px}.specialLegend{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 12px;color:var(--muted);font-size:11px}.specialLegend i{width:72px;height:9px;border-radius:99px;background:linear-gradient(90deg,hsl(0 72% 38%),hsl(60 72% 38%),hsl(120 72% 38%));display:inline-block}.kickerName{display:block;font-size:10px;color:var(--muted);margin-top:3px;max-width:130px;overflow:hidden;text-overflow:ellipsis}`;document.head.appendChild(st)}

function installDefenseModal(){installSpecialStyles();const bar=document.querySelector('.appbarInner');if(bar&&!document.querySelector('#defenseBtn')){const b=document.createElement('button');b.className='btn';b.id='defenseBtn';b.textContent='DEFENSE';const anchor=document.querySelector('#importDraftBtn');bar.insertBefore(b,anchor||document.querySelector('#dataLabBtn')||null)}document.querySelector('#specialBtn')?.remove();document.querySelector('#specialModal')?.remove();if(!document.querySelector('#defenseModal')){const modal=document.createElement('div');modal.className='modal';modal.id='defenseModal';modal.innerHTML='<div class="modalbox"><div class="modalhead"><div><h2>DEFENSE</h2><small style="color:#aebdca">2026 projected rank + last five completed seasons · #1 = strongest defense</small></div><button class="btn close" id="closeDefense">×</button></div><div class="careerbody"><div class="specialLegend"><span>Weak</span><i></i><span>Strong</span><span>• Green = stronger defense, red = weaker.</span></div><div class="careerstatus" id="defenseHistoryStatus">Load defense ranks.</div><div id="defenseHistoryTable"></div></div></div>';document.body.appendChild(modal)}const modal=document.querySelector('#defenseModal');document.querySelector('#defenseBtn').onclick=async()=>{modal.classList.add('open');document.querySelector('#defenseHistoryStatus').textContent='Loading 2026 projection + 2025–2021 ranks…';await Promise.all([loadProjectionDefenseRanks(false),loadDefenseHistory(false)]);renderDefenseHistory()};document.querySelector('#closeDefense').onclick=()=>modal.classList.remove('open');modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')})}
function renderDefenseHistory(){const root=document.querySelector('#defenseHistoryTable'),status=document.querySelector('#defenseHistoryStatus');if(!root)return;const years=[2025,2024,2023,2022,2021],current=projectionDefenseRanks||FALLBACK_DEF26,teams=[...TEAM_CODES].sort((a,b)=>(current[a]||99)-(current[b]||99)||a.localeCompare(b)),rows=teams.map(team=>`<tr><td><div class="defTeam"><img src="${teamLogoUrl(team)}" onerror="this.style.display='none'"><span>${team}</span></div></td><td><span class="defRankCell" style="background:${rankColor(current[team]||16.5)}">#${current[team]||'—'}</span></td>${years.map(y=>{const rank=defenseHistory?.[y]?.ranks?.[team],raw=defenseHistory?.[y]?.values?.[team];if(!rank)return'<td>—</td>';return `<td title="${y} ${team}: ${raw==null?'':Math.round(raw)+' points allowed · '}defense rank #${rank}"><span class="defRankCell" style="background:${rankColor(rank)}">#${rank}</span></td>`}).join('')}</tr>`).join('');root.innerHTML=`<div class="defRankWrap"><table class="defRankTable"><thead><tr><th>Team</th><th>2026 PROJ</th>${years.map(y=>`<th>${y}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;status.textContent='2026 is projected team-defense rank. 2025–2021 are regular-season points-allowed ranks. #1 is strongest.'}

function kickerPoints(row){const s=row.stats||row,direct=Number(s.pts_std??s.pts_half_ppr??row.pts_std??row.pts_half_ppr);if(Number.isFinite(direct))return direct;const fgm=Number(s.fgm||0)||(['fgm_0_19','fgm_20_29','fgm_30_39','fgm_40_49','fgm_50p'].reduce((a,k)=>a+Number(s[k]||0),0));return fgm*3+Number(s.xpm||0)}
async function loadKickerHistory(force=false){
  if(kickerHistory&&!force)return kickerHistory;if(!force){const c=cachedJson('fantasyLensKickerHistoryV1',24*60*60*1000);if(c){kickerHistory=c;return c}}const directory=await loadSleeperDirectory(false),out={history:{},projection:{},names:{}};
  try{await Promise.all([2025,2024,2023,2022,2021].map(async y=>{const r=await fetch(`https://api.sleeper.com/stats/nfl/${y}?season_type=regular&position[]=K&order_by=pts_std`);if(!r.ok)throw Error(`K stats ${y}: ${r.status}`);const rows=await r.json(),vals={};for(const row of Array.isArray(rows)?rows:[]){if(sleeperPos(row,directory)!=='K')continue;const team=sleeperTeam(row,directory);if(!TEAM_CODES.includes(team))continue;const pts=kickerPoints(row);if(Number.isFinite(pts))vals[team]=(vals[team]||0)+pts}out.history[y]={values:vals,ranks:rankByValue(vals,true)}}));const r=await fetch('https://api.sleeper.com/projections/nfl/2026?season_type=regular&position[]=K&order_by=pts_std');if(!r.ok)throw Error('K projections '+r.status);const rows=await r.json(),vals={},best={};for(const row of Array.isArray(rows)?rows:[]){if(sleeperPos(row,directory)!=='K')continue;const team=sleeperTeam(row,directory);if(!TEAM_CODES.includes(team))continue;const pts=kickerPoints(row);if(!Number.isFinite(pts))continue;const id=String(row.player_id||row.player?.player_id||''),name=row.player?.full_name||directory?.[id]?.full_name||[directory?.[id]?.first_name,directory?.[id]?.last_name].filter(Boolean).join(' ')||id;if(!best[team]||pts>best[team].pts)best[team]={pts,name}}for(const [team,b] of Object.entries(best)){vals[team]=b.pts;out.names[team]=b.name}out.projection={values:vals,ranks:rankByValue(vals,true)};kickerHistory=out;putCachedJson('fantasyLensKickerHistoryV1',out);return out}catch(e){console.warn('kicker history failed',e);kickerHistory=out;return out}
}
function installKickerModal(){installSpecialStyles();const bar=document.querySelector('.appbarInner');if(bar&&!document.querySelector('#kickerBtn')){const b=document.createElement('button');b.className='btn';b.id='kickerBtn';b.textContent='KICKER';const anchor=document.querySelector('#importDraftBtn');bar.insertBefore(b,anchor||null)}if(!document.querySelector('#kickerModal')){const modal=document.createElement('div');modal.className='modal';modal.id='kickerModal';modal.innerHTML='<div class="modalbox"><div class="modalhead"><div><h2>KICKER</h2><small style="color:#aebdca">Team kicker output history + current 2026 kicker projection</small></div><button class="btn close" id="closeKicker">×</button></div><div class="careerbody"><div class="specialLegend"><span>Low output</span><i></i><span>High output</span><span>• Green = higher team kicker fantasy output.</span></div><div class="careerstatus" id="kickerStatus">Load kicker ranks.</div><div id="kickerTable"></div></div></div>';document.body.appendChild(modal)}const modal=document.querySelector('#kickerModal');document.querySelector('#kickerBtn').onclick=async()=>{modal.classList.add('open');document.querySelector('#kickerStatus').textContent='Loading kicker history + 2026 projections…';await loadKickerHistory(false);renderKickerHistory()};document.querySelector('#closeKicker').onclick=()=>modal.classList.remove('open');modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')})}
function renderKickerHistory(){const root=document.querySelector('#kickerTable'),status=document.querySelector('#kickerStatus');if(!root||!kickerHistory)return;const years=[2025,2024,2023,2022,2021],pr=kickerHistory.projection?.ranks||{},teams=[...TEAM_CODES].sort((a,b)=>(pr[a]||99)-(pr[b]||99)||a.localeCompare(b)),rows=teams.map(team=>{const rank=pr[team],pts=kickerHistory.projection?.values?.[team],name=kickerHistory.names?.[team]||'—';return `<tr><td><div class="defTeam"><img src="${teamLogoUrl(team)}" onerror="this.style.display='none'"><span>${team}</span></div></td><td>${rank?`<span class="defRankCell" style="background:${rankColor(rank)}">#${rank}</span><span class="kickerName">${name} · ${Math.round(pts||0)} proj pts</span>`:'—'}</td>${years.map(y=>{const r=kickerHistory.history?.[y]?.ranks?.[team],v=kickerHistory.history?.[y]?.values?.[team];return r?`<td title="${team} kickers ${y}: ${Math.round(v||0)} total fantasy points"><span class="defRankCell" style="background:${rankColor(r)}">#${r}</span><span class="kickerName">${Math.round(v||0)} pts</span></td>`:'<td>—</td>'}).join('')}</tr>`}).join('');root.innerHTML=`<div class="defRankWrap"><table class="defRankTable"><thead><tr><th>Team</th><th>2026 K PROJ</th>${years.map(y=>`<th>${y} TEAM K</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;status.textContent='Historical columns sum team kicker fantasy output for that season; 2026 shows the highest projected current kicker on each team.'}

function installHealthEligibilityFix(){
  renderHealth=function(d){$('#viewMeta').textContent='Games played by NFL-eligible season • 2021–2025';const years=[2021,2022,2023,2024,2025],headers=[{t:'PLAYER'},{t:'AGE',k:'age'},...years.map(y=>({t:`${y} GP`})),{t:'ELIGIBLE GP'},{t:'MISSED'},{t:'AVAILABILITY',k:'healthPct'},{t:'ASSESSMENT'}],rows=d.map(p=>{const map=Object.fromEntries((p.healthYears||[]).filter(x=>years.includes(x.year)).map(x=>[x.year,x])),eligible=years.filter(y=>map[y]),gp=eligible.reduce((a,y)=>a+(map[y]?.gp||0),0),sched=eligible.reduce((a,y)=>a+(map[y]?.sched||17),0),missed=sched?Math.max(0,sched-gp):null,pct=sched?whole(gp/sched*100):null,cl=pct>=80?'healthGood2':pct!=null&&pct<65?'healthRisk':'';return `<tr class="${draftedIds.has(p.id)?'draftedRow':''}"><td>${playerCell(p)}</td><td>${p.age||'—'}</td>${years.map(y=>{const h=map[y];return `<td class="gpCell">${h?`<b>${h.gp}</b><small>of ${h.sched}</small>`:'<span style="color:var(--muted)">N/A</span>'}</td>`}).join('')}<td><b>${sched?gp+'/'+sched:'—'}</b><small style="display:block;color:var(--muted)">${eligible.length} eligible season${eligible.length===1?'':'s'}</small></td><td>${missed==null?'—':missed}</td><td class="${cl}">${pct==null?'—':pct+'%'}${pct!=null?`<div class="healthPctBar"><i style="width:${pct}%"></i></div>`:''}</td><td>${healthLabel(pct)}</td></tr>`}).join('');$('#tablewrap').innerHTML=`<div class="healthSummary"><b>Health = availability, not a medical injury grade.</b> Only seasons where the player appears in the NFL player/stat pool count. Pre-debut seasons for rookies/young players are N/A and do not lower availability.</div>`+tableWrap(headers,rows)};
}

window.addEventListener('load',()=>{
  installDepthDraftFilters();installMatchupSettings();installDefenseModal();installKickerModal();installHealthEligibilityFix();document.querySelectorAll('.openingMatchups').forEach(x=>x.remove());
  const root=document.querySelector('#depthResults');if(root)new MutationObserver(()=>applyDepthDraftFilter()).observe(root,{childList:true,subtree:true});
  document.querySelector('#exploreBtn')?.addEventListener('click',()=>setTimeout(applyDepthDraftFilter,25));document.querySelector('#runDepth')?.addEventListener('click',()=>setTimeout(applyDepthDraftFilter,400));document.querySelector('#depthSearch')?.addEventListener('input',()=>setTimeout(applyDepthDraftFilter,0));document.querySelectorAll('#viewNav [data-view]').forEach(b=>b.addEventListener('click',()=>{if(['overview','matrix','health'].includes(b.dataset.view))ensureHistoricalViews(false);setTimeout(()=>decorateOpeningMatchups(false),70)}));
  setTimeout(()=>{try{if(['overview','matrix','health'].includes(currentView))ensureHistoricalViews(false)}catch{}applyDepthDraftFilter();observeMatchups();decorateOpeningMatchups(true)},550);
});