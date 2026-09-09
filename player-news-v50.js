/* Fantasy Lens v50 — fixed ESPN fantasy player-news feed, robust ESPN ID resolution, hover + profile. */
(function(){
  'use strict';

  const NEWS_TTL=15*60*1000;
  const ID_TTL=7*24*60*60*1000;
  const CACHE_PREFIX='fantasyLensEspnNewsV50:';
  const ID_PREFIX='fantasyLensEspnIdV50:';
  let hoverTimer=null,hoverToken='',lastPointer={x:0,y:0};

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const playersList=()=>typeof players!=='undefined'&&Array.isArray(players)?players:[];
  const playerId=p=>String(p?.id??p?.player_id??p?.playerId??'');
  const playerName=p=>p?.name||p?.full_name||p?.displayName||p?.player_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||'Unknown';
  const playerTeam=p=>String(p?.team||p?.teamAbbr||p?.proTeam||p?.proTeamAbbreviation||'').toUpperCase();
  const playerPos=p=>String(p?.pos||p?.position||p?.positionAbbr||'').toUpperCase();

  function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function write(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch{}}
  function explicitEspnId(p){for(const v of [p?.espnId,p?.espn_id,p?.espnID,p?.athleteId,p?.athlete_id]){const s=String(v??'');if(/^\d{4,}$/.test(s))return s}return''}

  function findPlayer(textOrEl){
    const el=textOrEl instanceof Element?textOrEl:null;
    if(el){
      const stored=el.dataset?.v42||el.dataset?.playerId||el.closest?.('[data-v42]')?.dataset?.v42;
      if(stored){const p=playersList().find(x=>playerId(x)===String(stored));if(p)return p}
    }
    const text=typeof textOrEl==='string'?textOrEl:(el?.textContent||''),needle=norm(text);if(!needle)return null;
    return [...playersList()].filter(p=>playerName(p).length>=4).sort((a,b)=>playerName(b).length-playerName(a).length).find(p=>needle.includes(norm(playerName(p))))||null;
  }

  function nameMatches(a,b){const x=norm(a),y=norm(b);return !!x&&!!y&&(x===y||x.includes(y)||y.includes(x))}
  function athleteName(j){return j?.athlete?.displayName||j?.athlete?.fullName||j?.displayName||j?.fullName||j?.name||''}

  async function validateGenericId(id,p){
    if(!/^\d{4,}$/.test(String(id||'')))return'';
    try{
      const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${encodeURIComponent(id)}`);
      if(!r.ok)return'';
      const j=await r.json();
      return nameMatches(athleteName(j),playerName(p))?String(id):'';
    }catch{return''}
  }

  function extractSearchId(data,name){
    const wanted=norm(name),seen=new Set(),q=[data];let fallback='';
    while(q.length){
      const x=q.shift();if(!x||typeof x!=='object'||seen.has(x))continue;seen.add(x);
      if(Array.isArray(x)){q.push(...x);continue}
      const label=norm(x.displayName||x.fullName||x.name||x.title||x.shortName||'');
      for(const raw of [x.id,x.athleteId,x.uid,x.href,x.url,x.link,x.$ref]){
        const s=String(raw??''),m=s.match(/(?:athletes\/|athlete\/|\/id\/|~a\/)(\d{4,})/i)||s.match(/^\d{4,}$/);
        const id=m?(m[1]||m[0]):'';
        if(id){if(label&&wanted&&(label===wanted||label.includes(wanted)||wanted.includes(label)))return id;if(!fallback)fallback=id}
      }
      q.push(...Object.values(x));
    }
    return fallback;
  }

  async function resolveEspnId(p){
    const cacheKey=ID_PREFIX+norm(playerName(p)),cached=read(cacheKey);
    if(cached?.id&&Date.now()-Number(cached.at||0)<ID_TTL)return String(cached.id);

    const explicit=explicitEspnId(p);
    if(explicit){write(cacheKey,{id:explicit,at:Date.now(),source:'explicit'});return explicit}

    const generic=playerId(p);
    if(/^\d{4,}$/.test(generic)){
      const validated=await validateGenericId(generic,p);
      if(validated){write(cacheKey,{id:validated,at:Date.now(),source:'validated-id'});return validated}
    }

    try{
      const r=await fetch(`https://site.web.api.espn.com/apis/search/v2?limit=25&query=${encodeURIComponent(playerName(p))}`);
      if(!r.ok)throw new Error(`search ${r.status}`);
      const j=await r.json(),candidate=extractSearchId(j,playerName(p));
      if(candidate){
        const validated=await validateGenericId(candidate,p);
        if(validated){write(cacheKey,{id:validated,at:Date.now(),source:'search'});return validated}
      }
    }catch{}
    return'';
  }

  function articleLink(a){return a?.links?.web?.href||a?.links?.mobile?.href||a?.links?.api?.self?.href||a?.link||a?.url||''}
  function articleImage(a){return a?.images?.[0]?.url||a?.image?.url||''}
  function articleDate(a){return a?.published||a?.lastModified||a?.categorized||a?.date||a?.created||''}
  function cleanText(v){return String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}

  function normalizeFeed(j){
    const raw=Array.isArray(j?.feed)?j.feed:Array.isArray(j?.articles)?j.articles:Array.isArray(j?.news)?j.news:[];
    const seen=new Set();
    return raw.map(x=>({
      headline:cleanText(x?.headline||x?.title||x?.name||'ESPN update'),
      description:cleanText(x?.description||x?.summary||x?.story||''),
      published:articleDate(x),href:articleLink(x),image:articleImage(x),source:x?.type||x?.feedDisplayType||'ESPN'
    })).filter(x=>x.headline&&!seen.has(x.headline)&&seen.add(x.headline)).sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0));
  }

  async function fetchFantasyNews(espnId){
    const u=`https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?limit=50&playerId=${encodeURIComponent(espnId)}`;
    const r=await fetch(u);if(!r.ok)throw new Error(`fantasy news ${r.status}`);
    const j=await r.json();return normalizeFeed(j);
  }
  async function fetchAthleteNews(espnId){
    const u=`https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${encodeURIComponent(espnId)}/news?limit=20`;
    const r=await fetch(u);if(!r.ok)throw new Error(`athlete news ${r.status}`);
    const j=await r.json();return normalizeFeed(j);
  }

  async function newsFor(p,limit=6){
    const espnId=await resolveEspnId(p);if(!espnId)return{espnId:'',articles:[],error:'ESPN athlete ID could not be resolved',source:'none'};
    const key=CACHE_PREFIX+espnId,cached=read(key);
    if(cached?.articles&&Date.now()-Number(cached.at||0)<NEWS_TTL)return{espnId,articles:cached.articles.slice(0,limit),source:cached.source||'cache',cached:true};

    let articles=[],source='fantasy';let error='';
    try{articles=await fetchFantasyNews(espnId)}catch(e){error=String(e?.message||e)}
    if(!articles.length){
      try{articles=await fetchAthleteNews(espnId);source='athlete'}catch(e){error+=(error?' · ':'')+String(e?.message||e)}
    }
    write(key,{at:Date.now(),articles,source,espnId});
    return{espnId,articles:articles.slice(0,limit),source,error};
  }

  function relativeTime(v){const t=Date.parse(v);if(!Number.isFinite(t))return'';const m=Math.max(0,Math.floor((Date.now()-t)/60000));if(m<1)return'just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;const d=Math.floor(h/24);if(d<30)return`${d}d ago`;return new Date(t).toLocaleDateString()}

  function installCss(){
    if(document.querySelector('#playerNewsStylesV50'))return;
    const s=document.createElement('style');s.id='playerNewsStylesV50';s.textContent=`
      #playerNewsHoverV50{position:fixed;z-index:5000;width:min(410px,calc(100vw - 20px));background:#10283b;color:#f7fbfd;border:1px solid #ffffff24;border-radius:12px;box-shadow:0 14px 42px #0006;padding:10px;pointer-events:none;display:none;font-size:9px}#playerNewsHoverV50.open{display:block}
      .newsH50{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}.newsH50 b{font-size:11px}.newsSrc50{font-size:7px;font-weight:900;color:#8fd3ff}.newsItem50{border-top:1px solid #ffffff18;padding-top:6px;margin-top:6px}.newsItem50 strong{display:block;font-size:9px;line-height:1.35}.newsItem50 small{display:block;color:#b6c5cf;font-size:7px;margin-top:2px}.newsDesc50{font-size:8px;color:#dbe5eb;line-height:1.35;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      #careerNewsV50{margin:10px 0 2px;border:1px solid var(--line);border-radius:11px;background:#fff;overflow:hidden}.careerNewsHead50{display:flex;justify-content:space-between;align-items:center;padding:9px 10px;background:#f4f7f5;border-bottom:1px solid var(--line)}.careerNewsHead50 h3{margin:0;font-size:11px}.careerNewsList50{display:grid}.careerNewsRow50{display:grid;grid-template-columns:70px minmax(0,1fr);gap:9px;padding:9px 10px;border-top:1px solid #edf0ed;text-decoration:none;color:inherit}.careerNewsRow50.noimg{grid-template-columns:1fr}.careerNewsRow50:first-child{border-top:0}.careerNewsRow50:hover{background:#f8faf8}.careerNewsRow50 img{width:70px;height:48px;object-fit:cover;border-radius:7px}.careerNewsRow50 b{font-size:10px;line-height:1.35}.careerNewsRow50 p{margin:3px 0 0;font-size:8px;color:var(--muted);line-height:1.4}.newsMeta50{font-size:7px;color:#71808a;margin-top:4px}.newsEmpty50{padding:12px;color:var(--muted);font-size:9px}
      @media(max-width:650px){#playerNewsHoverV50{display:none!important}.careerNewsRow50{grid-template-columns:56px minmax(0,1fr)}.careerNewsRow50 img{width:56px;height:44px}}
    `;document.head.appendChild(s);
  }

  function hoverBox(){let b=document.querySelector('#playerNewsHoverV50');if(!b){b=document.createElement('div');b.id='playerNewsHoverV50';document.body.appendChild(b)}return b}
  function positionHover(){const b=hoverBox(),pad=12,w=b.offsetWidth||410,h=b.offsetHeight||170;let x=lastPointer.x+14,y=lastPointer.y+14;if(x+w>innerWidth-pad)x=Math.max(pad,lastPointer.x-w-14);if(y+h>innerHeight-pad)y=Math.max(pad,lastPointer.y-h-14);b.style.left=x+'px';b.style.top=y+'px'}
  function hideHover(){clearTimeout(hoverTimer);hoverToken='';hoverBox().classList.remove('open')}
  async function showHover(p){
    const token=(playerId(p)||playerName(p))+':'+Date.now();hoverToken=token;
    const b=hoverBox();b.innerHTML=`<div class="newsH50"><b>${esc(playerName(p))}</b><span class="newsSrc50">ESPN FANTASY NEWS</span></div><div class="newsDesc50">Loading latest player news…</div>`;b.classList.add('open');positionHover();
    const res=await newsFor(p,4);if(hoverToken!==token)return;
    const a=res.articles||[];
    b.innerHTML=`<div class="newsH50"><b>${esc(playerName(p))} · ${esc(playerPos(p))} ${esc(playerTeam(p))}</b><span class="newsSrc50">ESPN · ID ${esc(res.espnId||'?')}</span></div>${a.length?a.slice(0,2).map(x=>`<div class="newsItem50"><strong>${esc(x.headline)}</strong><small>${esc(x.source)}${x.published?' · '+esc(relativeTime(x.published)):''}</small>${x.description?`<div class="newsDesc50">${esc(x.description)}</div>`:''}</div>`).join(''):`<div class="newsDesc50">No player-specific ESPN feed items found${res.espnId?' for ESPN ID '+esc(res.espnId):''}.${res.error?' '+esc(res.error):''}</div>`}`;positionHover();
  }

  function hoverTarget(el){return el?.closest?.('#tablewrap tbody tr,#cards > *,#bestStrip tr,.dashPlayerV39,.splitPersonV41,.v42qrow,.commandRowV39')||null}
  function installHover(){
    document.addEventListener('mousemove',e=>{lastPointer={x:e.clientX,y:e.clientY};if(hoverBox().classList.contains('open'))positionHover()},{passive:true});
    document.addEventListener('mouseover',e=>{const target=hoverTarget(e.target);if(!target||e.relatedTarget&&target.contains(e.relatedTarget))return;const p=findPlayer(target);if(!p)return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>showHover(p),400)});
    document.addEventListener('mouseout',e=>{const target=hoverTarget(e.target);if(!target||e.relatedTarget&&target.contains(e.relatedTarget))return;hideHover()});
  }

  function profilePlayer(){const m=document.querySelector('#careerModal');if(!m?.classList.contains('open'))return null;return findPlayer([document.querySelector('#careerTitle')?.textContent,document.querySelector('#careerHero')?.textContent].filter(Boolean).join(' '))}
  async function renderProfileNews(){
    const p=profilePlayer();if(!p)return;const body=document.querySelector('#careerModal .careerbody');if(!body)return;
    let box=document.querySelector('#careerNewsV50');const key=playerId(p)||playerName(p);
    if(!box){box=document.createElement('section');box.id='careerNewsV50';const grid=document.querySelector('#careerGrid');if(grid)grid.insertAdjacentElement('beforebegin',box);else body.appendChild(box)}
    if(box.dataset.player===key&&box.dataset.loaded==='1')return;
    box.dataset.player=key;box.dataset.loaded='0';box.innerHTML=`<div class="careerNewsHead50"><h3>📰 Latest ESPN Player News</h3><span class="newsSrc50">LOADING</span></div><div class="newsEmpty50">Loading ${esc(playerName(p))}…</div>`;
    const res=await newsFor(p,8);if(box.dataset.player!==key)return;const a=res.articles||[];
    box.innerHTML=`<div class="careerNewsHead50"><h3>📰 Latest ESPN Player News</h3><span class="newsSrc50">ID ${esc(res.espnId||'?')} · ${a.length} ITEMS</span></div>${a.length?`<div class="careerNewsList50">${a.map(x=>{const inside=`<span><b>${esc(x.headline)}</b>${x.description?`<p>${esc(x.description)}</p>`:''}<div class="newsMeta50">${esc(x.source)}${x.published?' · '+esc(relativeTime(x.published)):''}${x.href?' · Open':''}</div></span>`;return x.href?`<a class="careerNewsRow50 ${x.image?'':'noimg'}" href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${x.image?`<img src="${esc(x.image)}" onerror="this.style.display='none'">`:''}${inside}</a>`:`<div class="careerNewsRow50 ${x.image?'':'noimg'}">${x.image?`<img src="${esc(x.image)}" onerror="this.style.display='none'">`:''}${inside}</div>`}).join('')}</div>`:`<div class="newsEmpty50">No player-specific ESPN feed items found for ${esc(playerName(p))}.${res.espnId?` ESPN ID: ${esc(res.espnId)}.`:''}${res.error?' '+esc(res.error):''}</div>`}`;box.dataset.loaded='1';
  }

  function installProfileWatcher(){let last='';setInterval(()=>{const m=document.querySelector('#careerModal');if(!m?.classList.contains('open')){last='';return}const p=profilePlayer(),key=p?(playerId(p)||playerName(p)):'';if(key&&key!==last){last=key;setTimeout(renderProfileNews,40)}},350)}

  function boot(){installCss();installHover();installProfileWatcher()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.FantasyLensPlayerNews={newsFor,resolveEspnId};
})();
