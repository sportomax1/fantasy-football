/* Fantasy Lens v53 — ESPN Recent News: Rotowire player updates first, articles separated. */
(function(){
  'use strict';

  const TTL=15*60*1000;
  const CACHE='fantasyLensEspnRecentNewsV53:';
  let hoverTimer=null,hoverToken='',pointer={x:0,y:0};

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
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
    const txt=typeof elOrText==='string'?elOrText:(el?.textContent||''),needle=norm(txt);if(!needle)return null;
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
  function explicitId(p){for(const v of [p?.espnId,p?.espn_id,p?.espnID,p?.athleteId,p?.athlete_id]){const s=String(v??'');if(/^\d{4,}$/.test(s))return s}return''}
  function resolveId(p,context){
    const explicit=explicitId(p);if(explicit)return{ id:explicit,source:'ESPN field' };
    const visual=idFromImage(context);if(visual)return{ id:visual,source:'headshot' };
    const modal=document.querySelector('#careerModal.open');
    if(modal&&norm(modal.textContent).includes(norm(pname(p)))){const m=idFromImage(modal);if(m)return{ id:m,source:'profile headshot' }}
    const generic=pid(p);if(/^\d{4,}$/.test(generic))return{ id:generic,source:'Fantasy Lens player ID' };
    return{ id:'',source:'unresolved' };
  }

  function dateOf(x){return x?.published||x?.categorized||x?.lastModified||x?.created||x?.date||''}
  function linkOf(x){return x?.links?.web?.href||x?.links?.mobile?.href||x?.link||x?.url||''}
  function imageOf(x){return x?.images?.[0]?.url||x?.image?.url||''}
  function normalizedItem(x){return{
    id:String(x?.id||x?.nowId||''),
    type:String(x?.type||''),
    headline:clean(x?.headline||x?.description||x?.title||x?.name||'ESPN update'),
    description:clean(x?.description||x?.summary||''),
    spin:clean(x?.story||x?.analysis||''),
    published:dateOf(x),
    href:linkOf(x),
    image:imageOf(x)
  }}

  function splitFeed(j){
    const raw=Array.isArray(j?.feed)?j.feed:[];
    const updates=[],articles=[],seenUpdates=new Set(),seenArticles=new Set();
    for(const x of raw){
      const it=normalizedItem(x),type=String(x?.type||'').toLowerCase();
      if(type==='rotowire'){
        const k=it.id||it.headline;if(!k||seenUpdates.has(k))continue;seenUpdates.add(k);updates.push(it);
      }else if(type==='story'){
        const k=it.id||it.headline;if(!k||seenArticles.has(k))continue;seenArticles.add(k);articles.push(it);
      }
    }
    const byDate=(a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0);
    updates.sort(byDate);articles.sort(byDate);
    return{updates,articles,total:raw.length};
  }

  async function fetchFeed(espnId){
    const key=CACHE+espnId,c=read(key);
    if(c?.data&&Date.now()-Number(c.at||0)<TTL)return c.data;
    const url=`https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?limit=24&playerId=${encodeURIComponent(espnId)}`;
    const r=await fetch(url);if(!r.ok)throw new Error(`ESPN news HTTP ${r.status}`);
    const data=splitFeed(await r.json());write(key,{at:Date.now(),data});return data;
  }

  async function newsFor(p,context){
    const r=resolveId(p,context);if(!r.id)return{espnId:'',updates:[],articles:[],error:'ESPN player ID unresolved'};
    try{const d=await fetchFeed(r.id);return{espnId:r.id,idSource:r.source,...d}}catch(e){return{espnId:r.id,idSource:r.source,updates:[],articles:[],error:String(e?.message||e)}}
  }

  function rel(v){const t=Date.parse(v);if(!Number.isFinite(t))return'';const m=Math.max(0,Math.floor((Date.now()-t)/60000));if(m<60)return m<1?'just now':`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;const d=Math.floor(h/24);if(d<30)return`${d}d ago`;return new Date(t).toLocaleDateString()}
  function longDate(v){const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''}

  function css(){
    if(document.querySelector('#newsV53css'))return;
    const s=document.createElement('style');s.id='newsV53css';s.textContent=`
      #careerNewsV49,#careerNewsV50,#careerNewsV51,#playerNewsHoverV49,#playerNewsHoverV50,#playerNewsHoverV51{display:none!important}
      #playerNewsHoverV53{position:fixed;z-index:7000;width:min(430px,calc(100vw - 18px));background:#10283b;color:#fff;border:1px solid #ffffff24;border-radius:11px;box-shadow:0 15px 42px #0007;padding:10px;display:none;pointer-events:none}#playerNewsHoverV53.open{display:block}
      .n53h{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}.n53h b{font-size:11px}.n53src{font-size:7px;font-weight:900;color:#8fd3ff;letter-spacing:.04em}.n53u{padding:7px 0;border-top:1px solid #ffffff18}.n53u:first-of-type{border-top:0}.n53meta{font-size:7px;color:#afbdc7;text-transform:uppercase;margin-bottom:3px}.n53headline{font-size:9px;font-weight:800;line-height:1.35}.n53spin{font-size:8px;color:#d8e2e8;line-height:1.35;margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.n53empty{font-size:8px;color:#ced9df}
      #careerNewsV53{margin:10px 0;border:1px solid var(--line);border-radius:11px;background:#fff;overflow:hidden}.careerN53head{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px 10px;background:#f4f7f5;border-bottom:1px solid var(--line)}.careerN53head h3{margin:0;font-size:11px}.careerN53list{display:grid}.careerN53row{padding:10px;border-top:1px solid #edf0ed}.careerN53row:first-child{border-top:0}.careerN53meta{display:flex;justify-content:space-between;gap:8px;font-size:7px;color:#71808a;text-transform:uppercase;margin-bottom:4px}.careerN53row b{font-size:10px;line-height:1.4}.careerN53spin{font-size:8px;color:var(--muted);line-height:1.45;margin-top:5px}.careerN53spin strong{font-size:8px;color:var(--ink)}.careerN53articles{border-top:1px solid var(--line);padding:8px 10px;background:#fafbfa}.careerN53articles summary{cursor:pointer;font-size:8px;font-weight:850}.careerN53article{display:block;padding:6px 0;border-top:1px solid #edf0ed;font-size:8px;color:inherit;text-decoration:none}.careerN53article:first-of-type{margin-top:6px}.careerN53article small{display:block;color:var(--muted);font-size:7px;margin-top:2px}
      @media(max-width:650px){#playerNewsHoverV53{display:none!important}}
    `;document.head.appendChild(s);
  }

  function hoverBox(){let b=document.querySelector('#playerNewsHoverV53');if(!b){b=document.createElement('div');b.id='playerNewsHoverV53';document.body.appendChild(b)}return b}
  function posHover(){const b=hoverBox(),pad=10,w=b.offsetWidth||430,h=b.offsetHeight||190;let x=pointer.x+14,y=pointer.y+14;if(x+w>innerWidth-pad)x=Math.max(pad,pointer.x-w-14);if(y+h>innerHeight-pad)y=Math.max(pad,pointer.y-h-14);b.style.left=x+'px';b.style.top=y+'px'}
  function hideHover(){clearTimeout(hoverTimer);hoverToken='';hoverBox().classList.remove('open')}
  function hoverTarget(el){return el?.closest?.('#tablewrap tbody tr,#cards > *,#bestStrip tr,.dashPlayerV39,.splitPersonV41,.v42qrow,.commandRowV39')||null}
  async function showHover(p,context){
    const token=(pid(p)||pname(p))+Date.now();hoverToken=token;const b=hoverBox();b.innerHTML=`<div class="n53h"><b>${esc(pname(p))}</b><span class="n53src">ESPN RECENT NEWS</span></div><div class="n53empty">Loading player updates…</div>`;b.classList.add('open');posHover();
    const r=await newsFor(p,context);if(hoverToken!==token)return;const u=r.updates||[];
    b.innerHTML=`<div class="n53h"><b>${esc(pname(p))} · ${esc(ppos(p))} ${esc(pteam(p))}</b><span class="n53src">ROTOWIRE · ID ${esc(r.espnId||'?')}</span></div>${u.length?u.slice(0,2).map(x=>`<div class="n53u"><div class="n53meta">${esc(rel(x.published))} · ROTOWIRE.COM</div><div class="n53headline">${esc(x.headline)}</div>${x.spin?`<div class="n53spin"><b>Spin:</b> ${esc(x.spin)}</div>`:''}</div>`).join(''):`<div class="n53empty">No Rotowire player updates found.${r.articles?.length?` ${r.articles.length} related ESPN article${r.articles.length===1?'':'s'} exist, but they are intentionally excluded from hover.`:''}${r.error?' '+esc(r.error):''}</div>`}`;posHover();
  }

  function installHover(){
    document.addEventListener('mousemove',e=>{pointer={x:e.clientX,y:e.clientY};if(hoverBox().classList.contains('open'))posHover()},{passive:true});
    document.addEventListener('mouseover',e=>{const t=hoverTarget(e.target);if(!t||e.relatedTarget&&t.contains(e.relatedTarget))return;const p=playerFrom(t);if(!p)return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>showHover(p,t),500)});
    document.addEventListener('mouseout',e=>{const t=hoverTarget(e.target);if(!t||e.relatedTarget&&t.contains(e.relatedTarget))return;hideHover()});
  }

  function profilePlayer(){const m=document.querySelector('#careerModal');if(!m?.classList.contains('open'))return null;return playerFrom([document.querySelector('#careerTitle')?.textContent,document.querySelector('#careerHero')?.textContent].filter(Boolean).join(' '))}
  async function renderProfile(){
    const p=profilePlayer();if(!p)return;const modal=document.querySelector('#careerModal'),body=modal?.querySelector('.careerbody');if(!body)return;
    let box=document.querySelector('#careerNewsV53');if(!box){box=document.createElement('section');box.id='careerNewsV53';const grid=document.querySelector('#careerGrid');grid?grid.insertAdjacentElement('beforebegin',box):body.appendChild(box)}
    const key=pid(p)||pname(p);if(box.dataset.player===key&&box.dataset.loaded==='1')return;box.dataset.player=key;box.dataset.loaded='0';box.innerHTML=`<div class="careerN53head"><h3>📰 Recent Player News</h3><span class="n53src">ESPN / ROTOWIRE</span></div><div class="careerN53row">Loading ${esc(pname(p))}…</div>`;
    const r=await newsFor(p,modal);if(box.dataset.player!==key)return;const u=r.updates||[],a=r.articles||[];
    const updateHtml=u.length?`<div class="careerN53list">${u.slice(0,8).map(x=>`<article class="careerN53row"><div class="careerN53meta"><span>${esc(longDate(x.published))}</span><span>ROTOWIRE.COM</span></div><b>${esc(x.headline)}</b>${x.spin?`<div class="careerN53spin"><strong>Spin:</strong> ${esc(x.spin)}</div>`:''}</article>`).join('')}</div>`:`<div class="careerN53row">No Rotowire player updates found for ESPN ID ${esc(r.espnId||'?')}.${r.error?' '+esc(r.error):''}</div>`;
    const articleHtml=a.length?`<details class="careerN53articles"><summary>Related ESPN Articles (${a.length})</summary>${a.slice(0,6).map(x=>x.href?`<a class="careerN53article" href="${esc(x.href)}" target="_blank" rel="noopener"><b>${esc(x.headline)}</b><small>${esc(longDate(x.published))}</small></a>`:`<div class="careerN53article"><b>${esc(x.headline)}</b><small>${esc(longDate(x.published))}</small></div>`).join('')}</details>`:'';
    box.innerHTML=`<div class="careerN53head"><h3>📰 Recent Player News</h3><span class="n53src">ID ${esc(r.espnId||'?')} · ${u.length} ROTOWIRE</span></div>${updateHtml}${articleHtml}`;box.dataset.loaded='1';
  }

  function watchProfile(){let last='';setInterval(()=>{const m=document.querySelector('#careerModal');if(!m?.classList.contains('open')){last='';return}const p=profilePlayer(),k=p?(pid(p)||pname(p)):'';if(k&&k!==last){last=k;setTimeout(renderProfile,60)}},350)}

  function boot(){css();installHover();watchProfile()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.FantasyLensPlayerNews={newsFor,resolveId};
})();