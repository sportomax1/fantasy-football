/* Fantasy Lens v52 — inline workspace for routine views + ESPN news request dedupe. */
(function(){
  'use strict';

  const EXCLUDE=new Set(['careerModal']);
  const NEWS_PATH='/apis/fantasy/v2/games/ffl/news/players';
  let activeModal=null,sourceObserver=null,bodyObserver=null,syncTimer=null,keySeq=0;

  function installNewsEfficiency(){
    if(window.__flNewsFetchV52)return;
    window.__flNewsFetchV52=true;
    const nativeFetch=window.fetch.bind(window),inflight=new Map();
    window.fetch=function(input,init){
      try{
        const raw=typeof input==='string'?input:input?.url;
        if(raw&&String(raw).includes(NEWS_PATH)){
          const u=new URL(raw,location.href);
          // Hover needs two stories and profiles need eight. 12 avoids pulling 50 records per player.
          u.searchParams.set('limit','12');
          const url=u.toString(),method=String(init?.method||'GET').toUpperCase();
          if(method==='GET'){
            if(inflight.has(url))return inflight.get(url).then(r=>r.clone());
            const p=nativeFetch(url,init).finally(()=>setTimeout(()=>inflight.delete(url),250));
            inflight.set(url,p);
            return p.then(r=>r.clone());
          }
        }
      }catch{}
      return nativeFetch(input,init);
    };
  }

  function installCss(){
    if(document.querySelector('#inlineWorkspaceStylesV52'))return;
    const s=document.createElement('style');
    s.id='inlineWorkspaceStylesV52';
    s.textContent=`
      #v52workspace{display:none;margin:8px 0 12px;border:1px solid var(--line);border-radius:13px;background:#f8faf8;overflow:hidden;min-height:260px}
      #v52workspace.open{display:block}
      .v52head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;background:#e9eeeb;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
      .v52headText{min-width:0}.v52headText b{display:block;font-size:12px}.v52headText small{display:block;font-size:7px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v52headActions{display:flex;gap:6px;align-items:center}.v52body{padding:9px;min-height:220px;overflow:auto;max-height:calc(100vh - 190px)}
      .v52body>.modalbox{display:block!important;position:static!important;width:100%!important;max-width:none!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}
      .v52body>.modalbox>.modalhead{display:none!important}.v52body .careerbody,.v52body .v42body{max-height:none!important;overflow:visible!important;padding:0!important}
      .modal.open.v52SourceModal{display:block!important;position:fixed!important;left:-300vw!important;top:0!important;width:2px!important;height:2px!important;min-width:0!important;min-height:0!important;overflow:hidden!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;z-index:-1!important}
      body.v52InlineOpen .draftFilters,body.v52InlineOpen .draftMeta,body.v52InlineOpen #v42intel,body.v52InlineOpen .progress,body.v52InlineOpen .status,body.v52InlineOpen #empty,body.v52InlineOpen #bestStrip,body.v52InlineOpen #matrixTools,body.v52InlineOpen #tablewrap,body.v52InlineOpen #cards,body.v52InlineOpen #compareBar{display:none!important}
      body.v52InlineOpen #v52workspace{display:block!important}
      #careerModal.open{padding:0!important;background:#07141ee8!important;z-index:6000!important}
      #careerModal.open>.modalbox{width:100vw!important;max-width:none!important;height:100vh!important;max-height:100vh!important;margin:0!important;border-radius:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      #careerModal.open .careerbody{flex:1!important;min-height:0!important;overflow:auto!important}
      @media(max-width:760px){.v52body{padding:6px;max-height:calc(100vh - 150px)}.v52head{padding:8px}.v52headActions .btn{padding-left:7px!important;padding-right:7px!important}}
    `;
    document.head.appendChild(s);
  }

  function ensureWorkspace(){
    let w=document.querySelector('#v52workspace');
    if(w)return w;
    w=document.createElement('section');
    w.id='v52workspace';
    w.innerHTML='<div class="v52head"><div class="v52headText"><b id="v52title">Workspace</b><small id="v52sub">Inline app view</small></div><div class="v52headActions"><button class="btn" id="v52back">← Back to Draft</button></div></div><div class="v52body" id="v52body"></div>';
    const anchor=document.querySelector('#v42intel')||document.querySelector('.draftMeta')||document.querySelector('#v42nav');
    if(anchor)anchor.insertAdjacentElement('afterend',w);
    else (document.querySelector('.draftShell')||document.querySelector('.app')||document.body).appendChild(w);
    w.querySelector('#v52back').onclick=()=>{
      closeWorkspace(true);
      setTimeout(()=>document.querySelector('#v42nav [data-a="draft"]')?.click(),0);
    };
    relayWorkspaceEvents(w);
    return w;
  }

  function modalTitle(m){
    return m?.querySelector('.modalhead h2')?.textContent?.trim()||m?.querySelector('.modalhead h3')?.textContent?.trim()||m?.id?.replace(/Modal|V\d+/g,' ').trim()||'Workspace';
  }

  function modalSubtitle(m){
    return m?.querySelector('.modalhead small')?.textContent?.trim()||'Main workspace view · player profiles remain full-screen';
  }

  function sourceElements(box){return box?[box,...box.querySelectorAll('*')]:[]}

  function syncClone(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{
      if(!activeModal||!activeModal.classList.contains('open')){closeWorkspace(false);return}
      const source=activeModal.querySelector('.modalbox'),w=ensureWorkspace(),body=w.querySelector('#v52body');
      if(!source)return;
      const srcEls=sourceElements(source);
      srcEls.forEach(el=>el.dataset.v52Key='v52-'+(++keySeq));
      const clone=source.cloneNode(true),cloneEls=sourceElements(clone);
      // cloneNode copied the keys, which creates a direct event relay map to the live hidden component.
      clone.querySelector('.modalhead')?.remove();
      body.replaceChildren(clone);
      w.querySelector('#v52title').textContent=modalTitle(activeModal);
      w.querySelector('#v52sub').textContent=modalSubtitle(activeModal);
      w.classList.add('open');document.body.classList.add('v52InlineOpen');
    },15);
  }

  function relayWorkspaceEvents(w){
    const body=()=>w.querySelector('#v52body');
    function sourceFor(target){
      const k=target?.closest?.('[data-v52-key]')?.dataset?.v52Key;
      return k&&activeModal?activeModal.querySelector(`[data-v52-key="${CSS.escape(k)}"]`):null;
    }
    body().addEventListener('click',e=>{
      const src=sourceFor(e.target);if(!src)return;
      e.preventDefault();e.stopPropagation();
      if(src.matches('input[type="checkbox"],input[type="radio"]'))src.checked=!src.checked;
      try{src.click()}catch{src.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))}
      setTimeout(syncClone,25);
    });
    body().addEventListener('input',e=>{
      const src=sourceFor(e.target);if(!src)return;
      if('value'in src)src.value=e.target.value;
      if('checked'in src)src.checked=e.target.checked;
      src.dispatchEvent(new Event('input',{bubbles:true}));
      setTimeout(syncClone,20);
    });
    body().addEventListener('change',e=>{
      const src=sourceFor(e.target);if(!src)return;
      if('value'in src)src.value=e.target.value;
      if('checked'in src)src.checked=e.target.checked;
      src.dispatchEvent(new Event('change',{bubbles:true}));
      setTimeout(syncClone,20);
    });
  }

  function watchSource(m){
    sourceObserver?.disconnect();
    sourceObserver=new MutationObserver(muts=>{
      if(!activeModal)return;
      if(!activeModal.classList.contains('open')){closeWorkspace(false);return}
      if(muts.some(x=>x.type==='childList'||x.type==='characterData'||(x.type==='attributes'&&['class','style','value','checked','selected'].includes(x.attributeName))))syncClone();
    });
    sourceObserver.observe(m,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','value','checked','selected']});
  }

  function dockModal(m){
    if(!m||EXCLUDE.has(m.id)||!m.classList.contains('open')||!m.querySelector('.modalbox'))return false;
    if(activeModal&&activeModal!==m)closeWorkspace(true);
    activeModal=m;m.classList.add('v52SourceModal');
    watchSource(m);syncClone();return true;
  }

  function closeWorkspace(closeSource){
    clearTimeout(syncTimer);sourceObserver?.disconnect();sourceObserver=null;
    const m=activeModal;activeModal=null;
    if(m){m.classList.remove('v52SourceModal');if(closeSource)m.classList.remove('open')}
    const w=document.querySelector('#v52workspace');w?.classList.remove('open');
    document.body.classList.remove('v52InlineOpen');
  }

  function scanOpenModals(){
    const career=document.querySelector('#careerModal.open');
    if(career){if(activeModal)closeWorkspace(true);return}
    const opens=[...document.querySelectorAll('.modal.open')].filter(m=>!EXCLUDE.has(m.id)&&!m.classList.contains('v52SourceModal'));
    if(opens.length)dockModal(opens[opens.length-1]);
    else if(activeModal&&!activeModal.classList.contains('open'))closeWorkspace(false);
  }

  function installObservers(){
    bodyObserver?.disconnect();
    bodyObserver=new MutationObserver(()=>scanOpenModals());
    bodyObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('click',e=>{
      const navAction=e.target.closest?.('#v42nav [data-a],#v42watch,#splitShareBtnV48');
      const menuToggle=e.target.closest?.('#v42nav .v42menu>.btn');
      if(navAction&&!menuToggle&&activeModal)closeWorkspace(true);
    },true);
  }

  function boot(){installNewsEfficiency();installCss();ensureWorkspace();installObservers();scanOpenModals()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700),{once:true});else setTimeout(boot,700);
  window.FantasyLensInlineWorkspace={close:()=>closeWorkspace(true),scan:scanOpenModals};
})();