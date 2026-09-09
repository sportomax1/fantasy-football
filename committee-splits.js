/* Fantasy Lens v40 — RB committee + WR receiving split analysis. */
(function(){
  'use strict';

  const CURRENT_YEAR=2026;
  const TEAM_ORDER=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
  const TEAM_ALIAS={WSH:'WAS',WFT:'WAS',LA:'LAR',STL:'LAR',OAK:'LV',SD:'LAC',JAC:'JAX'};
  const state={pos:'RB',year:String(CURRENT_YEAR),metric:'opportunity',search:'',sort:'team'};

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const teamCode=v=>{const t=String(v||'').toUpperCase().trim();return TEAM_ALIAS[t]||t};
  const teamLogo=t=>`https://a.espncdn.com/i/teamlogos/nfl/500/${teamCode(t)==='WAS'?'wsh':teamCode(t).toLowerCase()}.png`;
  const face=id=>id?`https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(id)}.png`:'';
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
  function playerId(r){return r?.id??r?.player_id??r?.playerId??r?.espnId??''}
  function playerName(r){return r?.name||r?.full_name||r?.displayName||r?.player_name||'Unknown'}
  function playerPos(r){return String(r?.pos||r?.position||r?.positionAbbr||'').toUpperCase()}
  function playerTeam(r){return teamCode(r?.team||r?.teamAbbr||r?.proTeam||r?.proTeamAbbreviation||r?.nflTeam||'')}

  function sourceRows(){
    if(state.year===String(CURRENT_YEAR))return listPlayers();
    return objectRows(yearsData()?.[state.year]??yearsData()?.[Number(state.year)]);
  }

  function historicalYears(){
    const ys=Object.keys(yearsData()).map(Number).filter(y=>Number.isFinite(y)&&y<CURRENT_YEAR).sort((a,b)=>b-a);
    return ys.length?ys:[2025,2024,2023,2022,2021,2020,2019,2018];
  }

  function rawMetric(r,pos){
    if(state.metric==='fantasy')return fantasy(r);
    if(pos==='RB')return carries(r)+targets(r);
    return targets(r);
  }

  function teamBreakdown(team,rows){
    const pool=rows.filter(r=>playerPos(r)===state.pos&&playerTeam(r)===team);
    let vals=pool.map(r=>Math.max(0,rawMetric(r,state.pos)));
    let metricUsed=state.metric;
    let total=vals.reduce((a,b)=>a+b,0);
    if(!total&&state.metric==='opportunity'){
      vals=pool.map(r=>Math.max(0,fantasy(r)));
      total=vals.reduce((a,b)=>a+b,0);
      metricUsed='fantasy-fallback';
    }
    const entries=pool.map((r,i)=>({r,value:vals[i]||0})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
    const pctEntries=entries.map(x=>Object.assign(x,{share:total?x.value/total*100:0,metricUsed}));
    const top=pctEntries[0]?.share||0,top2=(pctEntries[0]?.share||0)+(pctEntries[1]?.share||0);
    let label='No data';
    if(pctEntries.length){
      if(state.pos==='RB')label=top>=68?'Workhorse':top>=55?'Lead back':top2>=82?'Two-back split':'Committee';
      else label=top>=45?'Alpha-heavy':top>=34?'Clear WR1':top2>=70?'Top-two heavy':'Spread room';
    }
    return{team,entries:pctEntries,total,metricUsed,label,top,top2};
  }

  function buildRows(){
    const src=sourceRows();
    let rows=TEAM_ORDER.map(t=>teamBreakdown(t,src));
    const q=state.search.trim().toLowerCase();
    if(q)rows=rows.filter(x=>x.team.toLowerCase().includes(q)||x.entries.some(e=>playerName(e.r).toLowerCase().includes(q)));
    if(state.sort==='lead')rows.sort((a,b)=>b.top-a.top||a.team.localeCompare(b.team));
    else if(state.sort==='committee')rows.sort((a,b)=>a.top-b.top||a.team.localeCompare(b.team));
    return rows;
  }

  function installStyles(){
    if(document.querySelector('#committeeSplitStylesV40'))return;
    const s=document.createElement('style');s.id='committeeSplitStylesV40';s.textContent=`
      #committeeModalV40{z-index:880!important}#committeeModalV40 .modalbox{width:min(1480px,97vw)!important;max-width:1480px!important;max-height:94vh!important;display:flex;flex-direction:column}#committeeModalV40 .careerbody{min-height:0;overflow:auto!important;padding-top:8px}
      .splitToolbarV40{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:9px}.splitToolbarV40 .field{min-height:32px}.splitModeV40.on{background:var(--navy)!important;color:#fff!important}.splitHintV40{font-size:8px;color:var(--muted);margin:0 0 9px;line-height:1.5}
      .splitTableWrapV40{overflow:auto;border:1px solid var(--line);border-radius:11px;background:#fff}.splitTableV40{width:100%;border-collapse:separate;border-spacing:0;min-width:1140px}.splitTableV40 th,.splitTableV40 td{padding:7px 8px;border-bottom:1px solid #edf0ed;vertical-align:middle;text-align:left;font-size:9px}.splitTableV40 th{position:sticky;top:0;z-index:4;background:#e9eeeb;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#52616c}.splitTableV40 th:first-child,.splitTableV40 td:first-child{position:sticky;left:0;z-index:3;background:#fff}.splitTableV40 th:first-child{z-index:5;background:#e9eeeb}.splitTeamV40{display:flex;align-items:center;gap:7px;font-weight:900}.splitTeamV40 img{width:26px;height:26px;object-fit:contain}.splitPlayerV40{display:grid;grid-template-columns:30px minmax(80px,1fr) auto;gap:6px;align-items:center;min-width:170px}.splitPlayerV40 img{width:30px;height:30px;border-radius:7px;object-fit:cover;background:#edf0ed}.splitPlayerV40 b{display:block;font-size:9px}.splitPlayerV40 small{display:block;font-size:7px;color:var(--muted);margin-top:2px}.splitPctV40{font-size:13px;font-weight:900;white-space:nowrap}.splitDraftedV40{opacity:.42}.splitDraftedV40 b{text-decoration:line-through}.shareBarV40{display:flex;width:180px;height:17px;overflow:hidden;border-radius:999px;background:#edf0ed;border:1px solid #d9dfdb}.shareSegV40{height:100%;min-width:0;border-right:1px solid #ffffffaa}.shareSegV40:nth-child(1){background:#243b53}.shareSegV40:nth-child(2){background:#55758d}.shareSegV40:nth-child(3){background:#8fa4b3}.shareSegV40:nth-child(4){background:#bcc9d1}.shareSegV40:nth-child(n+5){background:#d6dee3}.splitLabelV40{display:inline-flex;padding:4px 7px;border-radius:999px;background:#edf1ee;font-weight:850;font-size:8px;white-space:nowrap}.splitLabelV40.committee{background:#fff0c7;color:#765100}.splitEmptyV40{color:var(--muted);font-style:italic}.splitSummaryV40{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 8px}.splitSummaryV40 span{background:#fff;border:1px solid var(--line);border-radius:9px;padding:6px 8px;font-size:8px}.splitSummaryV40 b{font-size:11px;margin-right:3px}
      @media(max-width:700px){#committeeModalV40 .modalbox{width:100vw!important;max-height:100vh!important;height:100vh!important;border-radius:0!important}.shareBarV40{width:130px}}
    `;document.head.appendChild(s);
  }

  function playerCell(entry){
    if(!entry)return'<span class="splitEmptyV40">—</span>';
    const r=entry.r,id=playerId(r),drafted=draftedSet().has(String(id));
    const extra=state.metric==='fantasy'||entry.metricUsed==='fantasy-fallback'?`${entry.value.toFixed(1)} FP`:state.pos==='RB'?`${Math.round(carries(r))} car · ${Math.round(targets(r))} tgt`:`${Math.round(targets(r))} tgt · ${Math.round(receptions(r))} rec`;
    return`<div class="splitPlayerV40 ${drafted?'splitDraftedV40':''}"><img src="${face(id)}" onerror="this.style.visibility='hidden'"><span><b>${esc(playerName(r))}</b><small>${esc(extra)}${drafted?' · drafted':''}</small></span><span class="splitPctV40">${entry.share.toFixed(0)}%</span></div>`;
  }

  function render(){
    const root=document.querySelector('#committeeBodyV40');if(!root)return;
    const rows=buildRows(),withData=rows.filter(x=>x.entries.length),avgLead=withData.length?withData.reduce((a,x)=>a+x.top,0)/withData.length:0,committeeCount=withData.filter(x=>state.pos==='RB'?x.top<55:x.top<34).length;
    const yearLabel=state.year===String(CURRENT_YEAR)?`${CURRENT_YEAR} projection`:state.year;
    root.innerHTML=`
      <div class="splitToolbarV40">
        <button class="btn splitModeV40 ${state.pos==='RB'?'on':''}" data-split-pos="RB">RB Committees</button>
        <button class="btn splitModeV40 ${state.pos==='WR'?'on':''}" data-split-pos="WR">WR Splits</button>
        <select class="field" id="splitYearV40"><option value="${CURRENT_YEAR}">${CURRENT_YEAR} Projection</option>${historicalYears().map(y=>`<option value="${y}" ${state.year===String(y)?'selected':''}>${y} Actual</option>`).join('')}</select>
        <select class="field" id="splitMetricV40"><option value="opportunity" ${state.metric==='opportunity'?'selected':''}>${state.pos==='RB'?'Opportunity share (carries + targets)':'Target share'}</option><option value="fantasy" ${state.metric==='fantasy'?'selected':''}>Fantasy-point share</option></select>
        <select class="field" id="splitSortV40"><option value="team" ${state.sort==='team'?'selected':''}>Sort: Team</option><option value="lead" ${state.sort==='lead'?'selected':''}>Sort: Most concentrated</option><option value="committee" ${state.sort==='committee'?'selected':''}>Sort: Biggest committee</option></select>
        <input class="field" id="splitSearchV40" placeholder="Search team or player" value="${esc(state.search)}">
      </div>
      <div class="splitSummaryV40"><span><b>${withData.length}</b> teams with ${yearLabel} data</span><span><b>${avgLead.toFixed(0)}%</b> average lead share</span><span><b>${committeeCount}</b> ${state.pos==='RB'?'true committees':'spread WR rooms'}</span></div>
      <p class="splitHintV40">One NFL team per row. Percentages are each player's share of the selected team's ${state.pos==='RB'?(state.metric==='opportunity'?'RB carries + targets':'RB fantasy points'):(state.metric==='opportunity'?'WR targets':'WR fantasy points')}. If detailed usage is unavailable for a team/year, the row automatically falls back to fantasy-point share.</p>
      <div class="splitTableWrapV40"><table class="splitTableV40"><thead><tr><th>Team</th><th>${state.pos} #1</th><th>${state.pos} #2</th><th>${state.pos} #3</th><th>${state.pos} #4</th><th>Split</th><th>Read</th></tr></thead><tbody>${rows.map(x=>{
        const e=x.entries;
        const segs=e.slice(0,6).map(z=>`<span class="shareSegV40" style="width:${Math.max(0,z.share).toFixed(2)}%" title="${esc(playerName(z.r))}: ${z.share.toFixed(1)}%"></span>`).join('');
        const cls=/Committee|Spread/.test(x.label)?'committee':'';
        return`<tr><td><div class="splitTeamV40"><img src="${teamLogo(x.team)}"><span>${x.team}</span></div></td><td>${playerCell(e[0])}</td><td>${playerCell(e[1])}</td><td>${playerCell(e[2])}</td><td>${playerCell(e[3])}</td><td>${e.length?`<div class="shareBarV40">${segs}</div>`:'<span class="splitEmptyV40">No data</span>'}</td><td><span class="splitLabelV40 ${cls}">${esc(x.label)}</span></td></tr>`;
      }).join('')}</tbody></table></div>`;

    root.querySelectorAll('[data-split-pos]').forEach(b=>b.onclick=()=>{state.pos=b.dataset.splitPos;render()});
    root.querySelector('#splitYearV40').onchange=e=>{state.year=e.target.value;render()};
    root.querySelector('#splitMetricV40').onchange=e=>{state.metric=e.target.value;render()};
    root.querySelector('#splitSortV40').onchange=e=>{state.sort=e.target.value;render()};
    root.querySelector('#splitSearchV40').oninput=e=>{state.search=e.target.value;render()};
  }

  function ensureModal(){
    let m=document.querySelector('#committeeModalV40');if(m)return m;
    m=document.createElement('div');m.className='modal';m.id='committeeModalV40';
    m.innerHTML='<div class="modalbox"><div class="modalhead"><div><h2 id="committeeTitleV40">Team Usage Splits</h2><small style="color:#aebdca">RB committees + WR room concentration · projections and prior seasons</small></div><button class="btn close" id="closeCommitteeV40">×</button></div><div class="careerbody" id="committeeBodyV40"></div></div>';
    document.body.appendChild(m);
    const close=()=>m.classList.remove('open');m.querySelector('#closeCommitteeV40').onclick=close;m.onclick=e=>{if(e.target===m)close()};
    return m;
  }

  function open(pos){state.pos=pos||state.pos;ensureModal().classList.add('open');render()}

  function installButtons(){
    const nav=document.querySelector('#viewNav');if(!nav||document.querySelector('#rbCommitteeBtnV40'))return false;
    const anchor=document.querySelector('#kickerBtn')||document.querySelector('#defenseBtn')||nav.lastElementChild;
    const rb=document.createElement('button');rb.className='btn dataViewBtn';rb.id='rbCommitteeBtnV40';rb.textContent='RB Splits';rb.title='Team-by-team RB workload / projection share';rb.onclick=()=>open('RB');
    const wr=document.createElement('button');wr.className='btn dataViewBtn';wr.id='wrSplitBtnV40';wr.textContent='WR Splits';wr.title='Team-by-team WR target / projection share';wr.onclick=()=>open('WR');
    anchor?.insertAdjacentElement('afterend',wr);wr.insertAdjacentElement('beforebegin',rb);
    return true;
  }

  function boot(){installStyles();ensureModal();if(!installButtons())setTimeout(boot,450)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',()=>setTimeout(()=>{installButtons();},1400));
})();