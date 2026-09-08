/* Fantasy Lens v34 — smart league draft board + configurable FLEX/multi-position filters. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@ceecdf0d804da6952f73c06eb2fe07392c9c913f/fantasy-football.js"><\/script>');

(function(){
  const BOARD_KEY='fantasyLensLeagueDraftBoardV1';
  const POS_KEY='fantasyLensPositionSelectionV1';
  const LEAGUE_KEY='fantasyLensLeagueSettingsV1';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const readJson=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||'null');return x??f}catch{return f}};
  const writeJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const teamCode=v=>{const t=String(v||'').toUpperCase().trim();return t==='WSH'?'WAS':t==='LA'?'LAR':t};
  let originalFiltered=null,filtersInstalled=false,importWrapped=false;

  function leagueSettings(){return Object.assign({multiPosition:true,flex:['RB','WR','TE']},readJson(LEAGUE_KEY,{}))}
  function posSelection(){const x=readJson(POS_KEY,[]);return Array.isArray(x)?x.filter(p=>['QB','RB','WR','TE'].includes(p)):[]}
  function savePosSelection(a){writeJson(POS_KEY,[...new Set(a)].filter(p=>['QB','RB','WR','TE'].includes(p)))}

  function addStyles(){
    if(document.querySelector('#fantasyLensV34Styles'))return;
    const s=document.createElement('style');s.id='fantasyLensV34Styles';s.textContent=`
      #leagueDraftBoardModal{padding:0;background:#0b1721f2}#leagueDraftBoardModal .modalbox{width:100vw;max-width:none;height:100vh;max-height:100vh;margin:0;border-radius:0;display:flex;flex-direction:column;overflow:hidden}#leagueDraftBoardModal .careerbody{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
      .leagueBoardToolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.leagueBoardToolbar .webHint{margin-left:auto}.leagueBoardWrap{flex:1;min-height:0;overflow:auto;border:1px solid var(--line);border-radius:11px;background:#fff}.leagueBoard{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%;font-size:9px}.leagueBoard th,.leagueBoard td{min-width:145px;max-width:190px;padding:5px;border-right:1px solid #e8ece9;border-bottom:1px solid #e8ece9;vertical-align:top;text-align:left}.leagueBoard th{position:sticky;top:0;z-index:4;background:#e9eeeb;color:var(--ink)}.leagueBoard th:first-child,.leagueBoard td:first-child{position:sticky;left:0;z-index:3;min-width:65px;width:65px;background:#f8f7f1;font-weight:900}.leagueBoard th:first-child{z-index:6;background:#e9eeeb}.leaguePick{border-radius:8px;padding:5px 6px;color:#fff;min-height:40px;box-shadow:inset 0 0 0 1px #0001}.leaguePick b{display:block;font-size:9px;line-height:1.1}.leaguePick small{display:block;font-size:7px;opacity:.9;margin-top:3px}.leaguePick.QB{background:#5967b0}.leaguePick.RB{background:#23845f}.leaguePick.WR{background:#c46a2b}.leaguePick.TE{background:#177f91}.leaguePick.K{background:#9a7915}.leaguePick.DEF{background:#a64141}.leaguePick.OTHER{background:#687684}.leagueBoardLegend{display:flex;gap:5px;flex-wrap:wrap}.leagueLegend{padding:3px 6px;border-radius:6px;color:#fff;font-size:8px;font-weight:900}.leagueBoardEmpty{padding:30px;text-align:center;color:var(--muted)}
      .positions .btn.posMultiOnV34{background:#fff!important;box-shadow:0 1px 4px #0002!important;color:var(--ink)!important}.positions .btn#flexPosV34{border-left:1px solid #cfd6d2!important}.leagueSettingsV34{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.leagueSettingsV34 h3{margin:0 0 7px;font-size:12px}.leagueSettingRow{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:7px 0}.leagueSettingRow label{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--ink)}.leagueSettingRow input{accent-color:var(--cyan)}
    `;document.head.appendChild(s);
  }

  function playerLookup(){
    const ps=(typeof players!=='undefined'?players:[]);
    return ps.map(p=>({p,t:norm(p.name).split(' ').filter(Boolean)})).sort((a,b)=>b.t.length-a.t.length);
  }
  function canonicalName(raw){
    let x=String(raw||'').trim();
    if(x.includes(',')){const i=x.indexOf(','),last=x.slice(0,i).trim(),first=x.slice(i+1).trim();if(first&&last)x=`${first} ${last}`}
    return x.replace(/\s+/g,' ').trim();
  }
  function parseLeagueBoard(text){
    const lookup=playerLookup(),picks=[],owners=new Map();let round=null,seq=0;
    for(const raw of String(text||'').split(/\r?\n/)){
      const line=raw.trim();if(!line)continue;
      const rh=line.match(/^round\s+(\d+)\s*$/i);if(rh){round=Number(rh[1]);continue}
      let m=line.match(/^\((\d+)\)\s*(.+?)\s+-\s+(.+?)\s*\(([A-Za-z]{2,3})\s*-\s*(QB|RB|WR|TE|K|DEF)\)\s*$/i);
      if(!m)m=line.match(/^(?:\d+\.?\s*)?(.+?)\s+-\s+(.+?)\s*\(([A-Za-z]{2,3})\s*-\s*(QB|RB|WR|TE|K|DEF)\)\s*$/i)?.map((x,i)=>i===1?'':x);
      if(!m)continue;
      const slot=Number(m[1])||null,owner=String(m[2]||'').trim(),rawName=String(m[3]||'').trim(),nflTeam=teamCode(m[4]),pos=String(m[5]||'').toUpperCase();if(!owner||!rawName)continue;
      let display=canonicalName(rawName),playerId=null;
      if(pos==='DEF'){display=`${nflTeam} D/ST`}
      else if(pos!=='K'){
        const tokens=new Set(norm(rawName).split(' ').filter(Boolean)),hit=lookup.find(x=>x.t.length>=2&&x.t.every(t=>tokens.has(t)));if(hit){display=hit.p.name;playerId=String(hit.p.id)}
      }
      seq++;picks.push({round:round||null,slot,seq,owner,display,pos,nflTeam,playerId});
      if(!owners.has(owner))owners.set(owner,{owner,firstSlot:slot??999,firstSeq:seq});else if(round===1&&slot!=null)owners.get(owner).firstSlot=Math.min(owners.get(owner).firstSlot,slot);
    }
    const ownerList=[...owners.values()].sort((a,b)=>a.firstSlot-b.firstSlot||a.firstSeq-b.firstSeq||a.owner.localeCompare(b.owner)).map(x=>x.owner);
    const maxRound=Math.max(0,...picks.map(p=>p.round||0));
    return{version:1,createdAt:Date.now(),owners:ownerList,picks,maxRound,sourceLines:String(text||'').split(/\r?\n/).length};
  }
  function saveLeagueBoardFromImport(){
    const text=document.querySelector('#draftImportText')?.value||'',board=parseLeagueBoard(text);if(board.picks.length)writeJson(BOARD_KEY,board);return board;
  }

  function ensureBoardModal(){
    let m=document.querySelector('#leagueDraftBoardModal');if(m)return m;
    m=document.createElement('div');m.className='modal';m.id='leagueDraftBoardModal';m.innerHTML=`<div class="modalbox"><div class="modalhead"><div><h2>League Draft Board</h2><small style="color:#aebdca">Smart owner detection from imported round-by-round results</small></div><button class="btn close" id="closeLeagueBoardV34">×</button></div><div class="careerbody"><div class="leagueBoardToolbar"><button class="btn" id="refreshLeagueBoardV34">Re-read Import Text</button><div class="leagueBoardLegend"><span class="leagueLegend" style="background:#5967b0">QB</span><span class="leagueLegend" style="background:#23845f">RB</span><span class="leagueLegend" style="background:#c46a2b">WR</span><span class="leagueLegend" style="background:#177f91">TE</span><span class="leagueLegend" style="background:#9a7915">K</span><span class="leagueLegend" style="background:#a64141">D/ST</span></div><span class="webHint" id="leagueBoardStatusV34"></span></div><div class="leagueBoardWrap" id="leagueBoardWrapV34"></div></div></div>`;document.body.appendChild(m);
    document.querySelector('#closeLeagueBoardV34').onclick=()=>m.classList.remove('open');m.onclick=e=>{if(e.target===m)m.classList.remove('open')};document.querySelector('#refreshLeagueBoardV34').onclick=()=>{const b=saveLeagueBoardFromImport();renderLeagueBoard(b)};return m;
  }
  function renderLeagueBoard(board=readJson(BOARD_KEY,null)){
    const root=document.querySelector('#leagueBoardWrapV34'),status=document.querySelector('#leagueBoardStatusV34');if(!root)return;
    if(!board?.picks?.length||!board?.owners?.length){root.innerHTML='<div class="leagueBoardEmpty"><b>No team ownership detected yet.</b><br>Paste round-by-round draft results where lines look like “(5) Team Name - Player, First (NFL - POS)”, then import or click Re-read Import Text.</div>';if(status)status.textContent='0 owner-tagged picks';return}
    const rounds=[...new Set(board.picks.map(p=>p.round).filter(Boolean))].sort((a,b)=>a-b);if(!rounds.length)rounds.push(1);
    const by=new Map();for(const p of board.picks){const r=p.round||1;by.set(`${r}|${p.owner}`,p)}
    const cell=p=>p?`<div class="leaguePick ${['QB','RB','WR','TE','K','DEF'].includes(p.pos)?p.pos:'OTHER'}"><b>${esc(p.display)}</b><small>${esc(p.nflTeam)} · ${p.pos==='DEF'?'D/ST':esc(p.pos)}${p.slot!=null?' · slot '+p.slot:''}</small></div>`:'';
    root.innerHTML=`<table class="leagueBoard"><thead><tr><th>Round</th>${board.owners.map(o=>`<th>${esc(o)}</th>`).join('')}</tr></thead><tbody>${rounds.map(r=>`<tr><td>R${r}</td>${board.owners.map(o=>`<td>${cell(by.get(`${r}|${o}`))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    if(status)status.textContent=`${board.picks.length} owner-tagged picks · ${board.owners.length} fantasy teams · ${rounds.length} rounds detected`;
  }
  function openLeagueBoard(){const m=ensureBoardModal(),fresh=saveLeagueBoardFromImport(),stored=readJson(BOARD_KEY,null);renderLeagueBoard(fresh.picks.length?fresh:stored);m.classList.add('open')}
  function installBoardButton(){
    const actions=document.querySelector('.draftImportActions');if(!actions)return;let b=document.querySelector('#leagueBoardBtnV34');if(!b){b=document.createElement('button');b.className='btn';b.id='leagueBoardBtnV34';b.textContent='League Draft Board';actions.insertBefore(b,document.querySelector('#draftImportCount')||null)}b.onclick=openLeagueBoard;
  }
  function wrapImport(){
    const b=document.querySelector('#parseDraftBtn');if(!b||b.dataset.v34Wrapped==='1')return;b.dataset.v34Wrapped='1';const old=b.onclick;b.onclick=async function(e){const out=old?.call(this,e);try{await Promise.resolve(out)}finally{const board=saveLeagueBoardFromImport();const status=document.querySelector('#draftImportStatus');if(status&&board.picks.length)status.textContent+=`\n\nLeague board: detected ${board.picks.length} picks across ${board.owners.length} fantasy teams.`}return out};importWrapped=true;
  }

  function ensureLeagueSettings(){
    const body=document.querySelector('#settingsModal .careerbody');if(!body)return;let box=document.querySelector('#leagueSettingsV34');if(!box){box=document.createElement('section');box.id='leagueSettingsV34';box.className='leagueSettingsV34';body.appendChild(box)}
    const s=leagueSettings();box.innerHTML=`<h3>League Settings</h3><div class="leagueSettingRow"><label><input type="checkbox" id="multiPosV34" ${s.multiPosition?'checked':''}> Allow multi-select position filters</label></div><div class="webHint">Click QB/RB/WR/TE to combine positions. ALL clears the selection. FLEX selects the positions enabled below.</div><div class="leagueSettingRow"><b style="font-size:9px">FLEX includes:</b>${['QB','RB','WR','TE'].map(p=>`<label><input type="checkbox" data-flex-pos="${p}" ${s.flex.includes(p)?'checked':''}> ${p}</label>`).join('')}</div>`;
    box.querySelector('#multiPosV34').onchange=e=>{const n=leagueSettings();n.multiPosition=e.target.checked;writeJson(LEAGUE_KEY,n);installPositionFilters(true)};
    box.querySelectorAll('[data-flex-pos]').forEach(x=>x.onchange=()=>{const n=leagueSettings();n.flex=[...box.querySelectorAll('[data-flex-pos]:checked')].map(y=>y.dataset.flexPos);if(!n.flex.length)n.flex=['RB','WR','TE'];writeJson(LEAGUE_KEY,n);syncPositionButtons()});
  }

  function selectedSet(){return new Set(posSelection())}
  function applyPosChoice(pos){
    const cfg=leagueSettings();let sel=selectedSet();
    if(pos==='ALL'){sel.clear()}
    else if(pos==='FLEX'){sel=new Set(cfg.flex)}
    else if(cfg.multiPosition){sel.has(pos)?sel.delete(pos):sel.add(pos)}
    else{sel=new Set([pos])}
    savePosSelection([...sel]);if(typeof state!=='undefined')state.pos='ALL';syncPositionButtons();if(typeof render==='function')render();
  }
  function syncPositionButtons(){
    const root=document.querySelector('#positions');if(!root)return;const sel=selectedSet(),cfg=leagueSettings();
    root.querySelectorAll('[data-pos]').forEach(b=>{const p=b.dataset.pos;b.classList.remove('on');b.classList.toggle('posMultiOnV34',p==='ALL'?sel.size===0:sel.has(p))});
    const flex=root.querySelector('#flexPosV34');if(flex){const fs=new Set(cfg.flex),on=sel.size===fs.size&&[...fs].every(x=>sel.has(x));flex.classList.toggle('posMultiOnV34',on)}
  }
  function installPositionFilters(force=false){
    const root=document.querySelector('#positions');if(!root)return;if(!originalFiltered&&typeof window.filtered==='function')originalFiltered=window.filtered;
    if(originalFiltered&&!filtersInstalled){
      window.filtered=function(){const prev=typeof state!=='undefined'?state.pos:'ALL';if(typeof state!=='undefined')state.pos='ALL';let rows=originalFiltered();if(typeof state!=='undefined')state.pos=prev;const sel=selectedSet();return sel.size?rows.filter(p=>sel.has(p.pos)):rows};filtersInstalled=true;
    }
    if(!root.querySelector('#flexPosV34')){const b=document.createElement('button');b.type='button';b.className='btn';b.id='flexPosV34';b.dataset.pos='FLEX';b.textContent='FLEX';root.appendChild(b)}
    root.onclick=e=>{const b=e.target.closest('[data-pos]');if(!b||!root.contains(b))return;e.preventDefault();e.stopPropagation();applyPosChoice(b.dataset.pos)};
    if(typeof state!=='undefined')state.pos='ALL';syncPositionButtons();
  }

  function activate(){
    addStyles();installBoardButton();wrapImport();ensureLeagueSettings();installPositionFilters();
    setTimeout(()=>{installBoardButton();if(!importWrapped||document.querySelector('#parseDraftBtn')?.dataset.v34Wrapped!=='1')wrapImport();ensureLeagueSettings();installPositionFilters();syncPositionButtons()},900);
  }
  window.addEventListener('load',()=>{setTimeout(activate,1500);setTimeout(activate,2600)});
})();
