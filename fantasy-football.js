/* Fantasy Lens v35 — rich league board, My Team, and split Draft Board / Best Available. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@dcbd931f6c78750dc7e7a47117b781a16d7148a5/fantasy-football.js"><\/script>');

(function(){
  const BOARD_KEY='fantasyLensLeagueDraftBoardV1';
  const LEAGUE_KEY='fantasyLensLeagueSettingsV1';
  const DRAFT_MODE_KEY='fantasyLensDraftMainModeV35';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const readJson=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||'null');return x??f}catch{return f}};
  const writeJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const teamCode=v=>{const t=String(v||'').toUpperCase().trim();return t==='WSH'?'WAS':t==='LA'?'LAR':t};
  const teamLogo=t=>`https://a.espncdn.com/i/teamlogos/nfl/500/${teamCode(t)==='WAS'?'wsh':teamCode(t).toLowerCase()}.png`;
  const headshot=id=>id?`https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(id)}.png`:'';
  let draftMode=localStorage.getItem(DRAFT_MODE_KEY)||'board',renderWrapped=false,importWrapped=false;

  function settings(){return Object.assign({multiPosition:true,flex:['RB','WR','TE'],myTeam:''},readJson(LEAGUE_KEY,{}))}
  function saveSettings(next){writeJson(LEAGUE_KEY,next);syncMainButtons();}
  function board(){return readJson(BOARD_KEY,null)}
  function allPlayers(){return typeof players!=='undefined'&&Array.isArray(players)?players:[]}
  function findPlayer(pick){
    if(pick?.playerId){const hit=allPlayers().find(p=>String(p.id)===String(pick.playerId));if(hit)return hit}
    const n=norm(pick?.display||'');return n?allPlayers().find(p=>norm(p.name)===n):null;
  }
  function ownerMatch(name,b=board()){
    const target=norm(name);if(!target||!b?.owners?.length)return'';
    return b.owners.find(o=>norm(o)===target)||'';
  }

  function addStyles(){
    if(document.querySelector('#fantasyLensV35Styles'))return;
    const s=document.createElement('style');s.id='fantasyLensV35Styles';s.textContent=`
      #leagueDraftMainV35,#myTeamBtnV35{transition:opacity .15s,filter .15s}
      #leagueDraftMainV35.navUnknownV35,#myTeamBtnV35.navUnknownV35{opacity:.38!important;filter:grayscale(1);cursor:not-allowed!important}
      .draftModeTabsV35{display:flex;gap:5px;align-items:center;margin:1px 0 8px}.draftModeTabsV35 .on{background:var(--navy);color:#fff}.draftModeTabsV35 .webHint{margin-left:3px}
      #leagueDraftMainModalV35,#myTeamModalV35{padding:0;background:#0b1721f2}#leagueDraftMainModalV35 .modalbox,#myTeamModalV35 .modalbox{width:100vw;max-width:none;height:100vh;max-height:100vh;margin:0;border-radius:0;display:flex;flex-direction:column;overflow:hidden}#leagueDraftMainModalV35 .careerbody,#myTeamModalV35 .careerbody{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column}
      .leagueBoardToolbarV35{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.leagueBoardToolbarV35 .webHint{margin-left:auto}.leagueBoardWrapV35{flex:1;min-height:0;overflow:auto;border:1px solid var(--line);border-radius:11px;background:#fff}.leagueBoardV35{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%;font-size:9px}.leagueBoardV35 th,.leagueBoardV35 td{min-width:180px;max-width:220px;padding:5px;border-right:1px solid #e8ece9;border-bottom:1px solid #e8ece9;vertical-align:top;text-align:left}.leagueBoardV35 th{position:sticky;top:0;z-index:4;background:#e9eeeb;color:var(--ink)}.leagueBoardV35 th:first-child,.leagueBoardV35 td:first-child{position:sticky;left:0;z-index:3;min-width:65px;width:65px;background:#f8f7f1;font-weight:900}.leagueBoardV35 th:first-child{z-index:6;background:#e9eeeb}.leagueOwnerMineV35{box-shadow:inset 0 -3px 0 var(--cyan);font-weight:950!important}
      .leaguePickV35{border-radius:9px;padding:5px;color:#fff;min-height:50px;display:grid;grid-template-columns:34px minmax(0,1fr) 22px;gap:5px;align-items:center;box-shadow:inset 0 0 0 1px #0001}.leaguePickV35.QB{background:#5967b0}.leaguePickV35.RB{background:#23845f}.leaguePickV35.WR{background:#c46a2b}.leaguePickV35.TE{background:#177f91}.leaguePickV35.K{background:#9a7915}.leaguePickV35.DEF{background:#a64141}.leaguePickV35.OTHER{background:#687684}.leaguePickFaceV35{width:34px;height:34px;border-radius:9px;object-fit:cover;background:#ffffff22}.leaguePickLogoV35{width:21px;height:21px;object-fit:contain;justify-self:end}.leaguePickTextV35{min-width:0}.leaguePickNameV35{display:block;border:0;background:none;color:#fff;padding:0;text-align:left;font:inherit;font-weight:950;font-size:9px;line-height:1.1;cursor:default;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.leaguePickNameV35.clickableV35{cursor:pointer;text-decoration:underline;text-decoration-color:#ffffff66;text-underline-offset:2px}.leaguePickTextV35 small{display:block;font-size:7px;opacity:.9;margin-top:3px}.leagueLegendV35{padding:3px 6px;border-radius:6px;color:#fff;font-size:8px;font-weight:900}
      .myTeamGridV35{overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:7px;padding:2px}.myTeamCardV35{display:grid;grid-template-columns:48px minmax(0,1fr) 30px;gap:8px;align-items:center;border:1px solid var(--line);background:#fff;border-radius:12px;padding:8px}.myTeamCardV35.QB{border-left:5px solid #5967b0}.myTeamCardV35.RB{border-left:5px solid #23845f}.myTeamCardV35.WR{border-left:5px solid #c46a2b}.myTeamCardV35.TE{border-left:5px solid #177f91}.myTeamCardV35.K{border-left:5px solid #9a7915}.myTeamCardV35.DEF{border-left:5px solid #a64141}.myTeamCardV35 .leaguePickFaceV35{width:48px;height:48px}.myTeamCardV35 .leaguePickLogoV35{width:28px;height:28px}.myTeamCardV35 b{display:block;font-size:11px}.myTeamCardV35 small{display:block;color:var(--muted);font-size:8px;margin-top:3px}.myTeamCardV35 button{border:0;background:none;padding:0;text-align:left;color:inherit;cursor:pointer;font:inherit}
      .myTeamSettingV35{margin-top:9px;padding-top:9px;border-top:1px dashed var(--line)}.myTeamSettingV35 label{display:flex;gap:7px;align-items:center;font-size:9px}.myTeamSettingV35 input{min-width:220px;max-width:360px}
      .bestAvailWhoV33.richV35{display:grid!important;grid-template-columns:30px minmax(0,1fr)!important;gap:5px!important;align-items:center!important}.bestAvailMediaV35{position:relative;width:30px;height:30px}.bestAvailMediaV35 .faceV35{width:30px;height:30px;border-radius:8px;object-fit:cover;background:#edf0ed}.bestAvailMediaV35 .logoV35{position:absolute;right:-2px;bottom:-2px;width:13px;height:13px;object-fit:contain;background:#fff;border-radius:50%;padding:1px}.bestAvailTextV35{min-width:0}
      @media(max-width:700px){.leagueBoardV35 th,.leagueBoardV35 td{min-width:160px}.draftModeTabsV35{overflow:auto}.myTeamSettingV35 label{display:block}.myTeamSettingV35 input{width:100%;min-width:0;margin-top:5px}}
    `;document.head.appendChild(s);
  }

  function mainNav(){return document.querySelector('#viewNav')}
  function installMainButtons(){
    const nav=mainNav(),draft=nav?.querySelector('[data-view="draft"]');if(!nav||!draft)return;
    let league=document.querySelector('#leagueDraftMainV35');if(!league){league=document.createElement('button');league.className='btn';league.id='leagueDraftMainV35';league.textContent='League Draft';draft.insertAdjacentElement('afterend',league)}
    let mine=document.querySelector('#myTeamBtnV35');if(!mine){mine=document.createElement('button');mine.className='btn';mine.id='myTeamBtnV35';mine.textContent='My Team';league.insertAdjacentElement('afterend',mine)}
    league.onclick=()=>{if(!league.disabled)openLeagueDraft()};mine.onclick=()=>{if(!mine.disabled)openMyTeam()};syncMainButtons();
  }
  function syncMainButtons(){
    const b=board(),cfg=settings(),league=document.querySelector('#leagueDraftMainV35'),mine=document.querySelector('#myTeamBtnV35'),known=!!(b?.picks?.length&&b?.owners?.length),myOwner=ownerMatch(cfg.myTeam,b);
    if(league){league.disabled=!known;league.classList.toggle('navUnknownV35',!known);league.title=known?`${b.picks.length} owner-tagged picks detected`:'Import owner-tagged draft results to enable'}
    if(mine){const ready=known&&!!myOwner;mine.disabled=!ready;mine.classList.toggle('navUnknownV35',!ready);mine.textContent=myOwner?'My Team':'My Team';mine.title=!known?'Import draft results first':!cfg.myTeam?'Declare your fantasy team in Scoring → League Settings':!myOwner?`Declared team “${cfg.myTeam}” was not found in the imported owners`:`Open ${myOwner}`}
  }

  function ensureDraftModeTabs(){
    const nav=mainNav();if(!nav)return;let box=document.querySelector('#draftModeTabsV35');if(!box){box=document.createElement('div');box.id='draftModeTabsV35';box.className='draftModeTabsV35';box.innerHTML='<button class="btn" data-draft-mode="board">Draft Board</button><button class="btn" data-draft-mode="best">Best Available</button><span class="webHint">Separate board list from Top-10-by-position view</span>';nav.insertAdjacentElement('afterend',box);box.querySelectorAll('[data-draft-mode]').forEach(b=>b.onclick=()=>{draftMode=b.dataset.draftMode;localStorage.setItem(DRAFT_MODE_KEY,draftMode);syncDraftMode()})}
    syncDraftMode();
  }
  function syncDraftMode(){
    const box=document.querySelector('#draftModeTabsV35'),isDraft=typeof currentView==='undefined'||currentView==='draft';if(box)box.style.display=isDraft?'flex':'none';if(!isDraft)return;
    box?.querySelectorAll('[data-draft-mode]').forEach(b=>b.classList.toggle('on',b.dataset.draftMode===draftMode));
    const best=document.querySelector('#bestStrip'),table=document.querySelector('#tablewrap'),cards=document.querySelector('#cards'),status=document.querySelector('.status'),empty=document.querySelector('#empty');
    if(best)best.style.display=draftMode==='best'?'block':'none';if(table)table.style.display=draftMode==='best'?'none':'';if(cards)cards.style.display=draftMode==='best'?'none':'';if(status)status.style.display=draftMode==='best'?'none':'';if(empty)empty.style.display=draftMode==='best'?'none':'';
    if(draftMode==='best')decorateBestAvailable();
  }

  function pickHtml(p){
    if(!p)return'';const player=findPlayer(p),clickable=!!(player&&typeof career==='function'),pid=player?.id||p.playerId||'',face=pid?headshot(pid):'',logo=teamLogo(p.nflTeam),pos=['QB','RB','WR','TE','K','DEF'].includes(p.pos)?p.pos:'OTHER';
    return `<div class="leaguePickV35 ${pos}">${face?`<img class="leaguePickFaceV35" src="${face}" onerror="this.style.visibility='hidden'">`:'<div class="leaguePickFaceV35"></div>'}<div class="leaguePickTextV35"><button class="leaguePickNameV35 ${clickable?'clickableV35':''}" ${clickable?`data-profile-id="${esc(pid)}"`:''}>${esc(p.display)}</button><small>${esc(p.nflTeam)} · ${p.pos==='DEF'?'D/ST':esc(p.pos)}${p.slot!=null?' · pick '+p.slot:''}</small></div><img class="leaguePickLogoV35" src="${logo}" onerror="this.style.visibility='hidden'"></div>`;
  }
  function bindProfiles(root){root?.querySelectorAll('[data-profile-id]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.profileId;if(id&&typeof career==='function')career(id)})}

  function ensureLeagueModal(){
    let m=document.querySelector('#leagueDraftMainModalV35');if(m)return m;m=document.createElement('div');m.className='modal';m.id='leagueDraftMainModalV35';m.innerHTML=`<div class="modalbox"><div class="modalhead"><div><h2>League Draft Board</h2><small style="color:#aebdca">Imported fantasy-team ownership · position coded</small></div><button class="btn close" id="closeLeagueDraftMainV35">×</button></div><div class="careerbody"><div class="leagueBoardToolbarV35"><div><span class="leagueLegendV35" style="background:#5967b0">QB</span> <span class="leagueLegendV35" style="background:#23845f">RB</span> <span class="leagueLegendV35" style="background:#c46a2b">WR</span> <span class="leagueLegendV35" style="background:#177f91">TE</span> <span class="leagueLegendV35" style="background:#9a7915">K</span> <span class="leagueLegendV35" style="background:#a64141">D/ST</span></div><span class="webHint" id="leagueDraftMainStatusV35"></span></div><div class="leagueBoardWrapV35" id="leagueDraftMainWrapV35"></div></div></div>`;document.body.appendChild(m);document.querySelector('#closeLeagueDraftMainV35').onclick=()=>m.classList.remove('open');m.onclick=e=>{if(e.target===m)m.classList.remove('open')};return m;
  }
  function renderLeagueDraft(){
    const b=board(),root=document.querySelector('#leagueDraftMainWrapV35'),status=document.querySelector('#leagueDraftMainStatusV35');if(!root)return;if(!b?.picks?.length||!b?.owners?.length){root.innerHTML='<div class="leagueBoardEmpty">No owner-tagged draft results are available.</div>';if(status)status.textContent='No ownership data';return}
    const my=ownerMatch(settings().myTeam,b),rounds=[...new Set(b.picks.map(p=>Number(p.round)||1))].sort((a,b)=>a-b),by=new Map();for(const p of b.picks)by.set(`${Number(p.round)||1}|${p.owner}`,p);
    root.innerHTML=`<table class="leagueBoardV35"><thead><tr><th>Round</th>${b.owners.map(o=>`<th class="${o===my?'leagueOwnerMineV35':''}">${o===my?'★ ':''}${esc(o)}</th>`).join('')}</tr></thead><tbody>${rounds.map(r=>`<tr><td>R${r}</td>${b.owners.map(o=>`<td>${pickHtml(by.get(`${r}|${o}`))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;bindProfiles(root);if(status)status.textContent=`${b.picks.length} picks · ${b.owners.length} fantasy teams${my?' · ★ '+my:''}`;
  }
  function openLeagueDraft(){const m=ensureLeagueModal();renderLeagueDraft();m.classList.add('open')}

  function ensureMyTeamModal(){
    let m=document.querySelector('#myTeamModalV35');if(m)return m;m=document.createElement('div');m.className='modal';m.id='myTeamModalV35';m.innerHTML=`<div class="modalbox"><div class="modalhead"><div><h2 id="myTeamTitleV35">My Team</h2><small style="color:#aebdca">Roster reconstructed from imported draft results</small></div><button class="btn close" id="closeMyTeamV35">×</button></div><div class="careerbody"><div class="careerstatus" id="myTeamStatusV35"></div><div class="myTeamGridV35" id="myTeamGridV35"></div></div></div>`;document.body.appendChild(m);document.querySelector('#closeMyTeamV35').onclick=()=>m.classList.remove('open');m.onclick=e=>{if(e.target===m)m.classList.remove('open')};return m;
  }
  function renderMyTeam(){
    const b=board(),cfg=settings(),owner=ownerMatch(cfg.myTeam,b),root=document.querySelector('#myTeamGridV35'),status=document.querySelector('#myTeamStatusV35'),title=document.querySelector('#myTeamTitleV35');if(!root)return;if(title)title.textContent=owner?`My Team — ${owner}`:'My Team';
    if(!owner){root.innerHTML='<div class="leagueBoardEmpty">Declare your fantasy team name in Scoring → League Settings after importing draft results.</div>';if(status)status.textContent='No matching team declared';return}
    const picks=b.picks.filter(p=>p.owner===owner).sort((a,b)=>(Number(a.round)||99)-(Number(b.round)||99)||(Number(a.slot)||99)-(Number(b.slot)||99));root.innerHTML=picks.map(p=>{const player=findPlayer(p),pid=player?.id||p.playerId||'',face=pid?headshot(pid):'',clickable=!!(pid&&typeof career==='function'),pos=['QB','RB','WR','TE','K','DEF'].includes(p.pos)?p.pos:'OTHER';return `<article class="myTeamCardV35 ${pos}">${face?`<img class="leaguePickFaceV35" src="${face}" onerror="this.style.visibility='hidden'">`:'<div class="leaguePickFaceV35"></div>'}<div>${clickable?`<button data-profile-id="${esc(pid)}"><b>${esc(p.display)}</b></button>`:`<b>${esc(p.display)}</b>`}<small>Round ${p.round||'—'}${p.slot!=null?' · pick '+p.slot:''} · ${p.pos==='DEF'?'D/ST':esc(p.pos)} · ${esc(p.nflTeam)}</small></div><img class="leaguePickLogoV35" src="${teamLogo(p.nflTeam)}" onerror="this.style.visibility='hidden'"></article>`}).join('')||'<div class="leagueBoardEmpty">No picks found for this team.</div>';bindProfiles(root);if(status)status.textContent=`${picks.length} drafted roster slot${picks.length===1?'':'s'} detected`;
  }
  function openMyTeam(){const m=ensureMyTeamModal();renderMyTeam();m.classList.add('open')}

  function injectMyTeamSetting(){
    const box=document.querySelector('#leagueSettingsV34');if(!box)return;let sec=document.querySelector('#myTeamSettingV35');if(sec)sec.remove();const b=board(),cfg=settings();sec=document.createElement('div');sec.id='myTeamSettingV35';sec.className='myTeamSettingV35';sec.innerHTML=`<label><b>My fantasy team:</b><input class="field" id="myTeamNameV35" list="myTeamOwnersV35" placeholder="Choose / type imported team name" value="${esc(cfg.myTeam||'')}"><datalist id="myTeamOwnersV35">${(b?.owners||[]).map(o=>`<option value="${esc(o)}"></option>`).join('')}</datalist></label><div class="webHint" style="margin-top:5px">Used by the My Team button and ★ highlight on the League Draft board.</div>`;box.appendChild(sec);const input=document.querySelector('#myTeamNameV35');input.onchange=input.onblur=()=>{const n=settings();n.myTeam=input.value.trim();saveSettings(n);renderLeagueDraft();renderMyTeam()};
  }
  function wrapSettings(){const b=document.querySelector('#settingsBtn');if(!b||b.dataset.v35Settings==='1')return;b.dataset.v35Settings='1';const old=b.onclick;b.onclick=function(e){const out=old?.call(this,e);setTimeout(injectMyTeamSetting,0);setTimeout(injectMyTeamSetting,120);return out};setTimeout(injectMyTeamSetting,0)}

  function wrapImport(){
    const b=document.querySelector('#parseDraftBtn');if(!b||b.dataset.v35Import==='1')return;b.dataset.v35Import='1';const old=b.onclick;b.onclick=async function(e){const out=old?.call(this,e);try{await Promise.resolve(out)}finally{setTimeout(()=>{syncMainButtons();injectMyTeamSetting()},30)}return out};importWrapped=true;
  }

  function decorateBestAvailable(){
    const root=document.querySelector('#bestStrip');if(!root)return;root.querySelectorAll('.bestAvailWhoV33').forEach(who=>{
      if(who.classList.contains('richV35'))return;const b=who.querySelector('b'),small=who.querySelector('small');if(!b||!small)return;const p=allPlayers().find(x=>norm(x.name)===norm(b.textContent)),team=teamCode((small.textContent.match(/^([A-Z]{2,3})\b/)||[])[1]||p?.team||'');
      const text=document.createElement('div');text.className='bestAvailTextV35';text.appendChild(b);text.appendChild(small);const media=document.createElement('span');media.className='bestAvailMediaV35';media.innerHTML=`${p?`<img class="faceV35" src="${headshot(p.id)}" onerror="this.style.visibility='hidden'">`:'<span class="faceV35"></span>'}${team?`<img class="logoV35" src="${teamLogo(team)}" onerror="this.style.visibility='hidden'">`:''}`;who.innerHTML='';who.appendChild(media);who.appendChild(text);who.classList.add('richV35');
    });
    syncDraftMode();
  }

  function wrapRender(){
    if(renderWrapped||typeof window.render!=='function')return;const old=window.render;window.render=function(){const out=old.apply(this,arguments);setTimeout(()=>{ensureDraftModeTabs();decorateBestAvailable();syncMainButtons()},0);return out};renderWrapped=true;
  }
  function observeBest(){const root=document.querySelector('#bestStrip');if(!root||root.dataset.v35Observed==='1')return;root.dataset.v35Observed='1';new MutationObserver(()=>setTimeout(decorateBestAvailable,0)).observe(root,{childList:true,subtree:true})}

  function activate(){
    addStyles();installMainButtons();ensureDraftModeTabs();wrapSettings();wrapImport();wrapRender();observeBest();injectMyTeamSetting();decorateBestAvailable();syncMainButtons();syncDraftMode();
    setTimeout(()=>{installMainButtons();wrapSettings();wrapImport();wrapRender();observeBest();injectMyTeamSetting();decorateBestAvailable();syncMainButtons();syncDraftMode()},800);
  }
  window.addEventListener('load',()=>{setTimeout(activate,650);setTimeout(activate,1500)});
})();