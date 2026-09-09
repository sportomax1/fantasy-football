/* Fantasy Lens v51 — use rendered ESPN headshot/player IDs for reliable fantasy news. */
(function(){
  'use strict';

  const TTL=15*60*1000;
  const CACHE='fantasyLensEspnNewsV51:';
  let hoverTimer=null, hoverKey='', pointer={x:0,y:0};

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const ps=()=>typeof players!=='undefined'&&Array.isArray(players)?players:[];
  const pid=p=>String(p?.id??p?.player_id??p?.playerId??'');
  const pname=p=>p?.name||p?.full_name||p?.displayName||p?.player_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||'Unknown';
  const pteam=p=>String(p?.team||p?.teamAbbr||p?.proTeam||p?.proTeamAbbreviation||'').toUpperCase();
  const ppos=p=>String(p?.pos||p?.position||p?.positionAbbr||'').toUpperCase();
  const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

  function playerFrom(elOrText){
    const el=elOrText instanceof Element?elOrText:null;
    if(el){
      const stored=el.dataset?.v42||el.dataset?.playerId||el.closest?.('[data-v42]')?.dataset?.v42;
      if(stored){const p=ps().find(x=>pid(x)===String(stored));if(p)return p}
    }
    const text=typeof elOrText==='string'?elOrText:(el?.textContent||''),needle=norm(text);if(!needle)return null;
    return [...ps()].filter(p=>pname(p).length>=4).sort((a,b)=>pname(b).length-pname(a).length).find(p=>needle.includes(norm(pname(p))))||null;
  }

  function idFromImage(root){
    if(!root?.querySelectorAll)return'';
    for(const img of root.querySelectorAll('img')){
      const src=String(img.currentSrc||img.src||'');
      const m=src.match(/\/headshots\/nfl\/players\/full\/(\d{4,})\.(?:png|jpg|jpeg|webp)/i);
      if(m)return m[1];
    }
    return'';
  }

  function explicitId(p){
    for(const v of [p?.espnId,p?.espn_id,p?.espnID,p?.athleteId,p?.athlete_id]){
      const s=String(v??'');if(/^\d{4,}$/.test(s))return s;
    }
    return'';
  }

  function resolveId(p,context){
    const explicit=explicitId(p);if(explicit)return{ id:explicit, source:'player ESPN field' };
    const visual=idFromImage(context);if(visual)return{ id:visual, source:'rendered ESPN headshot' };
    const modal=document.querySelector('#careerModal.open,#careerModal');
    if(modal?.classList.contains('open')&&norm(modal.textContent).includes(norm(pname(p)))){
      const profile=idFromImage(modal);if(profile)return{ id:profile, source:'profile ESPN headshot' };
    }
    const generic=pid(p);
    // Fantasy Lens' primary player records are ESPN-backed; this same id is used to render ESPN headshots.
    if(/^\d{4,}$/.test(generic))return{ id:generic, source:'Fantasy Lens ESPN player id' };
    return{ id:'', source:'unresolved' };
  }

  function clean(v){return String(v||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()}
  function linkOf(x){return x?.links?.web?.href||x?.links?.mobile?.href||x?.links?.api?.self?.href||x?.link||x?.url||x?.href||''}
  function imageOf(x){return x?.images?.[0]?.url||x?.image?.url||x?.image||''}
  function dateOf(x){return x?.published||x?.publishedDate||x?.lastModified||x?.created||x?.date||x?.categorized||''}
  function normalizeFeed(j){
    const raw=Array.isArray(j)?j:Array.isArray(j?.feed)?j.feed:Array.isArray(j?.items)?j.items:Array.isArray(j?.news)?j.news:Array.isArray(j?.articles)?j.articles:[];
    const seen=new Set();
    return raw.map(x=>({
      headline:clean(x?.headline||x?.title||x?.name||x?.label||'ESPN fantasy update'),
      description:clean(x?.description||x?.summary||x?.story||x?.text||x?.body||x?.content||''),
      published:dateOf(x),
      href:linkOf(x),
      image:imageOf(x),
      source:clean(x?.source?.name||x?.source||x?.type||x?.feedDisplayType||'ESPN Fantasy')
    })).filter(x=>x.headline&&!seen.has(x.headline)&&seen.add(x.headline)).sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0));
  }

  async function fetchNews(espnId){
    const key=CACHE+espnId,c=read(key);
    if(c?.items&&Date.now()-Number(c.at||0)<TTL)return c.items;
    const url=`https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?limit=50&playerId=${encodeURIComponent(espnId)}`;
    const r=await fetch(url);if(!r.ok)throw new Error(`ESPN fantasy news HTTP ${r.status}`);
    const j=await r.json(),items=normalizeFeed(j);
    write(key,{at:Date.now(),items});
    return items;
  }

  function ago(v){const t=Date.parse(v);if(!Number.isFinite(t))return'';const mins=Math.max(0,Math.floor((Date.now()-t)/60000));if(mins<1)return'just now';if(mins<60)return mins+'m ago';const h=Math.floor(mins/60);if(h<24)return h+'h ago';const d=Math.floor(h/24);if(d<30)return d+'d ago';return new Date(t).toLocaleDateString()}

  function styles(){
    if(document.querySelector('#newsV51Css'))return;
    const s=document.createElement('style');s.id='newsV51Css';s.textContent=`
      #careerNewsV50,#careerNewsV49,#playerNewsHoverV50,#playerNewsHoverV49{display:none!important}
      #playerNewsHoverV51{position:fixed;z-index:5200;width:min(420px,calc(100vw - 20px));background:#10283b;color:#f7fbfd;border:1px solid #ffffff24;border-radius:12px;box-shadow:0 14px 42px #0006;padding:10px;display:none;pointer-events:none;font-size:9px}#playerNewsHoverV51.open{display:block}.n51head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}.n51head b{font-size:11px}.n51src{font-size:7px;font-weight:900;color:#8fd3ff}.n51item{border-top:1px solid #ffffff18;padding-top:6px;margin-top:6px}.n51item:first-of-type{border-top:0;margin-top:0}.n51item strong{display:block;font-size:9px;line-height:1.35}.n51item small{display:block;color:#b6c5cf;font-size:7px;margin-top:2px}.n51desc{font-size:8px;color:#dbe5eb;line-height:1.35;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      #careerNewsV51{margin:10px 0 2px;border:1px solid var(--line);border-radius:11px;background:#fff;overflow:hidden}.n51profileHead{display:flex;justify-content:space-between;align-items:center;padding:9px 10px;background:#f4f7f5;border-bottom:1px solid var(--line)}.n51profileHead h3{margin:0;font-size:11px}.n51list{display:grid}.n51row{display:grid;grid-template-columns:70px minmax(0,1fr);gap:9px;padding:9px 10px;border-top:1px solid #edf0ed;text-decoration:none;color:inherit}.n51row.noimg{grid-template-columns:1fr}.n51row:first-child{border-top:0}.n51row:hover{background:#f8faf8}.n51row img{width:70px;height:48px;object-fit:cover;border-radius:7px}.n51row b{font-size:10px;line-height:1.35}.n51row p{margin:3px 0 0;font-size:8px;color:var(--muted);line-height:1.4}.n51meta{font-size:7px;color:#71808a;margin-top:4px}.n51empty{padding:12px;color:var(--muted);font-size:9px}
      @media(max-width:650px){#playerNewsHoverV51{display:none!important}.n51row{grid-template-columns:56px minmax(0,1fr)}.n51row img{width:56px;height:44px}}
    `;document.head.appendChild(s);
  }

  function hoverBox(){let b=document.querySelector('#playerNewsHoverV51');if(!b){b=document.createElement('div');b.id='playerNewsHoverV51';document.body.appendChild(b)}return b}
  function posHover(){const b=hoverBox(),pad=12,w=b.offsetWidth||420,h=b.offsetHeight||170;let x=pointer.x+14,y=pointer.y+14;if(x+w>innerWidth-pad)x=Math.max(pad,pointer.x-w-14);if(y+h>innerHeight-pad)y=Math.max(pad,pointer.y-h-14);b.style.left=x+'px';b.style.top=y+'px'}
  function closeHover(){clearTimeout(hoverTimer);hoverKey='';hoverBox().classList.remove('open')}

  async function showHover(p,target){
    const resolved=resolveId(p,target),token=(resolved.id||pname(p))+':'+Date.now();hoverKey=token;
    const b=hoverBox();b.innerHTML=`<div class="n51head"><b>${esc(pname(p))}</b><span class="n51src">ESPN FANTASY NEWS</span></div><div class="n51desc">Loading latest news…</div>`;b.classList.add('open');posHover();
    if(!resolved.id){b.innerHTML=`<div class="n51head"><b>${esc(pname(p))}</b><span class="n51src">ID ?</span></div><div class="n51desc">Could not find an ESPN id from this player row/profile.</div>`;return}
    try{
      const items=await fetchNews(resolved.id);if(hoverKey!==token)return;
      b.innerHTML=`<div class="n51head"><b>${esc(pname(p))} · ${esc(ppos(p))} ${esc(pteam(p))}</b><span class="n51src">ID ${esc(resolved.id)}</span></div>${items.length?items.slice(0,2).map(x=>`<div class="n51item"><strong>${esc(x.headline)}</strong><small>${esc(x.source)}${x.published?' · '+esc(ago(x.published)):''}</small>${x.description?`<div class="n51desc">${esc(x.description)}</div>`:''}</div>`).join(''):`<div class="n51desc">ESPN returned 0 fantasy feed items for ID ${esc(resolved.id)}.</div>`}`;posHover();
    }catch(e){if(hoverKey===token)b.innerHTML=`<div class="n51head"><b>${esc(pname(p))}</b><span class="n51src">ID ${esc(resolved.id)}</span></div><div class="n51desc">${esc(e?.message||e)}</div>`}
  }

  function target(el){return el?.closest?.('#tablewrap tbody tr,#cards > *,#bestStrip tr,.dashPlayerV39,.splitPersonV41,.v42qrow,.commandRowV39')||null}
  function hover(){
    document.addEventListener('mousemove',e=>{pointer={x:e.clientX,y:e.clientY};if(hoverBox().classList.contains('open'))posHover()},{passive:true});
    document.addEventListener('mouseover',e=>{const t=target(e.target);if(!t||e.relatedTarget&&t.contains(e.relatedTarget))return;const p=playerFrom(t);if(!p)return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>showHover(p,t),400)});
    document.addEventListener('mouseout',e=>{const t=target(e.target);if(!t||e.relatedTarget&&t.contains(e.relatedTarget))return;closeHover()});
  }

  function profilePlayer(){const m=document.querySelector('#careerModal');if(!m?.classList.contains('open'))return null;return playerFrom([document.querySelector('#careerTitle')?.textContent,document.querySelector('#careerHero')?.textContent].filter(Boolean).join(' '))}
  async function renderProfile(){
    const modal=document.querySelector('#careerModal');if(!modal?.classList.contains('open'))return;const p=profilePlayer();if(!p)return;
    const body=modal.querySelector('.careerbody');if(!body)return;const resolved=resolveId(p,modal),key=(resolved.id||pid(p)||pname(p));
    let box=document.querySelector('#careerNewsV51');if(!box){box=document.createElement('section');box.id='careerNewsV51';const grid=document.querySelector('#careerGrid');if(grid)grid.insertAdjacentElement('beforebegin',box);else body.appendChild(box)}
    if(box.dataset.player===key&&box.dataset.loaded==='1')return;box.dataset.player=key;box.dataset.loaded='0';
    box.innerHTML=`<div class="n51profileHead"><h3>📰 Latest ESPN Player News</h3><span class="n51src">${resolved.id?'ID '+esc(resolved.id):'ID ?'}</span></div><div class="n51empty">Loading ${esc(pname(p))}…</div>`;
    if(!resolved.id){box.innerHTML=`<div class="n51profileHead"><h3>📰 Latest ESPN Player News</h3><span class="n51src">ID ?</span></div><div class="n51empty">Could not resolve ESPN ID from the player record or rendered headshot.</div>`;box.dataset.loaded='1';return}
    try{
      const items=await fetchNews(resolved.id);if(box.dataset.player!==key)return;
      box.innerHTML=`<div class="n51profileHead"><h3>📰 Latest ESPN Player News</h3><span class="n51src">ID ${esc(resolved.id)} · ${items.length} ITEMS</span></div>${items.length?`<div class="n51list">${items.slice(0,8).map(x=>{const inside=`<span><b>${esc(x.headline)}</b>${x.description?`<p>${esc(x.description)}</p>`:''}<div class="n51meta">${esc(x.source)}${x.published?' · '+esc(ago(x.published)):''}${x.href?' · Open':''}</div></span>`;return x.href?`<a class="n51row ${x.image?'':'noimg'}" href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${x.image?`<img src="${esc(x.image)}" onerror="this.style.display='none'">`:''}${inside}</a>`:`<div class="n51row ${x.image?'':'noimg'}">${x.image?`<img src="${esc(x.image)}" onerror="this.style.display='none'">`:''}${inside}</div>`}).join('')}</div>`:`<div class="n51empty">ESPN returned 0 fantasy feed items for ${esc(pname(p))} (ID ${esc(resolved.id)}). ID source: ${esc(resolved.source)}.</div>`}`;box.dataset.loaded='1';
    }catch(e){box.innerHTML=`<div class="n51profileHead"><h3>📰 Latest ESPN Player News</h3><span class="n51src">ID ${esc(resolved.id)}</span></div><div class="n51empty">${esc(e?.message||e)} · ID source: ${esc(resolved.source)}</div>`;box.dataset.loaded='1'}
  }

  function watcher(){let last='';setInterval(()=>{const m=document.querySelector('#careerModal');if(!m?.classList.contains('open')){last='';return}const p=profilePlayer();if(!p)return;const id=resolveId(p,m).id||pid(p)||pname(p);if(id!==last){last=id;setTimeout(renderProfile,30)}},300)}

  function boot(){styles();hover();watcher()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.FantasyLensPlayerNewsV51={fetchNews,resolveId,renderProfile};
})();