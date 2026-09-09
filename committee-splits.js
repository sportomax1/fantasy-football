/* Fantasy Lens v41 — team-by-year RB committee + WR split history matrix. */
(function(){
  'use strict';

  const CURRENT_YEAR=2026;
  const TEAM_ORDER=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
  const TEAM_ALIAS={WSH:'WAS',WFT:'WAS',LA:'LAR',STL:'LAR',OAK:'LV',SD:'LAC',JAC:'JAX'};
  const state={pos:'RB',metric:'opportunity',search:'',sort:'team',history:'all'};

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const teamCode=v=>{const t=String(v||'').toUpperCase().trim();return TEAM_ALIAS[t]||t};
  const teamLogo=t=>`https://a.espncdn.com/i/teamlogos/nfl/500/${teamCode(t)==='WAS'?'wsh':teamCode(t).toLowerCase()}.png`;
  const listPlayers=()=>typeof players!=='undefined'&&Array.isArray(players)?players:[];
  const yearsData=()=>typeof seasonData!=='undefined'&&seasonData?seasonData:{};
  const draftedSet=()=>typeof draftedIds!=='undefined'&&draftedIds?draftedIds:new Set();
  const objectRows=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
  const statsOf=r=>r&&typeof r.stats==='object'?Object.assign({},r,r.stats):r||{};

  function num(r,keys){
    const x=statsOf(r);
    for(const k of keys){const v=Number(x?.[k]);if(Number.isFinite(v))return v}
    return 0;
  }
  function fantasy(r){return num(r,['fantasy','fantasyPoints','fantasy_points','fpts','fp','points','pts'])}
  function targets(r){return num(r,['targets','target','tgt','rec_tgt','receivingTargets','receiving_targets'])}
  function carries(r){return num(r,['rushAtt','rush_att','rushingAttempts','rushing_attempts','carries','rushAttempts','rush_attempts','rushingAtt'])}
  function receptions(r){return num(r,['rec','receptions','receivingReceptions','receiving_receptions'])}
  function playerId(r){return r?.id??r?.player_id??r?.playerId??r?.espnId??r?.player?.player_id??''}
  function playerName(r){return r?.name||r?.full_name||r?.displayName||r?.player_name||r?.player?.full_name||[r?.first_name,r?.last_name].filter(Boolean).join(' ')||'Unknown'}
  function playerPos(r){return String(r?.pos||r?.position||r?.positionAbbr||r?.player?.position||'').toUpperCase()}
  function playerTeam(r){return teamCode(r?.team||r?.teamAbbr||r?.proTeam||r?.proTeamAbbreviation||r?.nflTeam||r?.player?.team||'')}

  function historicalYears(){
    const ys=Object.keys(yearsData()).map(Number).filter(y=>Number.isFinite(y)&&y<CURRENT_YEAR).sort((a,b)=>b-a);
    return ys.length?ys:[2025,2024,2023,2022,2021,2020,2019,2018];
  }
  function visibleYears(){
    const ys=historicalYears();
    return [CURRENT_YEAR,...(state.history==='5'?ys.slice(0,5):ys)];
  }
  function sourceRows(year){
    if(Number(year)===CURRENT_YEAR)return listPlayers();
    return objectRows(yearsData()?.[year]??yearsData()?.[String(year)]);
  }
  function currentPlayerMatch(r){
    const id=String(playerId(r)||'');
    if(id){const byId=listPlayers().find(p=>String(playerId(p))===id);if(byId)return byId}
    const n=norm(playerName(r));if(!n)return null;
    return listPlayers().find(p=>norm(playerName(p))===n)||null;
  }
  function faceUrl(r){
    const raw=String(playerId(r)||'');
    const current=currentPlayerMatch(r),currentId=String(playerId(current)||'');
    const id=currentId||raw;
    if(!id)return'';
    return /^\d+$/.test(id)?`https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(id)}.png`:`https://sleepercdn.com/content/nfl/players/${encodeURIComponent(id)}.jpg`;
  }
  function fallbackFace(r){
    const raw=String(playerId(r)||'');
    if(!raw)return'';
    return /^\d+$/.test(raw)?`https://sleepercdn.com/content/nfl/players/${encodeURIComponent(raw)}.jpg`:`https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(raw)}.png`;
  }

  function rawMetric(r,pos){
    if(state.metric==='fantasy')return fantasy(r);
    if(pos==='RB')return carries(r)+targets(r);
    return targets(r);
  }
  function teamBreakdown(team,year){
    const rows=sourceRows(year);
    const pool=rows.filter(r=>playerPos(r)===state.pos&&playerTeam(r)===team);
    let values=pool.map(r=>Math.max(0,rawMetric(r,state.pos)));
    let metricUsed=state.metric,total=values.reduce((a,b)=>a+b,0);
    if(!total&&state.metric==='opportunity'){
      values=pool.map(r=>Math.max(0,fantasy(r)));
      total=values.reduce((a,b)=>a+b,0);
      metricUsed='fantasy-fallback';
    }
    const entries=pool.map((r,i)=>({r,value:values[i]||0})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value).map(x=>({...x,share:total?x.value/total*100:0,metricUsed}));
    const top=entries[0]?.share||0,top2=top+(entries[1]?.share||0);
    let label='No data';
    if(entries.length){
      if(state.pos==='RB')label=top>=68?'Workhorse':top>=55?'Lead':top2>=82?'1–2 split':'Committee';
      else label=top>=45?'Alpha':top>=34?'Clear WR1':top2>=70?'Top-two':'Spread';
    }
    return{team,year,entries,total,metricUsed,top,top2,label};
  }
  function matrixData(){
    const years=visibleYears();
    const rows=TEAM_ORDER.map(team=>({team,years:Object.fromEntries(years.map(y=>[y,teamBreakdown(team,y)]))}));
    const q=state.search.trim().toLowerCase();
    let filtered=!q?rows:rows.filter(row=>row.team.toLowerCase().includes(q)||years.some(y=>row.years[y].entries.some(e=>playerName(e.r).toLowerCase().includes(q))));
    if(state.sort==='lead')filtered.sort((a,b)=>(b.years[CURRENT_YEAR]?.top||0)-(a.years[CURRENT_YEAR]?.top||0)||a.team.localeCompare(b.team));
    else if(state.sort==='committee')filtered.sort((a,b)=>(a.years[CURRENT_YEAR]?.top||999)-(b.years[CURRENT_YEAR]?.top||999)||a.team.localeCompare(b.team));
    return{years,rows:filtered};
  }

  function installStyles(){
    let old=document.querySelector('#committeeSplitStylesV40');if(old)old.remove();
    if(document.querySelector('#committeeSplitStylesV41'))return;
    const s=document.createElement('style');s.id='committeeSplitStylesV41';s.textContent=`
      #committeeModalV40{z-index:880!important}#committeeModalV40 .modalbox{width:98vw!important;max-width:none!important;max-height:95vh!important;display:flex;flex-direction:column}#committeeModalV40 .careerbody{min-height:0;overflow:hidden!important;padding-top:8px;display:flex;flex-direction:column}
      .splitToolbarV41{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;flex:0 0 auto}.splitToolbarV41 .field{min-height:32px}.splitModeV41.on{background:var(--navy)!important;color:#fff!important}.splitHintV41{font-size:8px;color:var(--muted);margin:0 0 8px;line-height:1.45;flex:0 0 auto}
      .splitMatrixWrapV41{overflow:auto;flex:1;min-height:0;border:1px solid var(--line);border-radius:11px;background:#fff}.splitMatrixV41{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%}.splitMatrixV41 th,.splitMatrixV41 td{border-bottom:1px solid #e7ece8;border-right:1px solid #eef1ef;vertical-align:top}.splitMatrixV41 th{position:sticky;top:0;z-index:8;background:#e9eeeb;padding:8px 9px;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#52616c;text-align:left;min-width:245px}.splitMatrixV41 th:first-child{left:0;z-index:10;min-width:112px;width:112px}.splitMatrixV41 td:first-child{position:sticky;left:0;z-index:6;background:#f9faf8;min-width:112px;width:112px;padding:8px}.splitMatrixV41 tbody tr:hover td{background:#fbfcfb}.splitMatrixV41 tbody tr:hover td:first-child{background:#f0f4f1}
      .splitYearHeadV41{display:flex;align-items:center;justify-content:space-between;gap:8px}.splitYearHeadV41 b{font-size:11px;color:var(--ink)}.splitYearHeadV41 small{font-size:7px;color:var(--muted);font-weight:700}.splitTeamV41{display:flex;align-items:center;gap:7px;font-weight:900;font-size:10px;position:sticky;top:0}.splitTeamV41 img{width:30px;height:30px;object-fit:contain}.splitCellV41{min-width:245px;width:245px;padding:7px}.splitCellTopV41{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-bottom:5px}.splitReadV41{font-size:7px;font-weight:900;border-radius:999px;padding:3px 6px;background:#edf1ee;white-space:nowrap}.splitReadV41.committee{background:#fff0c7;color:#765100}.splitFallbackV41{font-size:6px;color:#8c6b16;font-weight:800}.splitPeopleV41{display:grid;gap:4px}.splitPersonV41{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:6px;align-items:center;min-height:30px}.splitPersonV41 img{width:28px;height:28px;border-radius:7px;object-fit:cover;background:#edf0ed}.splitPersonV41 .rankV41{font-size:6px;color:var(--muted);font-weight:900;display:block;line-height:1}.splitPersonV41 b{font-size:8px;display:block;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:135px}.splitPersonV41 small{font-size:6px;color:var(--muted);display:block;margin-top:2px;white-space:nowrap}.splitPctV41{font-size:11px;font-weight:950;white-space:nowrap}.splitDraftedV41{opacity:.42}.splitDraftedV41 b{text-decoration:line-through}.splitBarV41{display:flex;height:7px;overflow:hidden;border-radius:999px;background:#e9eeeb;margin-top:6px}.splitSegV41{height:100%;border-right:1px solid #fff9}.splitSegV41:nth-child(1){background:#243b53}.splitSegV41:nth-child(2){background:#55758d}.splitSegV41:nth-child(3){background:#8fa4b3}.splitSegV41:nth-child(4){background:#bcc9d1}.splitSegV41:nth-child(n+5){background:#d6dee3}.splitEmptyV41{height:92px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:8px;font-style:italic}.splitSummaryV41{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 8px;flex:0 0 auto}.splitSummaryV41 span{background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 8px;font-size:8px}.splitSummaryV41 b{font-size:10px;margin-right:3px}
      @media(max-width:700px){#committeeModalV40 .modalbox{width:100vw!important;height:100vh!important;max-height:100vh!important;border-radius:0!important}.splitMatrixV41 th{min-width:220px}.splitCellV41{min-width:220px;width:220px}.splitPersonV41 b{max-width:115px}}
    `;document.head.appendChild(s);
  }

  function metricDetail(entry){
    if(!entry)return'';
    const r=entry.r;
    if(state.metric==='fantasy'||entry.metricUsed==='fantasy-fallback')return `${entry.value.toFixed(1)} FP`;
    return state.pos==='RB'?`${Math.round(carries(r))} car · ${Math.round(targets(r))} tgt`:`${Math.round(targets(r))} tgt · ${Math.round(receptions(r))} rec`;
  }
  function playerRow(entry,index,year){
    if(!entry)return'';
    const r=entry.r,id=String(playerId(r)||''),drafted=Number(year)===CURRENT_YEAR&&draftedSet().has(id),src=faceUrl(r),fallback=fallbackFace(r);
    return`<div class="splitPersonV41 ${drafted?'splitDraftedV41':''}">${src?`<img src="${esc(src)}" ${fallback?`onerror="if(!this.dataset.f){this.dataset.f='1';this.src='${esc(fallback)}'}else{this.style.visibility='hidden'}"`:`onerror="this.style.visibility='hidden'"`}>`:'<span></span>'}<span><span class="rankV41">${state.pos}${index+1}</span><b title="${esc(playerName(r))}">${esc(playerName(r))}</b><small>${esc(metricDetail(entry))}${drafted?' · drafted':''}</small></span><span class="splitPctV41">${entry.share.toFixed(0)}%</span></div>`;
  }
  function yearCell(breakdown,year){
    const e=breakdown.entries;
    if(!e.length)return'<div class="splitCellV41"><div class="splitEmptyV41">No data</div></div>';
    const bars=e.slice(0,6).map(x=>`<span class="splitSegV41" style="width:${Math.max(0,x.share).toFixed(2)}%" title="${esc(playerName(x.r))}: ${x.share.toFixed(1)}%"></span>`).join('');
    const cls=/Committee|Spread/.test(breakdown.label)?'committee':'';
    return`<div class="splitCellV41"><div class="splitCellTopV41"><span class="splitReadV41 ${cls}">${esc(breakdown.label)}</span>${breakdown.metricUsed==='fantasy-fallback'?'<span class="splitFallbackV41">FP-share fallback</span>':''}</div><div class="splitPeopleV41">${e.slice(0,4).map((x,i)=>playerRow(x,i,year)).join('')}</div><div class="splitBarV41">${bars}</div></div>`;
  }

  function render(){
    const root=document.querySelector('#committeeBodyV40');if(!root)return;
    const {years,rows}=matrixData();
    const currentBreakdowns=rows.map(r=>r.years[CURRENT_YEAR]).filter(x=>x?.entries?.length);
    const avgLead=currentBreakdowns.length?currentBreakdowns.reduce((a,x)=>a+x.top,0)/currentBreakdowns.length:0;
    const committeeCount=currentBreakdowns.filter(x=>state.pos==='RB'?x.top<55:x.top<34).length;
    root.innerHTML=`
      <div class="splitToolbarV41">
        <button class="btn splitModeV41 ${state.pos==='RB'?'on':''}" data-split-pos="RB">RB Committees</button>
        <button class="btn splitModeV41 ${state.pos==='WR'?'on':''}" data-split-pos="WR">WR Splits</button>
        <select class="field" id="splitMetricV41"><option value="opportunity" ${state.metric==='opportunity'?'selected':''}>${state.pos==='RB'?'Carries + targets share':'Target share'}</option><option value="fantasy" ${state.metric==='fantasy'?'selected':''}>Fantasy-point share</option></select>
        <select class="field" id="splitHistoryV41"><option value="all" ${state.history==='all'?'selected':''}>All available years</option><option value="5" ${state.history==='5'?'selected':''}>2026 + last 5 years</option></select>
        <select class="field" id="splitSortV41"><option value="team" ${state.sort==='team'?'selected':''}>Sort: Team</option><option value="lead" ${state.sort==='lead'?'selected':''}>Sort: 2026 most concentrated</option><option value="committee" ${state.sort==='committee'?'selected':''}>Sort: 2026 biggest committee</option></select>
        <input class="field" id="splitSearchV41" placeholder="Search team or player across years" value="${esc(state.search)}">
      </div>
      <div class="splitSummaryV41"><span><b>${rows.length}</b> teams shown</span><span><b>${years.length}</b> season columns</span><span><b>${avgLead.toFixed(0)}%</b> avg 2026 lead share</span><span><b>${committeeCount}</b> ${state.pos==='RB'?'2026 committees':'2026 spread rooms'}</span></div>
      <p class="splitHintV41">Team is always column 1. Every season is its own column. Inside each team/year cell, ${state.pos}1–${state.pos}4 are ranked by that season's ${state.pos==='RB'?(state.metric==='opportunity'?'carries + targets':'fantasy points'):(state.metric==='opportunity'?'targets':'fantasy points')} and shown with the player who was actually on that team that year, his face, and his percentage of the team's ${state.pos} usage. Historical team changes therefore appear naturally across columns.</p>
      <div class="splitMatrixWrapV41"><table class="splitMatrixV41"><thead><tr><th>Team</th>${years.map(y=>`<th><div class="splitYearHeadV41"><b>${y}</b><small>${y===CURRENT_YEAR?'PROJECTION':'ACTUAL'}</small></div></th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><td><div class="splitTeamV41"><img src="${teamLogo(row.team)}" onerror="this.style.display='none'"><span>${row.team}</span></div></td>${years.map(y=>`<td>${yearCell(row.years[y],y)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

    root.querySelectorAll('[data-split-pos]').forEach(b=>b.onclick=()=>{state.pos=b.dataset.splitPos;render()});
    root.querySelector('#splitMetricV41').onchange=e=>{state.metric=e.target.value;render()};
    root.querySelector('#splitHistoryV41').onchange=e=>{state.history=e.target.value;render()};
    root.querySelector('#splitSortV41').onchange=e=>{state.sort=e.target.value;render()};
    const search=root.querySelector('#splitSearchV41');search.oninput=e=>{state.search=e.target.value;const pos=e.target.selectionStart;render();const next=root.querySelector('#splitSearchV41');if(next){next.focus();try{next.setSelectionRange(pos,pos)}catch{}}};
  }

  function ensureModal(){
    let m=document.querySelector('#committeeModalV40');
    if(!m){m=document.createElement('div');m.className='modal';m.id='committeeModalV40';document.body.appendChild(m)}
    m.innerHTML='<div class="modalbox"><div class="modalhead"><div><h2 id="committeeTitleV40">Team Usage Split History</h2><small style="color:#aebdca">One team per row · one season per column · actual player identities inside each year</small></div><button class="btn close" id="closeCommitteeV40">×</button></div><div class="careerbody" id="committeeBodyV40"></div></div>';
    const close=()=>m.classList.remove('open');m.querySelector('#closeCommitteeV40').onclick=close;m.onclick=e=>{if(e.target===m)close()};
    return m;
  }
  function open(pos){state.pos=pos||state.pos;ensureModal().classList.add('open');render()}

  function installButtons(){
    const nav=document.querySelector('#viewNav');if(!nav)return false;
    let rb=document.querySelector('#rbCommitteeBtnV40'),wr=document.querySelector('#wrSplitBtnV40');
    const anchor=document.querySelector('#kickerBtn')||document.querySelector('#defenseBtn')||nav.lastElementChild;
    if(!rb){rb=document.createElement('button');rb.className='btn dataViewBtn';rb.id='rbCommitteeBtnV40';anchor?.insertAdjacentElement('afterend',rb)}
    if(!wr){wr=document.createElement('button');wr.className='btn dataViewBtn';wr.id='wrSplitBtnV40';rb.insertAdjacentElement('afterend',wr)}
    rb.textContent='RB Splits';rb.title='Team-by-year RB committee history';rb.onclick=()=>open('RB');
    wr.textContent='WR Splits';wr.title='Team-by-year WR target-share history';wr.onclick=()=>open('WR');
    return true;
  }

  function boot(){installStyles();ensureModal();if(!installButtons())setTimeout(boot,450)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',()=>setTimeout(()=>installButtons(),1400));
})();