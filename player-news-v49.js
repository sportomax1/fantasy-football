/* Fantasy Lens v49 — ESPN player news on hover + player profile. */
(function(){
  'use strict';

  const NEWS_TTL=15*60*1000;
  const RESOLVE_TTL=7*24*60*60*1000;
  const CACHE_PREFIX='fantasyLensEspnNewsV49:';
  const ID_PREFIX='fantasyLensEspnIdV49:';
  let hoverTimer=null,hoverPlayer=null,lastPointer={x:0,y:0};

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const playersList=()=>typeof players!=='undefined'&&Array.isArray(players)?players:[];
  const playerId=p=>String(p?.id??p?.player_id??p?.playerId??'');
  const playerName=p=>p?.name||p?.full_name||p?.displayName||p?.player_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||'Unknown';
  const playerTeam=p=>String(p?.team||p?.teamAbbr||p?.proTeam||p?.proTeamAbbreviation||'').toUpperCase();
  const playerPos=p=>String(p?.pos||p?.position||p?.positionAbbr||'').toUpperCase();

  function read(key){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x&&typeof x==='object'?x:null}catch{return null}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}

  function numericEspnId(p){
    const candidates=[p?.espnId,p?.espn_id,p?.espnID,p?.athleteId,p?.athlete_id,p?.id];
    for(const v of candidates){const s=String(v??'');if(/^\d{4,}$/.test(s))return s}
    return'';
  }

  function findPlayer(textOrEl){
    const el=textOrEl instanceof Element?textOrEl:null;
    if(el){
      const stored=el.dataset?.v42||el.dataset?.playerId||el.closest?.('[data-v42]')?.dataset?.v42;
      if(stored){const p=playersList().find(x=>playerId(x)===String(stored));if(p)return p}
    }
    const text=typeof textOrEl==='string'?textOrEl:(el?.textContent||'');
    const n=norm(text);if(!n)return null;
    const candidates=playersList().filter(p=>playerName(p).length>=4).sort((a,b)=>playerName(b).length-playerName(a).length);
    return candidates.find(p=>n.includes(norm(playerName(p))))||null;
  }

  function extractEspnIdFromSearch(data,name){
    const target=norm(name),seen=new Set(),queue=[data];let fallback='';
    while(queue.length){
      const x=queue.shift();
      if(!x||typeof x!=='object'||seen.has(x))continue;seen.add(x);
      if(Array.isArray(x)){queue.push(...x);continue}
      const label=norm(x.displayName||x.name||x.title||x.shortName||'');
      const fields=[x.id,x.athleteId,x.uid,x.href,x.url,x.link,x.$ref];
      for(const raw of fields){
        const s=String(raw??'');
        const m=s.match(/(?:athletes\/|athlete\/|~a\/)(\d{4,})/i)||s.match(/^\d{4,}$/);
        const id=m?(m[1]||m[0]):'';
        if(id){if(label&&target&&(label===target||label.includes(target)||target.includes(label)))return id;if(!fallback)fallback=id}
      }
      queue.push(...Object.values(x));
    }
    return fallback;
  }

  async function resolveEspnId(p){
    const direct=numericEspnId(p);if(direct)return direct;
    const key=ID_PREFIX+norm(playerName(p));const cached=read(key);
    if(cached?.id&&Date.now()-Number(cached.at||0)<RESOLVE_TTL)return String(cached.id);
    try{
      const u=`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(playerName(p))}&sport=football&limit=10`;
      const r=await fetch(u);if(!r.ok)throw new Error(`ESPN search ${r.status}`);
      const j=await r.json(),id=extractEspnIdFromSearch(j,playerName(p));
      if(id)write(key,{id,at:Date.now()});
      return id||'';
    }catch{return''}
  }

  function articleLink(a){return a?.links?.web?.href||a?.links?.api?.news?.href||a?.link||a?.url||''}
  function articleImage(a){return a?.images?.[0]?.url||a?.image?.url||''}
  function articleDate(a){return a?.published||a?.lastModified||a?.date||a?.created||''}
  function normalizeArticles(j){
    const a=Array.isArray(j?.articles)?j.articles:Array.isArray(j?.news)?j.news:Array.isArray(j?.feed)?j.feed:[];
    return a.map(x=>({
      headline:x?.headline||x?.title||x?.name||'ESPN update',
      description:x?.description||x?.summary||x?.story||'',
      published:articleDate(x),
      href:articleLink(x),
      image:articleImage(x)
    })).filter(x=>x.headline);
  }

  async function newsFor(p,limit=6){
    const espnId=await resolveEspnId(p);if(!espnId)return{espnId:'',articles:[],error:'No ESPN athlete ID'};
    const key=CACHE_PREFIX+espnId,cached=read(key);
    if(cached?.articles&&Date.now()-Number(cached.at||0)<NEWS_TTL)return{espnId,articles:cached.articles.slice(0,limit),cached:true};
    try{
      const u=`https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${encodeURIComponent(espnId)}/news?limit=${Math.max(1,limit)}`;
      const r=await fetch(u);if(!r.ok)throw new Error(`ESPN news ${r.status}`);
      const j=await r.json(),articles=normalizeArticles(j);
      write(key,{at:Date.now(),articles});
      return{espnId,articles:articles.slice(0,limit),cached:false};
    }catch(e){return{espnId,articles:cached?.articles?.slice(0,limit)||[],error:String(e?.message||e)}}
  }

  function relativeTime(v){
    const t=Date.parse(v);if(!Number.isFinite(t))return'';
    const d=Math.max(0,Date.now()-t),m=Math.floor(d/60000);
    if(m<1)return'just now';if(m<60)return`${m}m ago`;
    const h=Math.floor(m/60);if(h<24)return`${h}h ago`;
    const days=Math.floor(h/24);if(days<30)return`${days}d ago`;
    return new Date(t).toLocaleDateString();
  }

  function installCss(){
    if(document.querySelector('#playerNewsStylesV49'))return;
    const s=document.createElement('style');s.id='playerNewsStylesV49';s.textContent=`
      #playerNewsHoverV49{position:fixed;z-index:5000;width:min(390px,calc(100vw - 20px));background:#10283b;color:#f7fbfd;border:1px solid #ffffff24;border-radius:12px;box-shadow:0 14px 42px #0006;padding:10px;pointer-events:none;display:none;font-size:9px}
      #playerNewsHoverV49.open{display:block}.newsHoverHeadV49{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px}.newsHoverHeadV49 b{font-size:11px}.newsEspnV49{font-size:7px;font-weight:900;color:#8fd3ff;letter-spacing:.04em}.newsHoverItemV49{border-top:1px solid #ffffff18;padding-top:6px;margin-top:6px}.newsHoverItemV49:first-of-type{border-top:0;margin-top:0;padding-top:0}.newsHoverItemV49 strong{display:block;font-size:9px;line-height:1.35}.newsHoverItemV49 small{display:block;color:#b6c5cf;font-size:7px;margin-top:2px}.newsHoverDescV49{color:#dbe5eb;font-size:8px;line-height:1.35;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      #careerNewsV49{margin:10px 0 2px;border:1px solid var(--line);border-radius:11px;background:#fff;overflow:hidden}.careerNewsHeadV49{display:flex;justify-content:space-between;align-items:center;padding:9px 10px;background:#f4f7f5;border-bottom:1px solid var(--line)}.careerNewsHeadV49 h3{margin:0;font-size:11px}.careerNewsListV49{display:grid}.careerNewsItemV49{display:grid;grid-template-columns:70px minmax(0,1fr);gap:9px;padding:9px 10px;border-top:1px solid #edf0ed;text-decoration:none;color:inherit}.careerNewsItemV49:first-child{border-top:0}.careerNewsItemV49:hover{background:#f8faf8}.careerNewsItemV49 img{width:70px;height:48px;object-fit:cover;border-radius:7px;background:#edf0ed}.careerNewsItemV49.noimg{grid-template-columns:1fr}.careerNewsItemV49 b{font-size:10px;line-height:1.35}.careerNewsItemV49 p{margin:3px 0 0;font-size:8px;color:var(--muted);line-height:1.4}.careerNewsMetaV49{font-size:7px;color:#71808a;margin-top:4px}.careerNewsEmptyV49{padding:12px;color:var(--muted);font-size:9px}
      @media(max-width:650px){#playerNewsHoverV49{display:none!important}.careerNewsItemV49{grid-template-columns:56px minmax(0,1fr)}.careerNewsItemV49 img{width:56px;height:44px}}
    `;document.head.appendChild(s);
  }

  function hoverBox(){
    let b=document.querySelector('#playerNewsHoverV49');if(b)return b;
    b=document.createElement('div');b.id='playerNewsHoverV49';document.body.appendChild(b);return b;
  }
  function positionHover(){
    const b=hoverBox(),pad=12,w=b.offsetWidth||390,h=b.offsetHeight||160;
    let x=lastPointer.x+14,y=lastPointer.y+14;
    if(x+w>innerWidth-pad)x=Math.max(pad,lastPointer.x-w-14);
    if(y+h>innerHeight-pad)y=Math.max(pad,lastPointer.y-h-14);
    b.style.left=`${x}px`;b.style.top=`${y}px`;
  }
  function hideHover(){clearTimeout(hoverTimer);hoverPlayer=null;hoverBox().classList.remove('open')}
  function hoverLoading(p){const b=hoverBox();b.innerHTML=`<div class="newsHoverHeadV49"><b>${esc(playerName(p))}</b><span class="newsEspnV49">ESPN NEWS</span></div><div class="newsHoverDescV49">Loading latest player news…</div>`;b.classList.add('open');positionHover()}
  async function showHover(p){
    if(!p)return;hoverPlayer=playerId(p)||playerName(p);hoverLoading(p);
    const token=hoverPlayer,res=await newsFor(p,3);if(token!==hoverPlayer)return;
    const b=hoverBox(),a=res.articles||[];
    b.innerHTML=`<div class="newsHoverHeadV49"><b>${esc(playerName(p))} · ${esc(playerPos(p))} ${esc(playerTeam(p))}</b><span class="newsEspnV49">ESPN NEWS</span></div>${a.length?a.slice(0,2).map(x=>`<div class="newsHoverItemV49"><strong>${esc(x.headline)}</strong><small>${esc(relativeTime(x.published))}</small>${x.description?`<div class="newsHoverDescV49">${esc(x.description)}</div>`:''}</div>`).join(''):`<div class="newsHoverDescV49">No recent ESPN player-specific stories found.</div>`}`;
    b.classList.add('open');positionHover();
  }

  function hoverTarget(el){return el?.closest?.('#tablewrap tbody tr,#cards > *,#bestStrip tr,.dashPlayerV39,.splitPersonV41,.v42qrow,.commandRowV39')||null}
  function installHover(){
    document.addEventListener('mousemove',e=>{lastPointer={x:e.clientX,y:e.clientY};if(hoverBox().classList.contains('open'))positionHover()},{passive:true});
    document.addEventListener('mouseover',e=>{
      const target=hoverTarget(e.target);if(!target)return;
      if(e.relatedTarget&&target.contains(e.relatedTarget))return;
      const p=findPlayer(target);if(!p)return;
      clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>showHover(p),450);
    });
    document.addEventListener('mouseout',e=>{
      const target=hoverTarget(e.target);if(!target)return;
      if(e.relatedTarget&&target.contains(e.relatedTarget))return;
      hideHover();
    });
  }

  function profilePlayer(){
    const modal=document.querySelector('#careerModal');if(!modal?.classList.contains('open'))return null;
    const text=[document.querySelector('#careerTitle')?.textContent,document.querySelector('#careerHero')?.textContent].filter(Boolean).join(' ');
    return findPlayer(text);
  }
  async function renderProfileNews(){
    const p=profilePlayer();if(!p)return;
    const body=document.querySelector('#careerModal .careerbody');if(!body)return;
    let box=document.querySelector('#careerNewsV49');
    const pid=playerId(p)||playerName(p);
    if(box?.dataset.player===pid&&box.dataset.loaded==='1')return;
    if(!box){box=document.createElement('section');box.id='careerNewsV49';const grid=document.querySelector('#careerGrid');if(grid)grid.insertAdjacentElement('beforebegin',box);else body.appendChild(box)}
    box.dataset.player=pid;box.dataset.loaded='0';
    box.innerHTML=`<div class="careerNewsHeadV49"><h3>📰 Latest ESPN News</h3><span class="newsEspnV49">PLAYER FEED</span></div><div class="careerNewsEmptyV49">Loading latest news for ${esc(playerName(p))}…</div>`;
    const res=await newsFor(p,6);if(box.dataset.player!==pid)return;
    const a=res.articles||[];
    box.innerHTML=`<div class="careerNewsHeadV49"><h3>📰 Latest ESPN News</h3><span class="newsEspnV49">ESPN · ${a.length} STORIES</span></div>${a.length?`<div class="careerNewsListV49">${a.map(x=>{const content=`<span><b>${esc(x.headline)}</b>${x.description?`<p>${esc(x.description)}</p>`:''}<div class="careerNewsMetaV49">${esc(relativeTime(x.published))}${x.href?' · Open on ESPN':''}</div></span>`;return x.href?`<a class="careerNewsItemV49 ${x.image?'':'noimg'}" href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${x.image?`<img src="${esc(x.image)}" onerror="this.style.display='none'">`:''}${content}</a>`:`<div class="careerNewsItemV49 ${x.image?'':'noimg'}">${x.image?`<img src="${esc(x.image)}" onerror="this.style.display='none'">`:''}${content}</div>`}).join('')}</div>`:`<div class="careerNewsEmptyV49">No recent ESPN player-specific stories found for ${esc(playerName(p))}.</div>`}`;
    box.dataset.loaded='1';
  }

  function installProfileObserver(){
    const attach=()=>{
      const modal=document.querySelector('#careerModal');if(!modal)return false;
      const obs=new MutationObserver(()=>{if(modal.classList.contains('open'))setTimeout(renderProfileNews,60)});
      obs.observe(modal,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
      modal.addEventListener('click',()=>{if(modal.classList.contains('open'))setTimeout(renderProfileNews,80)});
      return true;
    };
    if(!attach()){const t=setInterval(()=>{if(attach())clearInterval(t)},500);setTimeout(()=>clearInterval(t),15000)}
  }

  function boot(){installCss();hoverBox();installHover();installProfileObserver()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
