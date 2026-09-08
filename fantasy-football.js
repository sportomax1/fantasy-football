/* Fantasy Lens v29 bootstrap — fixes activation and enforces final analysis navigation. */
(function(){
  const V27_URL='https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@e5105c1489b246674a8c960c53cdfeb46e3b3c27/fantasy-football.js';
  document.write('<script src="'+V27_URL+'"><\/script>');

  function ensureFinalNav(){
    const nav=document.querySelector('#viewNav');
    if(!nav)return false;

    const wanted=[
      ['draft','Draft Board'],
      ['overview','Overview'],
      ['matrix','Year Matrix'],
      ['health','Health'],
      ['weekly','Weekly Matchups']
    ];

    for(const [view,label] of wanted){
      let b=nav.querySelector(`[data-view="${view}"]`);
      if(!b){
        b=document.createElement('button');
        b.className='btn';
        b.dataset.view=view;
        nav.appendChild(b);
      }
      b.textContent=label;
    }

    const depth=document.querySelector('#exploreBtn');
    if(depth){depth.textContent='Depth';depth.classList.add('btn');nav.appendChild(depth)}

    const defense=document.querySelector('#defenseBtn');
    if(defense){defense.textContent='Defense';defense.classList.add('btn');nav.appendChild(defense)}

    const kicker=document.querySelector('#kickerBtn');
    if(kicker){kicker.textContent='Kicker';kicker.classList.add('btn');nav.appendChild(kicker)}

    document.querySelector('.appbarInner #specialBtn')?.remove();

    const order=[
      nav.querySelector('[data-view="draft"]'),
      nav.querySelector('[data-view="overview"]'),
      nav.querySelector('[data-view="matrix"]'),
      nav.querySelector('[data-view="health"]'),
      nav.querySelector('[data-view="weekly"]'),
      depth,defense,kicker
    ].filter(Boolean);
    for(const el of order)nav.appendChild(el);
    return !!(depth&&defense&&kicker&&nav.querySelector('[data-view="weekly"]'));
  }

  function activateAdvancedViews(){
    try{
      if(typeof installMatchupSettings==='function') installMatchupSettings();
      if(typeof installDefenseModal==='function') installDefenseModal();
      if(typeof installKickerModal==='function') installKickerModal();
      ensureFinalNav();
      if(typeof render==='function') render();
      setTimeout(ensureFinalNav,40);
      setTimeout(ensureFinalNav,250);
    }catch(e){console.error('Fantasy Lens v29 activation failed',e)}
  }

  window.addEventListener('load',()=>{
    setTimeout(()=>{
      if(document.querySelector('#viewNav [data-view="weekly"]')){
        activateAdvancedViews();
        return;
      }

      // Re-run immutable v27 after the base layer is ready. Suppress its
      // document.write bootstrap because that base layer is already loaded.
      const oldWrite=document.write;
      document.write=()=>{};
      const s=document.createElement('script');
      s.src=V27_URL+'?retry=v29-'+Date.now();
      s.onload=()=>{
        document.write=oldWrite;
        activateAdvancedViews();
      };
      s.onerror=()=>{
        document.write=oldWrite;
        console.error('Fantasy Lens v29 failed to reload advanced-view patch');
      };
      document.body.appendChild(s);
    },80);

    // A small observer keeps older chained scripts from moving these controls
    // back into the dark utility header after initialization.
    const nav=document.querySelector('#viewNav'),bar=document.querySelector('.appbarInner');
    if(nav&&bar){
      let busy=false;
      const obs=new MutationObserver(()=>{
        if(busy)return;busy=true;
        requestAnimationFrame(()=>{ensureFinalNav();busy=false});
      });
      obs.observe(nav,{childList:true});
      obs.observe(bar,{childList:true});
    }
  });
})();