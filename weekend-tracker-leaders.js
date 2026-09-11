(()=>{'use strict';
let trackerView=localStorage.getItem('fantasyWeekendMatrix.view')||'matrix',draggingRoster=null;
let leadersHideZero=localStorage.getItem('fantasyWeekendMatrix.leadersHideZero')!=='false';
let leadersGameState=localStorage.getItem('fantasyWeekendMatrix.leadersGameState')||'all';
let leadersEventId=localStorage.getItem('fantasyWeekendMatrix.leadersEventId')||'all';
const POSITION_LANES=['QB','RB','WR','TE','DEF','K'];
const originalRenderMatrix=renderMatrix;

renderMatrix=function(){originalRenderMatrix();applyTrackerView();decorateRosterDrag();if(trackerView==='leaders')renderLeaders()};

function setTrackerView(view){
  trackerView=view==='leaders'?'leaders':'matrix';
  localStorage.setItem('fantasyWeekendMatrix.view',trackerView);
  applyTrackerView();
  if(trackerView==='leaders')renderLeaders();
}

function applyTrackerView(){
  const has=state.leagues.length>0,matrix=$('#matrixShell'),empty=$('#emptyStart'),leaders=$('#leadersView');
  if(!matrix||!empty||!leaders)return;
  $('#matrixViewBtn')?.classList.toggle('on',trackerView==='matrix');
  $('#leadersViewBtn')?.classList.toggle('on',trackerView==='leaders');
  if(!has){leaders.style.display='none';matrix.style.display='none';empty.style.display='block';return}
  empty.style.display='none';
  if(trackerView==='leaders'){matrix.style.display='none';leaders.style.display='block'}
  else{leaders.style.display='none';matrix.style.display='block'}
}

function selectedLeadersLeague(){
  const select=$('#leadersLeagueFilter');
  const id=select?.value||state.leagues[0]?.id;
  return state.leagues.find(l=>l.id===id)||state.leagues[0]||null;
}

function rosterMemberships(pid){
  const out=[];
  for(const l of state.leagues){
    for(const [slot,id] of Object.entries(l.roster||{})){
      if(id===pid){out.push({l,slot});break}
    }
  }
  return out;
}

function rosterFlags(pid){
  const memberships=rosterMemberships(pid);
  if(!memberships.length)return'';
  const currentSeason=num(state.season)===new Date().getFullYear(),title=currentSeason?'★ MY ROSTER':'★ CURRENT ROSTER';
  return `<span class="myRosterFlag">${title}</span>${memberships.map(x=>`<span class="rosterChip">${esc(x.l.name)} · ${esc(slotLabel(x.l,x.slot))}</span>`).join('')}`;
}

function availableGames(){
  const map=new Map();
  for(const [team,g] of gamesByTeam.entries()){
    if(!g?.eventId)continue;
    const stateClass=g.state||g.cls||'pre';
    let x=map.get(g.eventId);
    if(!x){x={eventId:g.eventId,state:stateClass,teams:new Set()};map.set(g.eventId,x)}
    x.teams.add(team);
    if(g.opp)x.teams.add(g.opp);
    if(stateClass==='live')x.state='live';
    else if(stateClass==='final'&&x.state!=='live')x.state='final';
  }
  return [...map.values()].map(x=>({...x,teams:[...x.teams]})).sort((a,b)=>{
    const order={live:0,pre:1,final:2};
    return (order[a.state]??3)-(order[b.state]??3)||a.teams.join(' ').localeCompare(b.teams.join(' '));
  });
}

function gameFilterCounts(){
  const games=availableGames();
  return {
    all:games.length,
    live:games.filter(x=>x.state==='live').length,
    pre:games.filter(x=>x.state==='pre').length,
    final:games.filter(x=>x.state==='final').length
  };
}

function normalizeLeaderGame(g){
  const display=gameDisplay(g)||{};
  const cls=display.cls||display.state||'pre';
  const remaining=Number.isFinite(Number(display.remaining))?Number(display.remaining):(cls==='final'?0:cls==='pre'?100:Math.max(0,100-num(display.progress)));
  return {...display,cls,state:cls,remaining};
}

function gameMatchesFilter(g){
  const cls=g?.cls||g?.state||'pre';
  if(leadersEventId!=='all'&&g.eventId!==leadersEventId)return false;
  if(leadersGameState!=='all'&&cls!==leadersGameState)return false;
  return true;
}

function leaderEntries(){
  const l=selectedLeadersLeague();
  if(!l)return[];
  return players.filter(p=>POSITION_LANES.includes(p.pos)).map(p=>{
    const st=playerStats(p),pts=calcPoints(p,st,l.scoring),g=normalizeLeaderGame(gameFor(p));
    return {l,p,st,pts,g};
  }).filter(x=>(!leadersHideZero||Math.abs(x.pts)>.0001)&&gameMatchesFilter(x.g));
}

function leaderHeatClass(x){
  const h=heatClass(x.pts,x.g);
  return h||'';
}

function leaderCard(x,rank){
  const chips=statChips(x.p,x.st),g=x.g,team=teamForPlayer(x.p),flags=rosterFlags(x.p.id);
  const stats=chips.map(c=>`<span class="stat">${esc(c)}</span>`).join('')||'<span class="stat">No stats yet</span>';
  const gameRemaining=g.cls==='final'?'done':`${Math.round(g.remaining)}% left`;
  return `<article class="leaderCard rank${Math.min(rank,3)} ${leaderHeatClass(x)}">
    <div class="leaderRow">
      <div class="leaderRank" title="${esc(x.p.pos)} rank">#${rank}</div>
      <div class="leaderPlayerImage">${avatar(x.p)}</div>
      <div class="leaderName" title="${esc(x.p.name)}"><b>${esc(x.p.name)}</b></div>
      <div class="leaderLogoCell" title="${esc(team||'Free agent')}">${team?teamLogo(team):'<span class="leaderDash">—</span>'}</div>
      <div class="leaderLogoCell leaderOppLogo" title="${esc(g.opp||'No opponent')}">${g.opp?teamLogo(g.opp):'<span class="leaderDash">—</span>'}</div>
      <div class="leaderPts" title="Fantasy points">${fmt(x.pts)}</div>
      <div class="leaderGameTime"><span class="gameState ${g.cls}">${esc(g.label)}</span><span class="remaining ${remainClass(g)}">${esc(gameRemaining)}</span></div>
      <div class="leaderStatsCell">${flags}${stats}${dstBadge(x.p,g)}${weatherHTML(g)}${fieldHTML(g)}</div>
    </div>
  </article>`;
}

function renderLeaderFilters(){
  const counts=gameFilterCounts(),games=availableGames(),bar=$('#leadersGameFilters'),gameSelect=$('#leadersGameSelect');
  if(bar){
    const defs=[['all','All',counts.all],['live','Live',counts.live],['pre','Upcoming',counts.pre],['final','Final',counts.final]];
    bar.innerHTML=defs.map(([k,label,count])=>`<button class="gameFilterChip ${leadersGameState===k?'on':''}" data-leader-state="${k}" aria-pressed="${leadersGameState===k?'true':'false'}">${label} <b>${count}</b></button>`).join('');
    bar.querySelectorAll('[data-leader-state]').forEach(b=>b.onclick=()=>{
      leadersGameState=b.dataset.leaderState||'all';
      leadersEventId='all';
      localStorage.setItem('fantasyWeekendMatrix.leadersGameState',leadersGameState);
      localStorage.setItem('fantasyWeekendMatrix.leadersEventId','all');
      renderLeaders();
    });
  }
  if(gameSelect){
    const valid=leadersEventId==='all'||games.some(g=>g.eventId===leadersEventId);
    if(!valid){leadersEventId='all';localStorage.setItem('fantasyWeekendMatrix.leadersEventId','all')}
    gameSelect.innerHTML=`<option value="all">All matchups</option>${games.map(g=>`<option value="${esc(g.eventId)}">${esc(g.teams.join(' vs '))} · ${g.state==='live'?'LIVE':g.state==='final'?'FINAL':'UPCOMING'}</option>`).join('')}`;
    gameSelect.value=leadersEventId;
  }
}

function leaderColumnHeader(){
  return `<div class="leaderColumnHead" aria-hidden="true"><span>Rank</span><span>Player</span><span>Name</span><span>Team</span><span>Opp</span><span>Pts</span><span>Game</span><span>Stats</span></div>`;
}

function renderLeaders(){
  const root=$('#leadersLanes'),filter=$('#leadersLeagueFilter'),toggle=$('#leadersHideZero');
  if(!root||!filter)return;
  const current=filter.value||state.leagues[0]?.id||'';
  filter.innerHTML=state.leagues.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
  if([...filter.options].some(o=>o.value===current))filter.value=current;
  else if(filter.options.length)filter.selectedIndex=0;
  if(toggle)toggle.checked=leadersHideZero;
  renderLeaderFilters();
  const entries=leaderEntries(),totalPool=players.filter(p=>POSITION_LANES.includes(p.pos));
  root.innerHTML=POSITION_LANES.map(pos=>{
    const allAtPos=totalPool.filter(p=>p.pos===pos).length;
    const lane=entries.filter(x=>x.p.pos===pos).sort((a,b)=>b.pts-a.pts||a.p.name.localeCompare(b.p.name));
    return `<section class="leaderLane"><div class="leaderLaneHead"><b>${pos}</b><span>${lane.length} shown${leadersHideZero?` / ${allAtPos}`:''}</span></div>${leaderColumnHeader()}<div class="leaderCards">${lane.length?lane.map((x,i)=>leaderCard(x,i+1)).join(''):'<div class="leaderEmpty">No '+pos+' players match these filters.</div>'}</div></section>`;
  }).join('');
}

function rosterPayloadFromCell(cell){
  const remove=cell.querySelector('[data-remove]');
  if(!remove)return null;
  const [lid,slot]=remove.dataset.remove.split('|'),l=state.leagues.find(x=>x.id===lid),pid=l?.roster?.[slot];
  return l&&pid?{lid,slot,pid}:null;
}

function validRosterDrop(src,targetLid,targetSlot){
  if(!src||src.lid!==targetLid)return false;
  if(src.slot===targetSlot)return true;
  const l=state.leagues.find(x=>x.id===src.lid),sourceP=playerMap.get(src.pid);
  if(!l||!sourceP||!compatible(sourceP,targetSlot,l))return false;
  const targetId=l.roster[targetSlot];
  if(!targetId)return true;
  const targetP=playerMap.get(targetId);
  return !!targetP&&compatible(targetP,src.slot,l);
}

function clearDropStyles(){
  $$('.playerCell.dropTarget,.playerCell.dropInvalid,.playerCell.dragSource').forEach(el=>el.classList.remove('dropTarget','dropInvalid','dragSource'));
}

function decorateRosterDrag(){
  $$('.playerCell[data-cell] .pcard').forEach(card=>{
    const cell=card.closest('.playerCell'),src=rosterPayloadFromCell(cell);
    if(!src)return;
    card.draggable=true;
    card.ondragstart=e=>{
      draggingRoster=src;
      cell.classList.add('dragSource');
      try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',JSON.stringify(src))}catch(_){}
    };
    card.ondragend=()=>{draggingRoster=null;clearDropStyles()};
    const head=card.querySelector('.phead'),remove=head?.querySelector('[data-remove]');
    if(head&&remove&&!head.querySelector('.swapPlayerBtn')){
      const b=document.createElement('button');
      b.type='button';b.className='swapPlayerBtn';b.textContent='↔ Swap';b.title='Replace this player';
      b.onclick=e=>{e.stopPropagation();presetTarget={lid:src.lid,slot:src.slot};$('#playerSearch').focus();$('#playerSearch').select();toast(`Search replacement for ${slotLabel(state.leagues.find(x=>x.id===src.lid),src.slot)}`)};
      head.insertBefore(b,remove);
    }
  });
  $$('.playerCell[data-cell]').forEach(cell=>{
    cell.ondragover=e=>{
      const [lid,slot]=cell.dataset.cell.split('|');
      if(validRosterDrop(draggingRoster,lid,slot)){
        e.preventDefault();e.dataTransfer.dropEffect='move';cell.classList.add('dropTarget');cell.classList.remove('dropInvalid');
      }else if(draggingRoster){cell.classList.add('dropInvalid');cell.classList.remove('dropTarget')}
    };
    cell.ondragleave=()=>cell.classList.remove('dropTarget','dropInvalid');
    cell.ondrop=e=>{
      e.preventDefault();
      const [lid,slot]=cell.dataset.cell.split('|'),src=draggingRoster;
      if(!validRosterDrop(src,lid,slot)){
        toast(src?.lid&&src.lid!==lid?'Drag players only within the same league':'That player is not eligible for this slot');
        clearDropStyles();return;
      }
      if(src.slot===slot){clearDropStyles();return}
      const l=state.leagues.find(x=>x.id===lid),target=l.roster[slot];
      l.roster[slot]=src.pid;
      if(target)l.roster[src.slot]=target;else delete l.roster[src.slot];
      saveState();draggingRoster=null;renderMatrix();renderLeaders();toast(target?'Players swapped':'Player moved');
    };
  });
}

function bindLeaderUI(){
  $('#matrixViewBtn').onclick=()=>setTrackerView('matrix');
  $('#leadersViewBtn').onclick=()=>setTrackerView('leaders');
  $('#leadersLeagueFilter').onchange=renderLeaders;
  const zero=$('#leadersHideZero');
  if(zero){
    zero.checked=leadersHideZero;
    zero.onchange=e=>{leadersHideZero=!!e.target.checked;localStorage.setItem('fantasyWeekendMatrix.leadersHideZero',String(leadersHideZero));renderLeaders()};
  }
  const gameSelect=$('#leadersGameSelect');
  if(gameSelect)gameSelect.onchange=e=>{
    leadersEventId=e.target.value||'all';
    leadersGameState='all';
    localStorage.setItem('fantasyWeekendMatrix.leadersEventId',leadersEventId);
    localStorage.setItem('fantasyWeekendMatrix.leadersGameState','all');
    renderLeaders();
  };
  applyTrackerView();decorateRosterDrag();renderLeaders();
}

document.addEventListener('DOMContentLoaded',bindLeaderUI);
})();
