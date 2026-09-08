/* Fantasy Lens v30 bootstrap — hardened analysis-nav activation and click routing. */
(function(){
  const V27_URL='https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@e5105c1489b246674a8c960c53cdfeb46e3b3c27/fantasy-football.js';
  let retried=false;

  // Load the immutable advanced layer synchronously. It in turn loads the
  // established base layers, preserving the three-file repository layout.
  document.write('<script src="'+V27_URL+'"><\/script>');

  function ensureFinalNav(){
    const nav=document.querySelector('#viewNav');
    if(!nav)return false;

    const specs=[
      ['draft','Draft Board'],
      ['overview','Overview'],
      ['matrix','Year Matrix'],
      ['health','Health'],
      ['weekly','Weekly Matchups']
    ];
    const desired=[];

    for(const [view,label] of specs){
      let b=nav.querySelector(`[data-view="${view}"]`);
      if(!b){
        b=document.createElement('button');
        b.className='btn';
        b.dataset.view=view;
      }
      b.textContent=label;
      desired.push(b);
    }

    const depth=document.querySelector('#exploreBtn');
    const defense=document.querySelector('#defenseBtn');
    const kicker=document.querySelector('#kickerBtn');
    if(depth){depth.textContent='Depth';depth.classList.add('btn');desired.push(depth)}
    if(defense){defense.textContent='Defense';defense.classList.add('btn','dataViewBtn');desired.push(defense)}
    if(kicker){kicker.textContent='Kicker';kicker.classList.add('btn','dataViewBtn');desired.push(kicker)}

    // Remove legacy header copies if an older chained layer created them.
    document.querySelector('.appbarInner #exploreBtn')?.remove();
    document.querySelector('.appbarInner #defenseBtn')?.remove();
    document.querySelector('.appbarInner #kickerBtn')?.remove();
    document.querySelector('.appbarInner #specialBtn')?.remove();

    // Reorder only when necessary. Avoid repeatedly appendChild-ing already
    // ordered nodes, which can create a MutationObserver/reflow loop.
    desired.forEach((el,i)=>{
      const at=nav.children[i];
      if(at!==el)nav.insertBefore(el,at||null);
    });
    return desired.length===8;
  }

  function wireViewTabs(){
    const nav=document.querySelector('#viewNav');
    if(!nav||typeof render!=='function')return;

    // Replace the base delegated handler with one explicit route for all five
    // data views. Depth/Defense/Kicker keep their dedicated modal handlers.
    nav.onclick=e=>{
      const b=e.target.closest('[data-view]');
      if(!b||!nav.contains(b))return;
      const view=b.dataset.view;
      if(!['draft','overview','matrix','health','weekly'].includes(view))return;

      currentView=view;
      localStorage.setItem('fantasyLensView',currentView);
      state.sort=currentView==='health'?'healthPct':'fantasy';
      state.dir=-1;

      render();
      if(['overview','matrix','health'].includes(view)&&typeof ensureHistoricalViews==='function'){
        Promise.resolve(ensureHistoricalViews(false)).catch(err=>console.warn('historical view hydration failed',err));
      }
    };
  }

  function activateAdvancedViews(){
    try{
      if(typeof installMatchupSettings==='function')installMatchupSettings();
      if(typeof installDefenseModal==='function')installDefenseModal();
      if(typeof installKickerModal==='function')installKickerModal();
      ensureFinalNav();
      wireViewTabs();

      // Moving a DOM node preserves onclick, but explicitly restore Depth's
      // base action in case an older layer replaced it during initialization.
      if(typeof openLab==='function'&&document.querySelector('#exploreBtn'))document.querySelector('#exploreBtn').onclick=openLab;

      if(typeof render==='function')render();
      setTimeout(()=>{ensureFinalNav();wireViewTabs()},60);
    }catch(e){console.error('Fantasy Lens v30 activation failed',e)}
  }

  function advancedReady(){
    // Weekly Matchups is now static HTML, so its button alone is NOT proof
    // that the v27 advanced render layer actually initialized.
    return !!document.querySelector('#fantasyLensV27Styles') &&
      typeof render==='function' &&
      typeof installDefenseModal==='function' &&
      typeof installKickerModal==='function';
  }

  function retryAdvancedLayer(){
    if(retried){activateAdvancedViews();return}
    retried=true;
    const oldWrite=document.write;
    document.write=()=>{};
    const s=document.createElement('script');
    s.src=V27_URL+'?retry=v30-'+Date.now();
    s.onload=()=>{
      document.write=oldWrite;
      activateAdvancedViews();
    };
    s.onerror=()=>{
      document.write=oldWrite;
      console.error('Fantasy Lens v30 failed to reload advanced-view layer');
      ensureFinalNav();
      wireViewTabs();
    };
    document.body.appendChild(s);
  }

  window.addEventListener('load',()=>{
    setTimeout(()=>{
      ensureFinalNav();
      if(advancedReady())activateAdvancedViews();
      else retryAdvancedLayer();
    },100);
  });
})();