/* Fantasy Lens v45 — unified RB/WR/TE/QB team-by-year usage splits. */
(function(){
  'use strict';

  const CURRENT_YEAR=2026;
  const PREVIOUS_YEAR=2025;
  const TEAM_ORDER=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
  const TEAM_ALIAS={WSH:'WAS',WFT:'WAS',LA:'LAR',STL:'LAR',OAK:'LV',SD:'LAC',JAC:'JAX'};
  const state={pos:'RB',metric:'usage',search:'',sort:'team',history:'all'};

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
  function passAttempts(r){return num(r,['passAtt','pass_att','passingAttempts','passing_attempts','passAttempts','attempts','att'])}
  function passCompletions(r){return num(r,['passCmp','pass_cmp','passingCompletions','passing_completions','completions','cmp'])}
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
    const rid=String(playerId(r)||'');
    if(rid){const byId=listPlayers().find(p=>String(playerId(p))===rid);if(byId)return byId}
    const name=norm(playerName(r));
    return name?listPlayers().find(p=>norm(playerName(p))===name)||null:null;
  }
  function faceUrl(r){
    const raw=String(playerId(r)||''),current=currentPlayerMatch(r),currentId=String(playerId(current)||''),pid=currentId||raw;
    if(!pid)return'';
    return /^\d+$/.test(pid)?`https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(pid)}.png`:`https://sleepercdn.com/content/nfl/players/${encodeURIComponent(pid)}.jpg`;
  }
  function fallbackFace(r){
    const raw=String(playerId(r)||'');if(!raw)return'';
    return /^\d+$/.test(raw)?`https://sleepercdn.com/content/nfl/players/${encodeURIComponent(raw)}.jpg`:`https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(raw)}.png`;
  }

  function rawMetric(r,pos){
    if(state.metric==='fantasy')return fantasy(r);
    if(pos==='RB')return carries(r)+targets(r);
    if(pos==='QB')return passAttempts(r);
    return targets(r);
  }
  function metricLabel(pos=state.pos){
    if(state.metric==='fantasy')return'Fantasy-point share';
    if(pos==='RB')return'Carries + targets share';
    if(pos==='QB')return'Pass-attempt share';
    return'Target share';
  }
  function metricDescription(pos=state.pos){
    if(state.metric==='fantasy')return'fantasy points';
    if(pos==='RB')return'carries + targets';
    if(pos==='QB')return'pass attempts';
    return'targets';
  }
  function volumeUnit(pos=state.pos,metricUsed=state.metric){
    if(state.metric==='fantasy'||metricUsed==='fantasy-fallback')return'FP';
    if(pos==='RB')return'opp';
    if(pos==='QB')return'att';
    return'tgt';
  }
  function roleLabel(pos,top,top2,entries){
    if(!entries.length)return'No data';
    if(pos==='RB')return top>=68?'Workhorse':top>=55?'Lead':top2>=82?'1–2 split':'Committee';
    if(pos==='WR')return top>=45?'Alpha':top>=34?'Clear WR1':top2>=70?'Top-two':'Spread';
    if(pos==='TE')return top>=65?'TE1-heavy':top>=50?'Clear TE1':top2>=85?'Top-two':'Committee';
    if(pos==='QB')return top>=90?'Locked starter':top>=75?'Primary QB':top2>=95?'Starter + relief':'QB split';
    return'';
  }
  function teamBreakdown(team,year){
    const pool=sourceRows(year).filter(r=>playerPos(r)===state.pos&&playerTeam(r)===team);
    let values=pool.map(r=>Math.max(0,rawMetric(r,state.pos))),metricUsed=state.metric,total=values.reduce((a,b)=>a+b,0);
    if(!total&&state.metric==='usage'){
      values=pool.map(r=>Math.max(0,fantasy(r)));
      total=values.reduce((a,b)=>a+b,0);
      metricUsed='fantasy-fallback';
    }
    const entries=pool.map((r,i)=>({r,value:values[i]||0})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value).map(x=>({...x,share:total?x.value/total*100:0,metricUsed}));
    const top=entries[0]?.share||0,top2=top+(entries[1]?.share||0);
    return{team,year,entries,total,metricUsed,top,top2,label:roleLabel(state.pos,top,top2,entries)};
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
  function volumeRank(team,year){
    const ranked=TEAM_ORDER.map(t=>({team:t,total:teamBreakdown(t,year).total})).sort((a,b)=>b.total-a.total||a.team.localeCompare(b.team));
    const i=ranked.findIndex(x=>x.team===team);return i>=0?i+1:null;
  }
  function vacatedShare(team){
    const prior=teamBreakdown(team,PREVIOUS_YEAR);if(!prior.total)return 0;
    let lost=0;
    for(const e of prior.entries){const current=currentPlayerMatch(e.r);if(!current||playerTeam(current)!==team)lost+=e.value}
    return lost/prior.total*100;
  }
  function volumeHtml(breakdown,year){
    if(!breakdown.entries.length)return'';
    const unit=volumeUnit(state.pos,breakdown.metricUsed),rank=volumeRank(breakdown.team,year),value=breakdown.metricUsed==='fantasy-fallback'||state.metric==='fantasy'?breakdown.total.toFixed(0):Math.round(breakdown.total);
    const vac=Number(year)===CURRENT_YEAR?vacatedShare(breakdown.team):0;
    return`<div class="v42vol"><span class="v42pill">VOL ${value} ${unit}</span>${rank?`<span class="v42pill">NFL #${rank}</span>`:''}${vac>=1?`<span class="v42pill vac">${vac.toFixed(0)}% vacated</span>`:''}</div>`;
  }

  function installStyles(){
    if(document.querySelector('#usageSplitStylesV45'))return;
    const s=document.createElement('style');s.id='usageSplitStylesV45';s.textContent=`
      #committeeModalV40{z-index:880!important}#committeeModalV40 .modalbox{width:98vw!important;max-width:none!important;max-height:95vh!important;display:flex;flex-direction:column}#committeeModalV40 .careerbody{min-height:0;overflow:hidden!important;padding-top:8px;display:flex;flex-direction:column}
      .splitToolbarV41{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;flex:0 0 auto}.splitToolbarV41 .field{min-height:32px}.splitModeV41.on{background:var(--navy)!important;color:#fff!important}.splitHintV41{font-size:8px;color:var(--muted);margin:0 0 8px;line-height:1.45;flex:0 0 auto}
      .splitMatrixWrapV41{overflow:auto;flex:1;min-height:0;border:1px solid var(--line);border-radius:11px;background:#fff}.splitMatrixV41{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%}.splitMatrixV41 th,.splitMatrixV41 td{border-bottom:1px solid #e7ece8;border-right:1px solid #eef1ef;vertical-align:top}.splitMatrixV41 th{position:sticky;top:0;z-index:8;background:#e9eeeb;padding:8px 9px;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#52616c;text-align:left;min-width:245px}.splitMatrixV41 th:first-child{left:0;z-index:10;min-width:112px;width:112px}.splitMatrixV41 td:first-child{position:sticky;left:0;z-index:6;background:#f9faf8;min-width:112px;width:112px;padding:8px}.splitMatrixV41 tbody tr:hover td{background:#fbfcfb}.splitMatrixV41 tbody tr:hover td:first-child{background:#f0f4f1}
      .splitYearHeadV41{display:flex;align-items:center;justify-content:space-between;gap:8px}.splitYearHeadV41 b{font-size:11px;color:var(--ink)}.splitYearHeadV41 small{font-size:7px;color:var(--muted);font-weight:700}.splitTeamV41{display:flex;align-items:center;gap:7px;font-weight:900;font-size:10px}.splitTeamV41 img{width:30px;height:30px;object-fit:contain}.splitCellV41{min-width:245px;width:245px;padding:7px}.splitCellTopV41{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-bottom:5px}.splitReadV41{font-size:7px;font-weight:900;border-radius:999px;padding:3px 6px;background:#edf1ee;white-space:nowrap}.splitReadV41.committee{background:#fff0c7;color:#765100}.splitFallbackV41{font-size:6px;color:#8c6b16;font-weight:800}.splitPeopleV41{display:grid;gap:4px}.splitPersonV41{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:6px;align-items:center;min-height:30px}.splitPersonV41 img{width:28px;height:28px;border-radius:7px;object-fit:cover;background:#edf0ed}.splitPersonV41 .rankV41{font-size:6px;color:var(--muted);font-weight:900;display:block;line-height:1}.splitPersonV41 b{font-size:8px;display:block;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:135px}.splitPersonV41 small{font-size:6px;color:var(--muted);display:block;margin-top:2px;white-space:nowrap}.splitPctV41{font-size:11px;font-weight:950;white-space:nowrap}.splitDraftedV41{opacity:.42}.splitDraftedV41 b{text-decoration:line-through}.splitBarV41{display:flex;height:7px;overflow:hidden;border-radius:999px;background:#e9eeeb;margin-top:6px}.splitSegV41{height:100%;border-right:1px solid #fff9}.splitSegV41:nth-child(1){background:#243b53}.splitSegV41:nth-child(2){background:#55758d}.splitSegV41:nth-child(3){background:#8fa4b3}.splitSegV41:nth-child(4){background:#bcc9d1}.splitSegV41:nth-child(n+5){background:#d6dee3}.splitEmptyV41{height:92px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:8px;font-style:italic}.splitSummaryV41{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 8px;flex:0 0 auto}.splitSummaryV41 span{background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 8px;font-size:8px}.splitSummaryV41 b{font-size:10px;margin-right:3px}
      @media(max-width:700px){#committeeModalV40 .modalbox{width:100vw!important;height:100vh!important;max-height:100vh!important;border-radius:0!important}.splitMatrixV41 th{min-width:220px}.splitCellV41{min-width:220px;width:220px}.splitPersonV41 b{max-width:115px}}
    `;document.head.appendChild(s);
  }

  function metricDetail(entry){
    if(!entry)return'';const r=entry.r;
    if(state.metric==='fantasy'||entry.metricUsed==='fantasy-fallback')return`${entry.value.toFixed(1)} FP`;
    if(state.pos==='RB')return`${Math.round(carries(r))} car · ${Math.round(targets(r))} tgt`;
    if(state.pos==='QB')return`${Math.round(passAttempts(r))} att · ${Math.round(passCompletions(r))} cmp`;
    return`${Math.round(targets(r))} tgt · ${Math.round(receptions(r))} rec`;
  }
  function playerRow(entry,index,year){
    if(!entry)return'';
    const r=entry.r,pid=String(playerId(r)||''),drafted=Number(year)===CURRENT_YEAR&&draftedSet().has(pid),src=faceUrl(r),fallback=fallbackFace(r);
    return`<div class="splitPersonV41 ${drafted?'splitDraftedV41':''}">${src?`<img src="${esc(src)}" ${fallback?`onerror="if(!this.dataset.f){this.dataset.f='1';this.src='${esc(fallback)}'}else{this.style.visibility='hidden'}"`:`onerror="this.style.visibility='hidden'"`}>`:'<span></span>'}<span><span class="rankV41">${state.pos}${index+1}</span><b title="${esc(playerName(r))}">${esc(playerName(r))}</b><small>${esc(metricDetail(entry))}${drafted?' · drafted':''}</small></span><span class="splitPctV41">${entry.share.toFixed(0)}%</span></div>`;
  }
  function yearCell(breakdown,year){
    const e=breakdown.entries;
    if(!e.length)return'<div class="splitCellV41"><div class="splitEmptyV41">No data</div></div>';
    const bars=e.slice(0,6).map(x=>`<span class="splitSegV41" style="width:${Math.max(0,x.share).toFixed(2)}%" title="${esc(playerName(x.r))}: ${x.share.toFixed(1)}%"></span>`).join('');
    const cls=/Committee|Spread|split/.test(breakdown.label)?'committee':'';
    return`<div class="splitCellV41">${volumeHtml(breakdown,year)}<div class="splitCellTopV41"><span class="splitReadV41 ${cls}">${esc(breakdown.label)}</span>${breakdown.metricUsed==='fantasy-fallback'?'<span class="splitFallbackV41">FP-share fallback</span>':''}</div><div class="splitPeopleV41">${e.slice(0,4).map((x,i)=>playerRow(x,i,year)).join('')}</div><div class="splitBarV41">${bars}</div></div>`;
  }

  function render(){
    const root=document.querySelector('#committeeBodyV40');if(!root)return;
    const {years,rows}=matrixData(),currentBreakdowns=rows.map(r=>r.years[CURRENT_YEAR]).filter(x=>x?.entries?.length);
    const avgLead=currentBreakdowns.length?currentBreakdowns.reduce((a,x)=>a+x.top,0)/currentBreakdowns.length:0;
    const splitCount=currentBreakdowns.filter(x=>state.pos==='QB'?x.top<90:state.pos==='TE'?x.top<50:state.pos==='RB'?x.top<55:x.top<34).length;
    root.innerHTML=`
      <div class="splitToolbarV41">
        ${['RB','WR','TE','QB'].map(p=>`<button class="btn splitModeV41 ${state.pos===p?'on':''}" data-split-pos="${p}">${p}</button>`).join('')}
        <select class="field" id="splitMetricV41"><option value="usage" ${state.metric==='usage'?'selected':''}>${metricLabel()}</option><option value="fantasy" ${state.metric==='fantasy'?'selected':''}>Fantasy-point share</option></select>
        <select class="field" id="splitHistoryV41"><option value="all" ${state.history==='all'?'selected':''}>All available years</option><option value="5" ${state.history==='5'?'selected':''}>2026 + last 5 years</option></select>
        <select class="field" id="splitSortV41"><option value="team" ${state.sort==='team'?'selected':''}>Sort: Team</option><option value="lead" ${state.sort==='lead'?'selected':''}>Sort: 2026 most concentrated</option><option value="committee" ${state.sort==='committee'?'selected':''}>Sort: 2026 biggest split</option></select>
        <input class="field" id="splitSearchV41" placeholder="Search team or player across years" value="${esc(state.search)}">
      </div>
      <div class="splitSummaryV41"><span><b>${rows.length}</b> teams shown</span><span><b>${years.length}</b> season columns</span><span><b>${avgLead.toFixed(0)}%</b> avg 2026 lead share</span><span><b>${splitCount}</b> 2026 ${state.pos==='QB'?'non-locked QB rooms':'split rooms'}</span></div>
      <p class="splitHintV41">Team is always column 1; every season is its own column. ${state.pos}1–${state.pos}4 are ranked by that season's ${metricDescription()} and retain the player/team identity from that specific year. ${state.pos==='QB'?'QB share is based on team pass attempts, so backup starts, injuries, benchings, and rotations are visible.':'Historical team changes appear naturally across columns.'} Volume and NFL rank use the same selected metric; the 2026 column also shows the share of 2025 workload vacated by players no longer on that team.</p>
      <div class="splitMatrixWrapV41"><table class="splitMatrixV41"><thead><tr><th>Team</th>${years.map(y=>`<th><div class="splitYearHeadV41"><b>${y}</b><small>${y===CURRENT_YEAR?'PROJECTION':'ACTUAL'}</small></div></th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><td><div class="splitTeamV41"><img src="${teamLogo(row.team)}" onerror="this.style.display='none'"><span>${row.team}</span></div></td>${years.map(y=>`<td>${yearCell(row.years[y],y)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

    root.querySelectorAll('[data-split-pos]').forEach(b=>b.onclick=()=>{state.pos=b.dataset.splitPos;render()});
    root.querySelector('#splitMetricV41').onchange=e=>{state.metric=e.target.value;render()};
    root.querySelector('#splitHistoryV41').onchange=e=>{state.history=e.target.value;render()};
    root.querySelector('#splitSortV41').onchange=e=>{state.sort=e.target.value;render()};
    const search=root.querySelector('#splitSearchV41');search.oninput=e=>{state.search=e.target.value;const caret=e.target.selectionStart;render();const next=root.querySelector('#splitSearchV41');if(next){next.focus();try{next.setSelectionRange(caret,caret)}catch{}}};
  }

  function ensureModal(){
    let m=document.querySelector('#committeeModalV40');
    if(!m){m=document.createElement('div');m.className='modal';m.id='committeeModalV40';document.body.appendChild(m)}
    m.innerHTML='<div class="modalbox"><div class="modalhead"><div><h2>Team Usage Split History</h2><small style="color:#aebdca">RB · WR · TE · QB | one team per row · one season per column</small></div><button class="btn close" id="closeCommitteeV40">×</button></div><div class="careerbody" id="committeeBodyV40"></div></div>';
    const close=()=>m.classList.remove('open');m.querySelector('#closeCommitteeV40').onclick=close;m.onclick=e=>{if(e.target===m)close()};
    return m;
  }
  function open(position){state.pos=position||state.pos;const m=ensureModal();m.classList.add('open');render()}

  function patchLegacyButtons(){
    const rb=document.querySelector('#rbCommitteeBtnV40'),wr=document.querySelector('#wrSplitBtnV40');
    if(rb){rb.textContent='Usage Splits';rb.title='RB / WR / TE / QB team-by-year usage history';rb.onclick=()=>open('RB')}
    if(wr){wr.style.display='none';wr.onclick=()=>open('WR')}
  }
  function patchLayeredNav(){
    const nav=document.querySelector('#v42nav');if(!nav)return false;
    const teamMenu=[...nav.querySelectorAll('.v42menu')].find(m=>/Team/.test(m.querySelector(':scope > .btn')?.textContent||''));
    if(!teamMenu)return false;
    const pop=teamMenu.querySelector('.v42pop');if(!pop)return false;
    const rb=pop.querySelector('[data-a="rb"]')||pop.querySelector('[data-a="usageSplits"]'),wr=pop.querySelector('[data-a="wr"]');
    if(rb){rb.textContent='Usage Splits (RB / WR / TE / QB)';rb.dataset.a='usageSplits';rb.onclick=e=>{e.stopPropagation();teamMenu.classList.remove('open');open('RB')}}
    if(wr)wr.remove();
    return true;
  }

  function boot(){
    installStyles();patchLegacyButtons();patchLayeredNav();
    setTimeout(()=>{patchLegacyButtons();patchLayeredNav()},900);
    setTimeout(()=>{patchLegacyButtons();patchLayeredNav()},2200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',()=>setTimeout(boot,1200));
  window.FantasyLensUsageSplits={open};
})();
