/* Fantasy Lens v48 — single Split Share nav entry + per-season lead-share sorting. */
(function(){
  'use strict';

  const STORE='fantasyLensSplitShareSortV48';
  let cfg=read();
  let observedRoot=null,rootObserver=null,enhanceTimer=null;

  function read(){
    try{
      const x=JSON.parse(localStorage.getItem(STORE)||'null')||{};
      return {year:Number(x.year)||2026,dir:x.dir==='asc'?'asc':'desc'};
    }catch{return{year:2026,dir:'desc'}}
  }
  function save(){localStorage.setItem(STORE,JSON.stringify(cfg))}

  function patchNav(){
    const nav=document.querySelector('#v42nav');
    if(!nav)return false;

    let btn=nav.querySelector('#splitShareBtnV48');
    if(!btn){
      btn=document.createElement('button');
      btn.id='splitShareBtnV48';
      btn.className='btn';
      const firstMenu=nav.querySelector('.v42menu');
      nav.insertBefore(btn,firstMenu||null);
    }
    btn.textContent='↔ Split Share';
    btn.title='Team-by-year RB / WR / TE / QB usage shares';
    btn.onclick=()=>{
      nav.querySelectorAll('.v42menu').forEach(x=>x.classList.remove('open'));
      if(window.FantasyLensUsageSplits?.open)window.FantasyLensUsageSplits.open();
      else document.querySelector('#rbCommitteeBtnV40')?.click();
      setTimeout(enhance,20);
    };

    // Split analysis belongs on the main nav now, not as separate Team-menu entries.
    for(const menu of nav.querySelectorAll('.v42menu')){
      const title=menu.querySelector(':scope > .btn')?.textContent||'';
      if(!/^Team\b/i.test(title))continue;
      for(const item of [...menu.querySelectorAll('.v42pop button')]){
        const a=item.dataset.a||'';
        if(['rb','wr','usageSplits'].includes(a)||/\b(?:RB|WR|Usage)\s+Splits?\b/i.test(item.textContent||''))item.remove();
      }
    }
    const legacyRB=document.querySelector('#rbCommitteeBtnV40');
    const legacyWR=document.querySelector('#wrSplitBtnV40');
    if(legacyRB)legacyRB.style.display='none';
    if(legacyWR)legacyWR.style.display='none';
    return true;
  }

  function yearsFrom(table){
    return [...table.querySelectorAll('thead th')].slice(1).map(th=>Number(th.querySelector('b')?.textContent||th.textContent)).filter(Number.isFinite);
  }

  function leadShare(row,colIndex){
    const cell=row.children[colIndex];
    if(!cell)return null;
    const pct=cell.querySelector('.splitPctV41');
    if(!pct)return null;
    const v=parseFloat(pct.textContent);
    return Number.isFinite(v)?v:null;
  }

  function sortRows(table){
    const years=yearsFrom(table);
    if(!years.length)return;
    if(!years.includes(cfg.year)){cfg.year=years.includes(2026)?2026:years[0];save()}
    const col=years.indexOf(cfg.year)+1;
    const tbody=table.querySelector('tbody');
    if(!tbody)return;
    const rows=[...tbody.querySelectorAll(':scope > tr')];
    const decorated=rows.map((row,i)=>({
      row,i,
      share:leadShare(row,col),
      team:(row.children[0]?.textContent||'').trim()
    }));
    decorated.sort((a,b)=>{
      const av=a.share,bv=b.share;
      if(av==null&&bv==null)return a.team.localeCompare(b.team);
      if(av==null)return 1;
      if(bv==null)return-1;
      const diff=cfg.dir==='desc'?bv-av:av-bv;
      return diff||a.team.localeCompare(b.team);
    });
    const wanted=decorated.map(x=>x.row);
    if(wanted.some((r,i)=>r!==rows[i])){
      const frag=document.createDocumentFragment();
      wanted.forEach(r=>frag.appendChild(r));
      tbody.appendChild(frag);
    }

    [...table.querySelectorAll('thead th')].slice(1).forEach((th,i)=>{
      const active=years[i]===cfg.year;
      th.classList.toggle('splitSortYearActiveV48',active);
      th.title=`Sort by ${years[i]} lead share`;
      th.onclick=()=>{
        const y=years[i];
        if(cfg.year===y)cfg.dir=cfg.dir==='desc'?'asc':'desc';
        else{cfg.year=y;cfg.dir='desc'}
        save();enhance();
      };
    });
  }

  function controls(root,table){
    const toolbar=root.querySelector('.splitToolbarV41');
    if(!toolbar)return;
    const oldSort=root.querySelector('#splitSortV41');
    if(oldSort)oldSort.style.display='none';
    const years=yearsFrom(table);
    if(!years.length)return;
    if(!years.includes(cfg.year))cfg.year=years.includes(2026)?2026:years[0];

    let wrap=root.querySelector('#splitSortControlsV48');
    if(!wrap){
      wrap=document.createElement('span');
      wrap.id='splitSortControlsV48';
      wrap.className='splitSortControlsV48';
      const search=root.querySelector('#splitSearchV41');
      toolbar.insertBefore(wrap,search||null);
    }
    wrap.innerHTML=`<select class="field" id="splitSortYearV48" title="Season used to rank teams">${years.map(y=>`<option value="${y}" ${cfg.year===y?'selected':''}>Sort ${y}</option>`).join('')}</select><select class="field" id="splitSortDirV48" title="Sort by the lead player's share"><option value="desc" ${cfg.dir==='desc'?'selected':''}>Hogs first ↓ DESC</option><option value="asc" ${cfg.dir==='asc'?'selected':''}>Most split first ↑ ASC</option></select>`;
    wrap.querySelector('#splitSortYearV48').onchange=e=>{cfg.year=Number(e.target.value)||2026;save();sortRows(table);status(root)};
    wrap.querySelector('#splitSortDirV48').onchange=e=>{cfg.dir=e.target.value==='asc'?'asc':'desc';save();sortRows(table);status(root)};
  }

  function status(root){
    const summary=root.querySelector('.splitSummaryV41');
    if(!summary)return;
    let x=summary.querySelector('#splitSortStatusV48');
    if(!x){x=document.createElement('span');x.id='splitSortStatusV48';summary.appendChild(x)}
    x.innerHTML=`<b>${cfg.year}</b> ${cfg.dir==='desc'?'Hogs first ↓':'Most split first ↑'}`;
  }

  function enhance(){
    clearTimeout(enhanceTimer);
    enhanceTimer=setTimeout(()=>{
      patchNav();
      const root=document.querySelector('#committeeBodyV40');
      const table=root?.querySelector('.splitMatrixV41');
      if(!root||!table)return;
      const title=document.querySelector('#committeeModalV40 .modalhead h2');
      const sub=document.querySelector('#committeeModalV40 .modalhead small');
      if(title)title.textContent='Split Share';
      if(sub)sub.textContent='RB · WR · TE · QB | team-by-year usage share';
      controls(root,table);
      sortRows(table);
      status(root);
      attachRootObserver(root);
    },0);
  }

  function attachRootObserver(root){
    if(observedRoot===root)return;
    rootObserver?.disconnect();
    observedRoot=root;
    rootObserver=new MutationObserver(()=>{
      if(!root.querySelector('#splitSortControlsV48')||!root.querySelector('.splitSortYearActiveV48'))enhance();
    });
    rootObserver.observe(root,{childList:true,subtree:true});
  }

  function installCss(){
    if(document.querySelector('#splitShareStylesV48'))return;
    const s=document.createElement('style');s.id='splitShareStylesV48';s.textContent=`
      #splitShareBtnV48{white-space:nowrap}
      .splitSortControlsV48{display:inline-flex;gap:6px;align-items:center}
      .splitSortYearActiveV48{background:#dce8e1!important;box-shadow:inset 0 -3px 0 #17324a}
      .splitSortYearActiveV48 .splitYearHeadV41 b::after{content:' ↓';font-size:8px}
      @media(max-width:760px){.splitSortControlsV48{width:100%}.splitSortControlsV48 .field{flex:1;min-width:0}}
    `;document.head.appendChild(s);
  }

  function boot(){installCss();patchNav();enhance()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',()=>setTimeout(boot,700));
  setInterval(()=>{patchNav();const m=document.querySelector('#committeeModalV40.open');if(m)enhance()},1500);
})();
