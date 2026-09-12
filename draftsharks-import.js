(()=>{
'use strict';

const ESPN='https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/players?scoringPeriodId=0&view=players_wl';
const HEADERS=['Tier','Rank','Player','Team','Pos','Games','ADP','Bye','SOS','Injury Risk','Floor Proj','Cons Proj','DS Proj','Ceil Proj','3D Value'];
const TEAM_ID={1:'ATL',2:'BUF',3:'CHI',4:'CIN',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GB',10:'TEN',11:'IND',12:'KC',13:'LV',14:'LAR',15:'MIA',16:'MIN',17:'NE',18:'NO',19:'NYG',20:'NYJ',21:'PHI',22:'ARI',23:'PIT',24:'LAC',25:'SF',26:'SEA',27:'TB',28:'WSH',29:'CAR',30:'JAX',33:'BAL',34:'HOU'};
const POS_ID={1:'QB',2:'RB',3:'WR',4:'TE',5:'K',7:'P',9:'DT',10:'DE',11:'LB',12:'CB',13:'S'};
const TEAM_ALIAS={LVR:'LV',OAK:'LV',LAS:'LV',WAS:'WSH',WFT:'WSH',JAC:'JAX',SD:'LAC',SDG:'LAC',STL:'LAR'};
const HEADER_ALIAS={
  tier:'Tier',rank:'Rank',player:'Player',name:'Player',team:'Team',pos:'Pos',position:'Pos',games:'Games',gp:'Games',adp:'ADP',bye:'Bye',sos:'SOS',injuryrisk:'Injury Risk',risk:'Injury Risk',floorproj:'Floor Proj',floor:'Floor Proj',consproj:'Cons Proj',consensus:'Cons Proj',consensusproj:'Cons Proj',dsproj:'DS Proj',dsprojection:'DS Proj',ceilproj:'Ceil Proj',ceiling:'Ceil Proj',ceilingproj:'Ceil Proj','3dvalue':'3D Value',value3d:'3D Value'
};
let espnCache=null;

const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const clean=s=>String(s??'').trim().replace(/^\*+|\*+$/g,'').replace(/^`+|`+$/g,'').trim();
const hkey=s=>norm(clean(s));
const team=s=>{const x=clean(s).toUpperCase();return TEAM_ALIAS[x]||x};
const pos=s=>clean(s).toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/\d+$/,'');
const toast=m=>{const t=document.querySelector('#toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),4200)};

function parseMarkdown(text){
  const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length<2||!lines[0].includes('|'))return null;
  const split=line=>{
    let s=line.trim();if(s.startsWith('|'))s=s.slice(1);if(s.endsWith('|'))s=s.slice(0,-1);
    return s.split('|').map(clean);
  };
  const first=split(lines[0]);
  if(first.length<3)return null;
  const mapped=first.map(x=>HEADER_ALIAS[hkey(x)]||x);
  if(!mapped.some(x=>x==='Player'))return null;
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const cells=split(lines[i]);
    if(cells.every(c=>/^:?-{2,}:?$/.test(c.replace(/\s/g,''))))continue;
    if(cells.length<3)continue;
    const obj={};mapped.forEach((h,j)=>obj[h]=clean(cells[j]??''));rows.push(obj);
  }
  return rows;
}

function parseDelimited(text){
  text=String(text||'').replace(/^\uFEFF/,'').trim();if(!text)return[];
  const first=text.split(/\r?\n/)[0]||'';
  const delimiter=(first.match(/\t/g)||[]).length>(first.match(/,/g)||[]).length?'\t':',';
  const raw=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
    }else if(ch===delimiter&&!quoted){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>String(v).trim()))raw.push(row);row=[];cell=''}
    else cell+=ch;
  }
  row.push(cell);if(row.some(v=>String(v).trim()))raw.push(row);
  if(raw.length<2)return[];
  const headers=raw.shift().map(x=>HEADER_ALIAS[hkey(x)]||clean(x));
  return raw.map(values=>Object.fromEntries(headers.map((h,i)=>[h,clean(values[i]??'')])));
}

function parseAny(text){
  const md=parseMarkdown(text);if(md?.length)return{format:'Markdown table',rows:md};
  const rows=parseDelimited(text);if(rows.length){const first=String(text).split(/\r?\n/)[0]||'';return{format:first.includes('\t')?'TSV':'CSV',rows};}
  return{format:'unknown',rows:[]};
}

function normalizeRows(rows){
  return rows.map(r=>{
    const out={};
    for(const h of HEADERS){
      let val=r[h];
      if(val===undefined){const hit=Object.keys(r).find(k=>(HEADER_ALIAS[hkey(k)]||k)===h);val=hit?r[hit]:'';}
      out[h]=clean(val);
    }
    out.Team=team(out.Team);
    out.Pos=pos(out.Pos);
    return out;
  }).filter(r=>r.Player && (/^\d+$/.test(r.Rank)||r.Rank===''));
}

function lastPart(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(parts.length<2)return'';
  return norm(parts.slice(1).join(' '));
}
function initial(name){return norm(String(name||'').trim().split(/\s+/)[0]||'')[0]||''}

async function loadESPN(){
  if(espnCache)return espnCache;
  try{
    const r=await fetch(ESPN,{headers:{'x-fantasy-filter':JSON.stringify({filterActive:{value:true}}),accept:'application/json'},cache:'no-store'});
    if(!r.ok)throw new Error(`ESPN ${r.status}`);
    const data=await r.json(),raw=Array.isArray(data)?data:(data.players||[]);
    espnCache=raw.map(e=>{
      const p=e?.player||e?.playerPoolEntry?.player||e||{};
      const full=p.fullName||p.displayName||[p.firstName,p.lastName].filter(Boolean).join(' ');
      const t=TEAM_ID[Number(p.proTeamId)]||'';
      const po=POS_ID[Number(p.defaultPositionId)]||'';
      return{full,first:p.firstName||String(full).split(/\s+/)[0]||'',last:p.lastName||String(full).split(/\s+/).slice(1).join(' '),team:t,pos:po};
    }).filter(x=>x.full);
    return espnCache;
  }catch(e){console.warn('DraftSharks import ESPN matching unavailable',e);return[]}
}

function choosePlayer(row,players){
  const n=norm(row.Player),t=team(row.Team),p=pos(row.Pos),ini=initial(row.Player),suffix=lastPart(row.Player);
  const exact=players.filter(x=>norm(x.full)===n);
  if(exact.length===1)return exact[0];
  const scored=[];
  for(const x of players){
    let score=0;
    const xn=norm(x.full),xl=norm(x.last);
    if(n&&xn===n)score+=200;
    if(t&&x.team===t)score+=55; else if(t&&x.team&&x.team!==t)score-=45;
    if(p&&x.pos===p)score+=35; else if(p&&x.pos&&x.pos!==p)score-=20;
    if(ini&&initial(x.first)===ini)score+=25;
    if(suffix&&xl===suffix)score+=85;
    else if(suffix&&xn.endsWith(suffix))score+=55;
    else if(suffix&&xn.includes(suffix))score+=20;
    scored.push({x,score});
  }
  scored.sort((a,b)=>b.score-a.score);
  const best=scored[0],next=scored[1];
  if(!best||best.score<120)return null;
  if(next&&best.score-next.score<15)return null;
  return best.x;
}

async function canonicalize(rows){
  const players=await loadESPN();
  let matched=0;
  const unmatched=[];
  for(const row of rows){
    if(row.Pos==='DEF'){unmatched.push(`${row.Player} (DEF)`);continue;}
    const hit=choosePlayer(row,players);
    if(hit){row.Player=hit.full;row.Team=hit.team||row.Team;row.Pos=hit.pos||row.Pos;matched++;}
    else unmatched.push(`${row.Player} ${row.Team} ${row.Pos}`.trim());
  }
  return{rows,matched,unmatched,total:rows.length};
}

function toTSV(rows){
  const safe=v=>String(v??'').replace(/[\t\r\n]+/g,' ').trim();
  return [HEADERS,...rows.map(r=>HEADERS.map(h=>safe(r[h])))].map(r=>r.join('\t')).join('\n');
}

async function prepare(text,label='paste'){
  const parsed=parseAny(text),rows=normalizeRows(parsed.rows);
  if(!rows.length)throw new Error('No DraftSharks rows found. Paste/upload CSV, TSV, or the DraftSharks Markdown table.');
  const result=await canonicalize(rows);
  return{...result,format:parsed.format,label,tsv:toTSV(result.rows)};
}

function status(result){
  const preview=document.querySelector('#importPreview');
  if(preview){
    const defs=result.rows.filter(r=>r.Pos==='DEF').length;
    const extra=result.unmatched.length?` · ${result.unmatched.length} unmatched${defs?` (${defs} DEF)`:''}`:'';
    preview.textContent=`${result.format}: ${result.total} rows · ${result.matched} ESPN player names matched${extra}`;
  }
}

async function importPrepared(text,label){
  const result=await prepare(text,label);status(result);
  const box=document.querySelector('#importText');
  if(box)box.value=result.tsv;
  const button=document.querySelector('#importTextBtn');
  if(typeof button?.onclick==='function')button.onclick();
  toast(`Imported ${result.total} DraftSharks rows · ${result.matched} ESPN names matched.`);
}

// Intercept the existing importer before its original onclick/onchange handlers.
document.addEventListener('click',async e=>{
  const button=e.target.closest('#importTextBtn');
  if(!button)return;
  e.preventDefault();e.stopImmediatePropagation();
  try{
    button.disabled=true;
    const text=document.querySelector('#importText')?.value||'';
    const result=await prepare(text,'paste');status(result);
    document.querySelector('#importText').value=result.tsv;
    if(typeof button.onclick==='function')button.onclick();
    toast(`Imported ${result.total} rows · ${result.matched} matched to ESPN.`);
  }catch(err){toast(err.message)}finally{button.disabled=false}
},true);

document.addEventListener('change',async e=>{
  if(e.target?.id!=='importFile')return;
  e.preventDefault();e.stopImmediatePropagation();
  const input=e.target,file=input.files?.[0];if(!file)return;
  try{await importPrepared(await file.text(),file.name)}catch(err){toast(err.message)}finally{input.value=''}
},true);

// Live preview when users paste/type Markdown/CSV/TSV.
const box=document.querySelector('#importText');
if(box){
  let timer;
  box.addEventListener('input',()=>{
    clearTimeout(timer);timer=setTimeout(()=>{
      try{const p=parseAny(box.value),rows=normalizeRows(p.rows);const preview=document.querySelector('#importPreview');if(preview&&rows.length)preview.textContent=`Detected ${p.format} · ${rows.length} DraftSharks rows ready to import`;}
      catch{}
    },120);
  });
}
})();
