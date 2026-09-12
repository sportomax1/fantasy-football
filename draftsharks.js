(()=>{
'use strict';

const YEAR=2026;
const FANTASY='https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';
const CORE='https://sports.core.api.espn.com/v3/sports/football/nfl/athletes?active=true&limit=2000';
const PARSE='https://api.parse.bot/scraper/8cbb56cd-270c-41c6-ab5b-ff713cf1ef13';
const DS_URL='https://www.draftsharks.com/rankings/half-ppr';
const STORAGE_KEY='nflHealthLabDraftSharksStaticV2';

const EXPORTER=`(() => {
  const table = [...document.querySelectorAll("table")]
    .sort((a, b) => b.querySelectorAll("tr").length - a.querySelectorAll("tr").length)[0];

  let tier = "";

  const data = [[
    "Tier", "Rank", "Player", "Team", "Pos", "Games", "ADP", "Bye",
    "SOS", "Injury Risk", "Floor Proj", "Cons Proj", "DS Proj",
    "Ceil Proj", "3D Value"
  ]];

  for (const row of table.querySelectorAll("tr")) {
    const cells = [...row.querySelectorAll("th, td")]
      .map(cell => cell.innerText.trim().replaceAll("\\t", " "));

    if (cells.length === 1 && /^Tier \\d+/i.test(cells[0])) {
      tier = cells[0];
      continue;
    }

    if (cells.length === 12 && /^\\d+$/.test(cells[0])) {
      const playerParts = cells[1].split(/\\n+/).map(x => x.trim()).filter(Boolean);
      const pos = playerParts.pop() || "";
      const team = playerParts.pop() || "";
      const player = playerParts.join(" ");

      data.push([
        tier,
        cells[0],
        player,
        team,
        pos,
        ...cells.slice(2)
      ]);
    }
  }

  const tsv = data.map(row => row.join("\\t")).join("\\n");
  copy(tsv);

  console.log(\`Copied \${data.length - 1} players. Paste into Excel or Google Sheets.\`);
})();`;

const FP=new Set(['QB','RB','WR','TE','K']);
const OFF=new Set(['QB','RB','FB','WR','TE','OT','T','LT','RT','OG','G','LG','RG','C','OL']);
const DEF=new Set(['DT','NT','DE','DL','EDGE','LB','ILB','OLB','CB','S','FS','SS','DB']);
const ST=new Set(['K','P','PK','LS']);
const POS_MAP={1:'QB',2:'RB',3:'WR',4:'TE',5:'K',7:'P',9:'DT',10:'DE',11:'LB',12:'CB',13:'S'};
const TEAM_MAP={0:'FA',1:'ATL',2:'BUF',3:'CHI',4:'CIN',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GB',10:'TEN',11:'IND',12:'KC',13:'LV',14:'LAR',15:'MIA',16:'MIN',17:'NE',18:'NO',19:'NYG',20:'NYJ',21:'PHI',22:'ARI',23:'PIT',24:'LAC',25:'SF',26:'SEA',27:'TB',28:'WSH',29:'CAR',30:'JAX',33:'BAL',34:'HOU'};
const TEAM_NAME={ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',KC:'Kansas City Chiefs',LV:'Las Vegas Raiders',LAC:'Los Angeles Chargers',LAR:'Los Angeles Rams',MIA:'Miami Dolphins',MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SEA:'Seattle Seahawks',SF:'San Francisco 49ers',TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WSH:'Washington Commanders'};

const $=q=>document.querySelector(q);
const E={
  search:$('#search'),pos:$('#posFilter'),health:$('#healthFilter'),rows:$('#rows'),empty:$('#empty'),load:$('#loadState'),
  key:$('#dsKey'),score:$('#scoring'),league:$('#leagueType'),picker:$('#teamPicker'),menu:$('#teamMenu'),teamBtn:$('#teamButton'),teamLogo:$('#teamButtonLogo'),teamText:$('#teamButtonText'),
  importText:$('#importText'),importStatus:$('#importStatus'),matchStatus:$('#matchStatus'),importPreview:$('#importPreview')
};
const S={players:[],teams:[],team:'',group:'all',sort:{k:'name',d:1},ds:new Map(),dsRows:[],practice:new Map(),updated:null,source:'fantasy',importedAt:null,importSource:null};

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:null};
const logo=a=>a?`https://a.espncdn.com/i/teamlogos/nfl/500/${a.toLowerCase()}.png`:'';
const head=id=>`https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`;

function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3800)}
function setHealth(source,cls,text){$(`#${source}Dot`).className=`dot ${cls}`;$(`#${source}Health`).textContent=text}
function groupFor(pos){return FP.has(pos)?'fantasy':OFF.has(pos)?'offense':DEF.has(pos)?'defense':ST.has(pos)?'st':'other'}
function healthClass(s){s=String(s||'').toLowerCase();return /out|reserve|\bir\b|suspend/.test(s)?'red':/doubt/.test(s)?'orange':/question|limited|day.to.day/.test(s)?'yellow':'green'}
function riskClass(r){return r==null?'blue':r>=60?'red':r>=35?'orange':r>=20?'yellow':'green'}

async function getJSON(url,opt={}){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),25000);
  try{
    const r=await fetch(url,{...opt,signal:c.signal,cache:'no-store'});
    const text=await r.text();
    if(!r.ok)throw new Error(`${r.status} ${r.statusText}: ${text.slice(0,200)}`);
    return JSON.parse(text);
  }finally{clearTimeout(timer)}
}

async function getActiveFantasy(){
  const url=`${FANTASY}/seasons/${YEAR}/players?scoringPeriodId=0&view=players_wl`;
  const d=await getJSON(url,{headers:{'x-fantasy-filter':JSON.stringify({filterActive:{value:true}}),accept:'application/json'}});
  return Array.isArray(d)?d:(d.players||[]);
}
async function getKona(filter,view='kona_player_info'){
  return getJSON(`${FANTASY}/seasons/${YEAR}/segments/0/leaguedefaults/3?scoringPeriodId=0&view=${view}`,{headers:{'x-fantasy-filter':JSON.stringify(filter),accept:'application/json'}});
}
async function getCoreAthletes(){
  const d=await getJSON(CORE,{headers:{accept:'application/json'}});
  return d.items||d.athletes||[];
}
function playerObj(e){return e?.player||e?.playerPoolEntry?.player||e||{}}
function statArray(e,p){return[...(p?.stats||[]),...(e?.playerPoolEntry?.stats||[]),...(e?.stats||[])]}
function seasonStat(e,p,source){return statArray(e,p).find(x=>+x.seasonId===YEAR&&+x.statSourceId===source&&+x.statSplitTypeId===0)||statArray(e,p).find(x=>+x.seasonId===YEAR&&+x.statSourceId===source)||null}
function normalizeStats(s){
  const x=s?.stats||{};
  const o={passYds:+(x[3]??x[22]??0),passTD:+(x[4]||0),ints:+(x[20]||0),rushAtt:+(x[23]||0),rushYds:+(x[24]??x[40]??0),rushTD:+(x[25]||0),rec:+(x[41]??x[53]??0),recYds:+(x[42]||0),recTD:+(x[43]||0),lostFum:+(x[72]||0)};
  o.fantasy=o.passYds/25+o.passTD*4-o.ints*2+o.rushYds/10+o.rushTD*6+o.recYds/10+o.recTD*6+o.rec*.5-o.lostFum*2;
  return o;
}
function injury(raw,flag){
  let s=String(raw||'').trim();if(!s&&!flag)return null;
  const key=s.toUpperCase().replace(/[_-]/g,' '),map={ACTIVE:'',QUESTIONABLE:'Questionable',DOUBTFUL:'Doubtful',OUT:'Out','INJURY RESERVE':'Injured Reserve','INJURED RESERVE':'Injured Reserve',IR:'Injured Reserve',SUSPENDED:'Suspended'};
  s=map[key]!==undefined?map[key]:(s||'Injured').replace(/\b\w/g,c=>c.toUpperCase());
  return s?{status:s}:null;
}
function fantasyPlayer(e,base={}){
  const p={...playerObj(base),...playerObj(e)},pos=POS_MAP[+p.defaultPositionId];if(!pos)return null;
  const actual=seasonStat(e,p,0),projected=seasonStat(e,p,1),teamId=+(p.proTeamId??actual?.proTeamId??projected?.proTeamId??0),team=TEAM_MAP[teamId]||'FA',id=String(p.id||e?.id||'');
  if(!id||team==='FA')return null;
  return{id,name:p.fullName||p.displayName||'Unknown',position:pos,group:groupFor(pos),teamAbbr:team,teamName:TEAM_NAME[team]||team,teamLogo:logo(team),headshot:p.headshot?.href||head(id),jersey:p.jersey||'',experience:p.experience?.years??p.experience??'',active:p.active!==false,injury:injury(p.injuryStatus,p.injured),actual:normalizeStats(actual),projected:normalizeStats(projected),raw:p,source:'fantasy'};
}
function normalizePosition(p){
  const raw=String(p||'').toUpperCase().replace(/[^A-Z]/g,''),map={OFFENSIVETACKLE:'OT',OFFENSIVEGUARD:'OG',CENTER:'C',DEFENSIVETACKLE:'DT',DEFENSIVEEND:'DE',LINEBACKER:'LB',CORNERBACK:'CB',SAFETY:'S',LONGSNAPPER:'LS',PUNTER:'P',KICKER:'K',FULLBACK:'FB'};
  return map[raw]||raw;
}
function corePlayer(row){
  const a=row?.athlete||row||{},id=String(a.id||''),pos=normalizePosition(a.position?.abbreviation||a.position?.displayName||a.position),teamId=+(a.team?.id||a.teamId||0),team=String(a.team?.abbreviation||TEAM_MAP[teamId]||'').toUpperCase();
  if(!id||!pos||!team||team==='FA')return null;
  return{id,name:a.fullName||a.displayName||[a.firstName,a.lastName].filter(Boolean).join(' '),position:pos,group:groupFor(pos),teamAbbr:team,teamName:a.team?.displayName||TEAM_NAME[team]||team,teamLogo:a.team?.logos?.[0]?.href||logo(team),headshot:a.headshot?.href||a.headshot||head(id),jersey:a.jersey||'',experience:a.experience?.years??a.experience??'',active:a.active!==false,injury:injury(a.injuryStatus,a.injured),actual:normalizeStats(null),projected:normalizeStats(null),raw:a,source:'core'};
}
function mergePlayer(a,b){return{...a,...b,position:b?.position||a?.position,group:groupFor(b?.position||a?.position),teamLogo:b?.teamLogo||a?.teamLogo,headshot:b?.headshot||a?.headshot,injury:b?.injury||a?.injury,source:a&&b?'core+fantasy':(b?'fantasy':'core')}}

function normalizeHeader(h){return String(h||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'')}
function parseDelimited(text){
  text=String(text||'').replace(/^\uFEFF/,'').trim();if(!text)return[];
  const first=(text.split(/\r?\n/)[0]||''),delimiter=(first.match(/\t/g)||[]).length>=(first.match(/,/g)||[]).length?'\t':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
    }else if(ch===delimiter&&!quoted){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[];cell=''}
    else cell+=ch;
  }
  row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);
  if(rows.length<2)return[];
  const headers=rows.shift().map(normalizeHeader);
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,String(values[i]??'').trim()])));
}
function normalizeDSRow(row){
  const get=(...keys)=>{for(const key of keys){const v=row[normalizeHeader(key)]??row[key];if(v!==undefined&&String(v).trim()!=='')return String(v).trim()}return''};
  const name=get('Player','Name','player_name');if(!name)return null;
  const pos=normalizePosition(get('Pos','Position'));
  const team=get('Team').toUpperCase();
  return{
    name,team,position:pos,tier:get('Tier'),rank:num(get('Rank')),games:get('Games'),adp:get('ADP'),bye:get('Bye'),sos:get('SOS'),injury_risk:num(get('Injury Risk','injury_risk')),
    floor:get('Floor Proj','Floor','floor_projection'),consensus:get('Cons Proj','Consensus','cons_projection'),ds_projection:get('DS Proj','DS Projection','projection'),ceiling:get('Ceil Proj','Ceiling','ceiling_projection'),value3d:get('3D Value','3D','value_3d'),source:'static'
  };
}
function saveSnapshot(rows,source='static'){
  const payload={version:2,importedAt:new Date().toISOString(),source,rows};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));
  applySnapshot(payload);
}
function applySnapshot(payload){
  const rows=(payload?.rows||[]).map(r=>r?.name?r:normalizeDSRow(r)).filter(Boolean);
  S.dsRows=rows;S.ds=new Map(rows.map(r=>[norm(r.name),r]));S.importedAt=payload?.importedAt?new Date(payload.importedAt):new Date();S.importSource=payload?.source||'static';
  updateImportStatus();render();
}
function loadSnapshot(){
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)applySnapshot(JSON.parse(raw));else updateImportStatus()}catch(e){console.warn('Saved DraftSharks snapshot invalid',e);localStorage.removeItem(STORAGE_KEY);updateImportStatus()}
}
function clearSnapshot(){
  localStorage.removeItem(STORAGE_KEY);S.dsRows=[];S.ds=new Map();S.importedAt=null;S.importSource=null;updateImportStatus();render();toast('DraftSharks imported snapshot cleared.');
}
function matchImported(){
  if(!S.dsRows.length||!S.players.length)return{matched:0,total:S.dsRows.length,unmatched:S.dsRows.length};
  const playerIndex=new Map();
  for(const p of S.players){const key=norm(p.name);if(!playerIndex.has(key))playerIndex.set(key,[]);playerIndex.get(key).push(p)}
  let matched=0;
  for(const d of S.dsRows){
    const candidates=playerIndex.get(norm(d.name))||[];
    let ok=candidates.some(p=>(!d.team||p.teamAbbr===d.team)&&(!d.position||p.position===d.position));
    if(!ok&&candidates.length===1)ok=true;
    if(ok)matched++;
  }
  return{matched,total:S.dsRows.length,unmatched:S.dsRows.length-matched};
}
function updateImportStatus(){
  if(!S.dsRows.length){E.importStatus.textContent='No DraftSharks snapshot imported';E.matchStatus.textContent='Import DraftSharks TSV/CSV to merge rankings onto ESPN players.';setHealth('ds','', 'no import');return}
  const when=S.importedAt?S.importedAt.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'now',m=matchImported();
  E.importStatus.textContent=`${S.dsRows.length} DS rows · ${when}`;
  E.matchStatus.textContent=S.players.length?`${m.matched}/${m.total} DraftSharks rows matched to ESPN${m.unmatched?` · ${m.unmatched} unmatched`:''}`:'DraftSharks snapshot loaded; waiting for ESPN players to match.';
  setHealth('ds','ok',`${S.dsRows.length} imported`);
}
function importText(text,source='paste'){
  const parsed=parseDelimited(text),rows=parsed.map(normalizeDSRow).filter(Boolean);
  if(!rows.length)throw new Error('No DraftSharks player rows found. Make sure the header row and TSV/CSV data are included.');
  saveSnapshot(rows,source);const m=matchImported();
  toast(`Imported ${rows.length} DraftSharks players${S.players.length?` · ${m.matched} matched to ESPN`:''}.`);
  $('#importModal').classList.remove('open');E.importText.value='';
}

function dsFor(p){
  const exact=S.ds.get(norm(p.name));if(!exact)return null;
  if(exact.team&&p.teamAbbr&&exact.team!==p.teamAbbr)return exact;
  return exact;
}
function practiceFor(p){return S.practice.get(norm(p.name))||{}}
function mergedRow(p){const d=dsFor(p);return{...p,ds:d,practice:practiceFor(p),risk:d?.injury_risk??null,rank:d?.rank??null}}
function practiceBadge(x){if(!x)return'<span class="practice none">—</span>';const c=x.code==='FULL'?'full':x.code==='LIMITED'?'limited':x.code==='DNP'?'dnp':'other';return`<span class="practice ${c}" title="${esc(x.text||x.code)}">${esc(x.code)}</span>`}

function rebuildFilters(){
  const abbrs=[...new Set(S.players.map(p=>p.teamAbbr).filter(Boolean))].sort();S.teams=abbrs.map(a=>({a,n:TEAM_NAME[a]||a,l:logo(a)}));renderTeamMenu();
  const positions=[...new Set(S.players.map(p=>p.position).filter(Boolean))].sort(),current=E.pos.value;E.pos.innerHTML='<option value="">All positions</option>'+positions.map(p=>`<option>${esc(p)}</option>`).join('');if(positions.includes(current))E.pos.value=current;
}
function renderTeamMenu(){
  const selected=S.teams.find(x=>x.a===S.team);E.teamLogo.innerHTML=selected?`<img src="${selected.l}" alt="">`:'';E.teamText.textContent=selected?selected.n:'All teams';
  E.menu.innerHTML=`<button class="team-option ${!S.team?'on':''}" data-team=""><span style="width:20px;text-align:center">🏈</span><span>All teams</span></button>`+S.teams.map(t=>`<button class="team-option ${S.team===t.a?'on':''}" data-team="${t.a}"><img src="${t.l}" alt=""><span>${esc(t.n)}</span><small>${t.a}</small></button>`).join('');
  E.menu.querySelectorAll('button').forEach(b=>b.onclick=()=>{S.team=b.dataset.team||'';E.picker.classList.remove('open');renderTeamMenu();render()});
}

async function loadESPN(){
  setHealth('espn','busy','loading');E.load.innerHTML='<span class="spinner"></span> ESPN';
  try{
    const activeRows=await getActiveFantasy();if(!activeRows.length)throw new Error('players_wl returned 0 players');
    const map=new Map(activeRows.map(x=>fantasyPlayer(x,x)).filter(Boolean).map(p=>[p.id,p]));
    S.players=[...map.values()];S.updated=new Date();rebuildFilters();updateImportStatus();render();
    const filter={players:{limit:2000,sortPercOwned:{sortPriority:4,sortAsc:false},filterStatsForTopScoringPeriodIds:{value:18,additionalValue:[`00${YEAR}`,`10${YEAR}`]}}};
    const [konaResult,coreResult]=await Promise.allSettled([getKona(filter),getCoreAthletes()]);
    if(coreResult.status==='fulfilled'){
      for(const raw of coreResult.value){const c=corePlayer(raw);if(!c)continue;map.set(c.id,map.has(c.id)?mergePlayer(c,map.get(c.id)):c)}S.source='core+fantasy';
    }
    if(konaResult.status==='fulfilled'){
      for(const e of konaResult.value.players||[]){const id=String(playerObj(e).id||e.id||''),f=fantasyPlayer(e,map.get(id)?.raw);if(f)map.set(id,map.has(id)?mergePlayer(map.get(id),f):f)}
    }
    S.players=[...map.values()].filter(p=>p.active&&p.teamAbbr);rebuildFilters();updateImportStatus();setHealth('espn','ok',`${S.players.length} active`);toast(`ESPN refreshed ${S.players.length} active players.`);
  }catch(e){console.error(e);setHealth('espn','bad','failed');toast('ESPN load failed: '+e.message)}finally{E.load.textContent='';render()}
}

async function parseFetch(endpoint,params={}){
  if(!E.key.value.trim())throw new Error('Enter a Parse API key first.');const q=new URLSearchParams();Object.entries(params).forEach(([k,v])=>q.set(k,v??''));
  return getJSON(`${PARSE}/${endpoint}?${q}`,{headers:{'X-API-Key':E.key.value.trim()}});
}
function articleList(x){return Array.isArray(x)?x:(x?.data?.articles||x?.articles||x?.data?.news||x?.news||[])}
function practiceStatus(text){
  text=String(text||'').toLowerCase();if(!/practic/.test(text))return null;
  if(/did not (participate|practice)|didn't practice|non[- ]participant|\bdnp\b|held out|missed practice/.test(text))return{code:'DNP',text:'Did not practice'};
  if(/limited( participant| participation)?|limited in practice/.test(text))return{code:'LIMITED',text:'Limited practice'};
  if(/full participant|full participation|practiced in full|full practice/.test(text))return{code:'FULL',text:'Full practice'};
  if(/returned to practice|participated in practice/.test(text))return{code:'PRACTICE',text:'Practiced'};
  return null;
}
function practiceDay(article,text){
  text=text.toLowerCase();if(text.includes('wednesday'))return'wed';if(text.includes('thursday'))return'thu';if(text.includes('friday'))return'fri';
  const d=new Date(article.date||article.published_at||article.timestamp||'');return Number.isNaN(+d)?null:({3:'wed',4:'thu',5:'fri'})[d.getDay()]||null;
}
function indexPractice(articles){
  S.practice=new Map();const names=S.players.map(p=>[norm(p.name),p.name]);
  for(const a of articles){
    const text=[a.title,a.summary,a.description,a.content].filter(Boolean).join(' '),status=practiceStatus(text),day=practiceDay(a,text);if(!status||!day)continue;
    let name=a?.player?.name||a.player_name||a.playerName||a?.players?.[0]?.name||'',key=norm(name);
    if(!key){const nt=norm(text),hit=names.find(([k])=>k.length>4&&nt.includes(k));if(hit)key=hit[0]}
    if(!key)continue;const current=S.practice.get(key)||{},when=+new Date(a.date||a.published_at||0)||0;if(!current[day]||when>=current[day].when)current[day]={...status,when};S.practice.set(key,current);
  }
}
function normalizeApiDS(raw){
  if(!raw?.name)return null;return{name:raw.name,team:String(raw.team||raw.team_abbr||'').toUpperCase(),position:normalizePosition(raw.position||raw.pos),tier:raw.tier||'',rank:num(raw.rank),games:raw.games||'',adp:raw.adp||'',bye:raw.bye||'',sos:raw.sos||'',injury_risk:num(raw.injury_risk),floor:raw.floor_projection||raw.floor||'',consensus:raw.consensus||raw.cons_projection||'',ds_projection:raw.ds_projection||raw.projection||'',ceiling:raw.ceiling_projection||raw.ceiling||'',value3d:raw.value_3d||raw.three_d_value||'',source:'api'}
}
async function loadParse(){
  if(!E.key.value.trim())return toast('Enter a Parse API key first. Static import does not need one.');setHealth('ds','busy','API');$('#loadDSBtn').disabled=true;
  try{
    const [rankings,news]=await Promise.allSettled([parseFetch('get_rankings',{depth:'rankings',scoring:E.score.value,position:'',is_dynasty:'false',league_type:E.league.value}),parseFetch('get_news_articles')]);
    if(rankings.status!=='fulfilled')throw rankings.reason;
    const raw=rankings.value?.data?.players||rankings.value?.players||[],rows=raw.map(normalizeApiDS).filter(Boolean);saveSnapshot(rows,'parse-api');
    if(news.status==='fulfilled')indexPractice(articleList(news.value));
    setHealth('ds','ok',`${rows.length} API`);toast(`DraftSharks API loaded ${rows.length} rankings${S.practice.size?` + ${S.practice.size} practice players`:''}.`);render();
  }catch(e){setHealth('ds','bad','failed');toast('DraftSharks API failed: '+e.message)}finally{$('#loadDSBtn').disabled=false}
}

function groupMatches(p){return S.group==='all'||(S.group==='fantasy'?FP.has(p.position):p.group===S.group)}
function filteredRows(){
  const q=norm(E.search.value),hf=E.health.value,pos=E.pos.value;
  const rows=S.players.map(mergedRow).filter(p=>{
    if(q&&!norm(`${p.name} ${p.teamName} ${p.teamAbbr} ${p.position}`).includes(q))return false;
    if(S.team&&p.teamAbbr!==S.team)return false;if(pos&&p.position!==pos)return false;if(!groupMatches(p))return false;
    const pr=p.practice||{};
    if(hf==='injured'&&!p.injury)return false;if(hf==='healthy'&&p.injury)return false;
    if(hf==='practice'&&!['wed','thu','fri'].some(d=>pr[d]))return false;
    if(hf==='dnp'&&!['wed','thu','fri'].some(d=>pr[d]?.code==='DNP'))return false;
    if(hf==='limited'&&!['wed','thu','fri'].some(d=>pr[d]?.code==='LIMITED'))return false;
    if(hf==='highrisk'&&!(p.risk>=50))return false;return true;
  });
  const {k,d}=S.sort;return rows.sort((a,b)=>{
    let A=a[k],B=b[k];if(['risk','rank'].includes(k)){A=A??999999;B=B??999999;return(A-B)*d}return String(A??'').localeCompare(String(B??''),undefined,{numeric:true})*d;
  });
}
function render(){
  const rows=filteredRows();$('#countPlayers').textContent=rows.length;$('#countTeams').textContent=S.teams.length;$('#countInjured').textContent=S.players.filter(p=>p.injury).length;
  $('#countPractice').textContent=S.players.filter(p=>{const x=practiceFor(p);return['wed','thu','fri'].some(d=>['DNP','LIMITED'].includes(x[d]?.code))}).length;
  $('#countDS').textContent=S.players.filter(p=>dsFor(p)).length;$('#lastUpdated').textContent=S.updated?`ESPN ${S.updated.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:'—';
  document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('on',b.dataset.group===S.group));
  if(!rows.length){E.rows.innerHTML='';E.empty.style.display='block';E.empty.textContent=S.players.length?'No players match the current filters.':'No ESPN data loaded.';return}
  E.empty.style.display='none';E.rows.innerHTML=rows.map(p=>{
    const d=p.ds||{},pr=p.practice||{},health=p.injury?.status||'Active';
    return`<tr class="clickable" data-id="${p.id}">
      <td><div class="player"><img class="headshot" src="${p.headshot}" onerror="this.style.opacity=.18"><div><div class="pname">${esc(p.name)}</div><div class="meta">${FP.has(p.position)?`${YEAR} ESPN ${p.actual.fantasy.toFixed(1)} FP`:esc(p.source)}</div></div></div></td>
      <td><div class="teamcell"><img class="logo" src="${p.teamLogo}"><span>${p.teamAbbr}</span></div></td><td><span class="badge blue">${p.position}</span></td>
      <td><span class="badge ${p.injury?healthClass(health):'green'}">${esc(health)}</span></td><td>${practiceBadge(pr.wed)}</td><td>${practiceBadge(pr.thu)}</td><td>${practiceBadge(pr.fri)}</td>
      <td>${d.rank!=null?`<b>#${d.rank}</b>`:'—'}</td><td>${esc(d.tier||'—')}</td>
      <td>${p.risk==null?'—':`<b>${p.risk}%</b><div class="riskbar"><div class="riskfill" style="width:${Math.min(100,p.risk)}%"></div></div>`}</td>
      <td>${esc(d.adp||'—')}</td><td>${esc(d.bye||'—')}</td><td>${esc(d.sos||'—')}</td><td>${esc(d.floor||'—')}</td><td>${esc(d.consensus||'—')}</td><td>${esc(d.ds_projection||'—')}</td><td>${esc(d.ceiling||'—')}</td><td>${esc(d.value3d||'—')}</td><td>${esc(d.games||'—')}</td>
    </tr>`;
  }).join('');
  E.rows.querySelectorAll('tr').forEach(tr=>tr.onclick=()=>openPlayer(tr.dataset.id));
}
function practiceGrid(pr){return`<div class="practice-grid">${[['WED','wed'],['THU','thu'],['FRI','fri']].map(([l,k])=>`<div class="practice-day"><small>${l}</small>${practiceBadge(pr[k])}</div>`).join('')}</div><div class="source-note">Practice values appear when optional DraftSharks news data has been loaded.</div>`}
function openPlayer(id){
  const p=S.players.map(mergedRow).find(x=>x.id===id);if(!p)return;$('#drawerBackdrop').classList.add('open');const d=p.ds||{};
  $('#drawerBody').innerHTML=`<div class="hero"><img class="headshot" src="${p.headshot}"><div><h2>${esc(p.name)}</h2><div class="teamcell"><img class="logo" src="${p.teamLogo}"><b>${esc(p.teamName)}</b> · ${p.position}</div><div class="meta">ESPN ID ${p.id} · ${p.source}</div></div></div>
  <div class="cards"><div class="card"><h3>Health</h3><div class="kv"><div>ESPN status</div><div><span class="badge ${p.injury?healthClass(p.injury.status):'green'}">${esc(p.injury?.status||'Active')}</span></div><div>DS injury risk</div><div><span class="badge ${riskClass(p.risk)}">${p.risk==null?'—':p.risk+'%'}</span></div><div>Position group</div><div>${p.group}</div></div></div><div class="card"><h3>WED / THU / FRI</h3>${practiceGrid(p.practice||{})}</div></div>
  <div class="card"><h3>DraftSharks imported snapshot</h3><div class="kv"><div>Tier</div><div>${esc(d.tier||'—')}</div><div>Rank</div><div>${d.rank!=null?'#'+d.rank:'—'}</div><div>ADP</div><div>${esc(d.adp||'—')}</div><div>Bye</div><div>${esc(d.bye||'—')}</div><div>SOS</div><div>${esc(d.sos||'—')}</div><div>Floor / Consensus</div><div>${esc(d.floor||'—')} / ${esc(d.consensus||'—')}</div><div>DS / Ceiling</div><div>${esc(d.ds_projection||'—')} / ${esc(d.ceiling||'—')}</div><div>3D Value</div><div>${esc(d.value3d||'—')}</div></div></div>`;
}

function resetFilters(){E.search.value='';E.pos.value='';E.health.value='';S.team='';S.group='all';renderTeamMenu();render()}
function openImport(){E.importPreview.textContent='Expected 15-column DraftSharks TSV/CSV. Your copied console output can be pasted directly.';$('#importModal').classList.add('open');setTimeout(()=>E.importText.focus(),50)}
async function copyExporter(){
  try{await navigator.clipboard.writeText(EXPORTER);toast('DraftSharks console exporter copied. Open DraftSharks → DevTools Console → paste → Enter.')}catch{prompt('Copy this DraftSharks console exporter:',EXPORTER)}
}
async function pasteClipboard(){try{E.importText.value=await navigator.clipboard.readText();E.importPreview.textContent=`Clipboard loaded: ${E.importText.value.split(/\r?\n/).length} lines`;toast('Clipboard pasted into importer.')}catch{E.importText.focus();toast('Clipboard access was blocked. Press ⌘V / Ctrl+V in the text box.')}}

E.search.oninput=render;E.pos.onchange=render;E.health.onchange=render;
$('#quickbar').onclick=e=>{const b=e.target.closest('[data-group]');if(b){S.group=b.dataset.group;render()}};
E.teamBtn.onclick=()=>E.picker.classList.toggle('open');document.addEventListener('click',e=>{if(!E.picker.contains(e.target))E.picker.classList.remove('open')});
document.querySelectorAll('th.sort').forEach(th=>th.onclick=()=>{const k=th.dataset.sort;if(S.sort.k===k)S.sort.d*=-1;else S.sort={k,d:1};render()});
$('#refreshBtn').onclick=loadESPN;$('#resetBtn').onclick=resetFilters;
$('#openDSBtn').onclick=$('#modalOpenDSBtn').onclick=()=>window.open(DS_URL,'_blank','noopener');
$('#copyExporterBtn').onclick=$('#modalCopyExporterBtn').onclick=copyExporter;
$('#pasteImportBtn').onclick=openImport;$('#closeImportBtn').onclick=()=>$('#importModal').classList.remove('open');
$('#importModal').onclick=e=>{if(e.target.id==='importModal')e.currentTarget.classList.remove('open')};
$('#readClipboardBtn').onclick=pasteClipboard;$('#importTextBtn').onclick=()=>{try{importText(E.importText.value,'paste')}catch(e){toast(e.message)}};
$('#importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{importText(await f.text(),f.name)}catch(err){toast(err.message)}finally{e.target.value=''}};
$('#clearImportBtn').onclick=clearSnapshot;
$('#loadDSBtn').onclick=loadParse;
$('#testBtn').onclick=async()=>{try{setHealth('espn','busy','testing');const a=await getActiveFantasy();setHealth('espn','ok',`${a.length} active`)}catch{setHealth('espn','bad','error')}if(E.key.value.trim())try{setHealth('ds','busy','testing');await parseFetch('get_news_articles');setHealth('ds','ok','API online')}catch{setHealth('ds','bad','API error')}};
$('#closeDrawer').onclick=()=>$('#drawerBackdrop').classList.remove('open');$('#drawerBackdrop').onclick=e=>{if(e.target.id==='drawerBackdrop')e.currentTarget.classList.remove('open')};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#drawerBackdrop').classList.remove('open');$('#importModal').classList.remove('open')}});
E.key.value=sessionStorage.getItem('ds_api_key')||'';E.key.onchange=()=>E.key.value.trim()?sessionStorage.setItem('ds_api_key',E.key.value.trim()):sessionStorage.removeItem('ds_api_key');

loadSnapshot();renderTeamMenu();loadESPN();
})();
