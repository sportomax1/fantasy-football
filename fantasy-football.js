/* Fantasy Lens v32 — special-team draft toggles, weekly position ranks, multi-source ADP. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@10ff50179a1b34feb8686ab490df614a0fa6c11f/fantasy-football.js"><\/script>');

(function(){
  const DEF_KEY='fantasyLensDraftedDefenses';
  const K_KEY='fantasyLensDraftedKickers';
  const ADP_KEY='fantasyLensAdpSourcesV1';
  const weeklyRankCache=new Map();

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const readSet=key=>{try{return new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{return new Set()}};
  const saveSet=(key,set)=>localStorage.setItem(key,JSON.stringify([...set]));
  const teamCode=v=>{const t=String(v||'').toUpperCase().trim();return t==='WSH'?'WAS':t==='LA'?'LAR':t};
  const readAdp=()=>{try{return JSON.parse(localStorage.getItem(ADP_KEY)||'{}')||{}}catch{return{}}};
  const saveAdp=x=>localStorage.setItem(ADP_KEY,JSON.stringify(x));

  function addV32Styles(){
    if(document.querySelector('#fantasyLensV32Styles'))return;
    const s=document.createElement('style');s.id='fantasyLensV32Styles';s.textContent=`
      .specialDraftedRow{opacity:1!important}.specialDraftedRow td:not(:first-child){opacity:.42}
      .specialDraftToggle{margin-left:8px!important;padding:4px 7px!important;font-size:8px!important;line-height:1!important;vertical-align:middle}
      .specialDraftToggle.on{background:#7e8992!important;color:#fff!important;border-color:#7e8992!important}
      .specialDraftTag{margin-left:5px!important}
      .weeklyPosRank{font-weight:900}.weeklyPosRank small{display:block;color:var(--muted);font-size:8px;margin-top:2px;white-space:nowrap}
      .adpBadges{display:block;margin-top:3px;color:var(--muted);font-size:8px;line-height:1.25;white-space:normal}
      .adpBadges b{color:var(--ink)}
      #adpImportModal .modalbox{width:min(980px,94vw);max-width:980px}
      .adpTop{display:grid;grid-template-columns:minmax(130px,220px) 1fr;gap:8px;margin-bottom:8px}
      .adpImportText{width:100%;min-height:170px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px}
      .adpActions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:8px 0}
      .adpSourceChips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
      .adpSourceChip{display:inline-flex;gap:5px;align-items:center;padding:4px 7px;border:1px solid rgba(30,50,65,.15);border-radius:999px;background:#eef1ee;font-size:9px}
      .adpCompareWrap{overflow:auto;max-height:42vh;border:1px solid rgba(30,50,65,.12);border-radius:9px;margin-top:8px}
      .adpCompare{width:100%;border-collapse:collapse;font-size:9px}.adpCompare th,.adpCompare td{padding:6px;border-bottom:1px solid rgba(30,50,65,.08);text-align:center;white-space:nowrap}.adpCompare th{position:sticky;top:0;background:#e9eeeb;z-index:2}.adpCompare th:first-child,.adpCompare td:first-child{text-align:left;position:sticky;left:0;background:#f8f7f1;z-index:1;min-width:190px}.adpCompare th:first-child{z-index:3;background:#e9eeeb}
    `;document.head.appendChild(s);
  }

  function toggleSpecial(kind,key){
    const storage=kind==='DEF'?DEF_KEY:K_KEY,set=readSet(storage);
    if(set.has(key))set.delete(key);else set.add(key);
    saveSet(storage,set);decorateSpecialToggles();
  }

  function decorateSpecialToggles(){
    const defs=readSet(DEF_KEY),ks=readSet(K_KEY);
    document.querySelectorAll('#defenseHistoryTable tbody tr').forEach(tr=>{
      tr.querySelectorAll('.specialDraftToggle,.specialDraftTag').forEach(x=>x.remove());
      const team=teamCode(tr.querySelector('.defTeam>span')?.textContent||'');if(!team)return;
      const on=defs.has(team),cell=tr.querySelector('.defTeam');tr.classList.toggle('specialDraftedRow',on);
      if(!cell)return;
      const b=document.createElement('button');b.className='btn specialDraftToggle'+(on?' on':'');b.type='button';b.textContent=on?'Drafted':'Draft';b.onclick=e=>{e.stopPropagation();toggleSpecial('DEF',team)};cell.appendChild(b);
      if(on){const tag=document.createElement('span');tag.className='specialDraftTag';tag.textContent='DRAFTED';cell.appendChild(tag)}
    });
    document.querySelectorAll('#kickerTable tbody tr').forEach(tr=>{
      tr.querySelectorAll('.specialDraftToggle,.specialDraftTag').forEach(x=>x.remove());
      const nameText=tr.querySelector('.kickerPrimary small')?.textContent||'',key=norm(nameText);if(!key||key.includes('no 2026 kicker projection'))return;
      const on=ks.has(key),cell=tr.querySelector('.kickerPrimary');tr.classList.toggle('specialDraftedRow',on);
      if(!cell)return;
      const b=document.createElement('button');b.className='btn specialDraftToggle'+(on?' on':'');b.type='button';b.textContent=on?'Drafted':'Draft';b.onclick=e=>{e.stopPropagation();toggleSpecial('K',key)};cell.appendChild(b);
      if(on){const tag=document.createElement('span');tag.className='specialDraftTag';tag.textContent='DRAFTED';cell.appendChild(tag)}
    });
  }

  function wireSpecialViews(){
    for(const id of ['defenseBtn','kickerBtn']){
      const b=document.querySelector('#'+id);if(!b||b.dataset.v32Wrapped==='1')continue;
      const old=b.onclick;b.dataset.v32Wrapped='1';b.onclick=function(e){
        const out=old?.call(this,e);
        Promise.resolve(out).finally(()=>setTimeout(decorateSpecialToggles,0));
        return out;
      };
    }
  }

  function sleeperCustomFP(row){
    const x=row?.stats||row||{},s=typeof scoring==='function'?scoring():{rec:.5,passTD:4,passYds:25,int:-2,td:6,yds:10,fum:-2};
    const passY=Number(x.pass_yd||0),passTD=Number(x.pass_td||0),ints=Number(x.pass_int||0),rushY=Number(x.rush_yd||0),rushTD=Number(x.rush_td||0),rec=Number(x.rec||0),recY=Number(x.rec_yd||0),recTD=Number(x.rec_td||0),fum=Number(x.fum_lost||0);
    return passY/Math.max(1,s.passYds)+passTD*s.passTD+ints*s.int+(rushY+recY)/Math.max(1,s.yds)+(rushTD+recTD)*s.td+rec*s.rec+fum*s.fum;
  }
  function sleeperHasActivity(row){const x=row?.stats||row||{};return ['pass_att','pass_cmp','pass_yd','pass_td','pass_int','rush_att','rush_yd','rush_td','rec','rec_tgt','rec_yd','rec_td','fum_lost'].some(k=>Math.abs(Number(x[k]||0))>0)}
  function scoreSignature(){try{return btoa(JSON.stringify(scoring())).replace(/=+$/,'').slice(-24)}catch{return'half'}}

  async function weeklyPositionRank(year,week,pos,playerFP){
    const key=`${year}|${week}|${pos}|${scoreSignature()}`;let scores=weeklyRankCache.get(key);
    if(!scores){
      try{
        const lsKey='fantasyLensWeekRankV1:'+key,hit=JSON.parse(localStorage.getItem(lsKey)||'null');
        if(hit&&Date.now()-hit.ts<30*24*60*60*1000)scores=hit.scores;
        if(!scores){
          const r=await fetch(`https://api.sleeper.com/stats/nfl/${year}/${week}?season_type=regular&position[]=${encodeURIComponent(pos)}&order_by=pts_half_ppr`);if(!r.ok)throw Error('Sleeper '+r.status);
          const rows=await r.json();scores=(Array.isArray(rows)?rows:[]).filter(sleeperHasActivity).map(sleeperCustomFP).filter(Number.isFinite).sort((a,b)=>b-a);
          try{localStorage.setItem(lsKey,JSON.stringify({ts:Date.now(),scores}))}catch{}
        }
        weeklyRankCache.set(key,scores);
      }catch(e){console.warn('weekly position rank failed',year,week,pos,e);return null}
    }
    if(!scores?.length)return null;const rank=1+scores.filter(v=>v>Number(playerFP)+0.005).length;return{rank,total:scores.length};
  }

  async function seasonLogV32(id,year,name){
    const title=document.querySelector('#careerTitle'),status=document.querySelector('#careerStatus'),grid=document.querySelector('#careerGrid');if(!title||!status||!grid)return;
    title.textContent=`${name} — ${year} Game Log`;status.textContent='Loading weekly game log…';grid.innerHTML='';
    const base=(typeof players!=='undefined'?players:[]).find(p=>String(p.id)===String(id)),pos=base?.pos||'';
    const filter={players:{filterIds:{value:[Number(id)]},limit:1,sortPercOwned:{sortPriority:1,sortAsc:false},filterStatsForTopScoringPeriodIds:{value:18,additionalValue:[`00${year}`]}}};
    try{
      const data=await fetchJson(`${API}/seasons/${year}/segments/0/leaguedefaults/3?scoringPeriodId=0&view=kona_playercard`,filter),e=(data.players||[])[0],p=e?.player||e,weekly=(p?.stats||[]).filter(s=>num(s.seasonId)===year&&num(s.statSourceId)===0&&num(s.statSplitTypeId)===1).sort((a,b)=>a.scoringPeriodId-b.scoringPeriodId);
      const rows=weekly.map(s=>{const x=s.stats||{},r={passYds:num(x['3']),passTD:num(x['4']),ints:num(x['20']),rushYds:num(x['24']),rushTD:num(x['25']),rec:num(x['41']??x['53']),recYds:num(x['42']),recTD:num(x['43']),lostFum:num(x['72'])};r.totalYds=r.passYds+r.rushYds+r.recYds;r.totalTD=r.passTD+r.rushTD+r.recTD;r.turnovers=r.ints+r.lostFum;r.fantasy=fantasy(r);return{...r,week:s.scoringPeriodId}}).filter(r=>r.totalYds||r.totalTD||r.turnovers||r.rec);
      status.textContent=`${rows.length} games with logged offensive activity${pos?' • calculating weekly '+pos+' finish…':''}`;
      grid.innerHTML=`<table><thead><tr><th>WEEK</th><th>${pos||'POS'} RANK</th><th>YDS</th><th>TD</th><th>TO</th><th>FP</th><th>REC</th><th>PASS YDS</th><th>RUSH YDS</th><th>REC YDS</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${r.week}</b></td><td class="weeklyPosRank" data-week-rank="${r.week}">${pos?'…':'—'}</td><td>${fmt(r.totalYds)}</td><td>${r.totalTD}</td><td>${r.turnovers}</td><td><b>${r.fantasy.toFixed(1)}</b></td><td>${r.rec}</td><td>${r.passYds}</td><td>${r.rushYds}</td><td>${r.recYds}</td></tr>`).join('')}</tbody></table><button class="btn" style="margin-top:10px" onclick="career('${id}')">← Back to Career</button>`;
      if(pos){
        await Promise.allSettled(rows.map(async r=>{const q=await weeklyPositionRank(year,r.week,pos,r.fantasy),cell=grid.querySelector(`[data-week-rank="${r.week}"]`);if(cell)cell.innerHTML=q?`#${q.rank}<small>of ${q.total} ${pos}s</small>`:'—'}));
        status.textContent=`${rows.length} games • weekly ${pos} rank compares custom-scoring fantasy points with other ${pos}s who logged activity that week.`;
      }
    }catch(e){status.textContent='Game log failed: '+e.message}
  }

  function ensureAdpUI(){
    let btn=document.querySelector('#importAdpBtn');
    if(!btn){btn=document.createElement('button');btn.className='btn';btn.id='importAdpBtn';btn.textContent='Import ADP';const anchor=document.querySelector('#importDraftBtn');anchor?.insertAdjacentElement('afterend',btn)}
    let modal=document.querySelector('#adpImportModal');
    if(!modal){
      modal=document.createElement('div');modal.className='modal';modal.id='adpImportModal';modal.innerHTML=`<div class="modalbox"><div class="modalhead"><div><h2>Import ADP</h2><small style="color:#aebdca">Store multiple sources and compare site-to-site draft cost</small></div><button class="btn close" id="closeAdpImport">×</button></div><div class="careerbody"><div class="adpTop"><input class="field" id="adpSourceName" placeholder="Source name — Yahoo, ESPN, Sleeper, FantasyPros…"><div class="webHint">Paste one source at a time. The parser finds the player name plus the first plausible rank/ADP number on each line.</div></div><textarea class="field adpImportText" id="adpImportText" placeholder="Example:\n1. Ja'Marr Chase CIN WR\n2. Bijan Robinson ATL RB\n3. Jahmyr Gibbs DET RB"></textarea><div class="adpActions"><button class="btn run" id="saveAdpSource">Import / Replace Source</button><button class="btn" id="clearAdpSource">Clear Named Source</button><button class="btn" id="clearAllAdp">Clear All ADP</button></div><div class="draftImportStatus" id="adpImportStatus">No ADP import run yet.</div><div id="adpSourceSummary"></div></div></div>`;document.body.appendChild(modal);
    }
    btn.onclick=()=>{renderAdpSummary();modal.classList.add('open');setTimeout(()=>document.querySelector('#adpSourceName')?.focus(),30)};
    document.querySelector('#closeAdpImport').onclick=()=>modal.classList.remove('open');modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};
    document.querySelector('#saveAdpSource').onclick=importAdpSource;
    document.querySelector('#clearAdpSource').onclick=clearNamedAdp;
    document.querySelector('#clearAllAdp').onclick=()=>{if(confirm('Clear all imported ADP sources?')){saveAdp({});renderAdpSummary();decorateAdpBadges();document.querySelector('#adpImportStatus').textContent='All ADP sources cleared.'}};
  }

  function parseAdpLines(text){
    const roster=(typeof players!=='undefined'?players:[]).map(p=>({p,tokens:norm(p.name).split(' ').filter(Boolean)})).sort((a,b)=>b.tokens.length-a.tokens.length),matched=new Map(),unmatched=[];
    for(const raw of String(text||'').split(/\r?\n/)){
      const line=raw.trim();if(!line)continue;const nums=(line.match(/\b\d+(?:\.\d+)?\b/g)||[]).map(Number).filter(n=>n>=1&&n<=500);if(!nums.length){unmatched.push(line);continue}
      const tokens=new Set(norm(line).split(' ').filter(Boolean)),hit=roster.find(x=>x.tokens.length>=2&&x.tokens.every(t=>tokens.has(t)));
      if(!hit){unmatched.push(line);continue}matched.set(String(hit.p.id),nums[0]);
    }
    return{ranks:Object.fromEntries(matched),unmatched};
  }

  async function importAdpSource(){
    const sourceBox=document.querySelector('#adpSourceName'),textBox=document.querySelector('#adpImportText'),status=document.querySelector('#adpImportStatus');let source=sourceBox.value.trim();
    if(!source){status.textContent='Enter a source name first (for example Yahoo or ESPN).';return}if(!textBox.value.trim()){status.textContent='Paste an ADP/rank list first.';return}
    if(typeof players!=='undefined'&&!players.length){status.textContent='Loading player database before matching ADP…';document.querySelector('#run')?.click();for(let i=0;i<60&&!players.length;i++)await new Promise(r=>setTimeout(r,500));if(!players.length){status.textContent='Could not load player database. Tap LOAD DATA and retry.';return}}
    const res=parseAdpLines(textBox.value),all=readAdp(),existing=Object.keys(all).find(k=>k.toLowerCase()===source.toLowerCase());if(existing&&existing!==source)delete all[existing];all[source]={ts:Date.now(),ranks:res.ranks};saveAdp(all);
    status.textContent=`${source}: matched ${Object.keys(res.ranks).length} players.`+(res.unmatched.length?`\nStill unmatched (${res.unmatched.length}):\n${res.unmatched.slice(0,20).join('\n')}`:'\nNo unexplained lines remain.');
    renderAdpSummary();decorateAdpBadges();
  }

  function clearNamedAdp(){const source=document.querySelector('#adpSourceName').value.trim(),status=document.querySelector('#adpImportStatus');if(!source){status.textContent='Type the source name you want to clear.';return}const all=readAdp(),key=Object.keys(all).find(k=>k.toLowerCase()===source.toLowerCase());if(!key){status.textContent=`No saved ADP source named ${source}.`;return}delete all[key];saveAdp(all);status.textContent=`Cleared ${key}.`;renderAdpSummary();decorateAdpBadges()}

  function playerAdpRows(){
    const sources=readAdp(),names=Object.keys(sources),list=typeof players!=='undefined'?players:[];return list.map(p=>{const vals=names.map(n=>Number(sources[n]?.ranks?.[String(p.id)])).filter(Number.isFinite);if(!vals.length)return null;return{p,vals,avg:vals.reduce((a,b)=>a+b,0)/vals.length,min:Math.min(...vals),max:Math.max(...vals)}}).filter(Boolean).sort((a,b)=>a.avg-b.avg);
  }

  function renderAdpSummary(){
    const root=document.querySelector('#adpSourceSummary');if(!root)return;const sources=readAdp(),names=Object.keys(sources),rows=playerAdpRows();
    if(!names.length){root.innerHTML='<div class="webHint" style="margin-top:10px">No ADP sources saved yet.</div>';return}
    root.innerHTML=`<div class="adpSourceChips">${names.map(n=>`<span class="adpSourceChip"><b>${n}</b> ${Object.keys(sources[n]?.ranks||{}).length} players</span>`).join('')}</div><div class="webHint">Comparison is sorted by average imported ADP. Spread shows disagreement between sources.</div><div class="adpCompareWrap"><table class="adpCompare"><thead><tr><th>PLAYER</th>${names.map(n=>`<th>${n}</th>`).join('')}<th>AVG</th><th>SPREAD</th></tr></thead><tbody>${rows.slice(0,150).map(x=>`<tr><td><b>${x.p.name}</b><small style="display:block;color:var(--muted)">${x.p.pos} · ${x.p.team}</small></td>${names.map(n=>{const v=Number(sources[n]?.ranks?.[String(x.p.id)]);return `<td>${Number.isFinite(v)?v.toFixed(v%1?1:0):'—'}</td>`}).join('')}<td><b>${x.avg.toFixed(1)}</b></td><td>${(x.max-x.min).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function decorateAdpBadges(){
    if(typeof currentView!=='undefined'&&!['draft','overview'].includes(currentView))return;const sources=readAdp(),names=Object.keys(sources);if(!names.length){document.querySelectorAll('.adpBadges').forEach(x=>x.remove());return}
    const byName=new Map((typeof players!=='undefined'?players:[]).map(p=>[norm(p.name),p]));
    document.querySelectorAll('#tablewrap tbody tr').forEach(tr=>{tr.querySelectorAll('.adpBadges').forEach(x=>x.remove());const name=norm(tr.querySelector('.player .name')?.textContent||''),p=byName.get(name);if(!p)return;const vals=names.map(n=>({n,v:Number(sources[n]?.ranks?.[String(p.id)])})).filter(x=>Number.isFinite(x.v));if(!vals.length)return;const avg=vals.reduce((a,b)=>a+b.v,0)/vals.length,spread=Math.max(...vals.map(x=>x.v))-Math.min(...vals.map(x=>x.v)),el=document.createElement('span');el.className='adpBadges';el.innerHTML=`ADP <b>${avg.toFixed(1)}</b>${vals.map(x=>` · ${x.n} ${x.v.toFixed(x.v%1?1:0)}`).join('')}${vals.length>1?` · Δ${spread.toFixed(1)}`:''}`;tr.querySelector('.player>div:last-child')?.appendChild(el)});
  }

  function wrapRenderForAdp(){
    if(typeof render!=='function'||render.__v32Adp)return;const old=render;const wrapped=function(){const out=old.apply(this,arguments);setTimeout(decorateAdpBadges,0);return out};wrapped.__v32Adp=true;render=wrapped;window.render=wrapped;
  }

  function activateV32(){
    addV32Styles();ensureAdpUI();wireSpecialViews();decorateSpecialToggles();wrapRenderForAdp();decorateAdpBadges();
    if(typeof seasonLog==='function'){seasonLog=seasonLogV32;window.seasonLog=seasonLogV32}
  }

  window.addEventListener('load',()=>{setTimeout(activateV32,1500);setTimeout(activateV32,2600)});
})();