/* Fantasy Lens v44 — filter v42's own navigation mutations out of its refresh observer. */
(function(){
  'use strict';
  const NativeMutationObserver=window.MutationObserver;
  if(!NativeMutationObserver||window.__fantasyLensV44ObserverGuard)return;
  window.__fantasyLensV44ObserverGuard=true;

  function isNavMutation(record){
    const nav=document.querySelector('#v42nav');
    if(!nav)return false;
    if(record.target===nav||nav.contains(record.target))return true;
    const nodes=[...(record.addedNodes||[]),...(record.removedNodes||[])];
    return nodes.length>0&&nodes.every(node=>node===nav||(node.nodeType===1&&nav.contains(node)));
  }

  window.MutationObserver=function(callback){
    if(callback&&callback.name==='refresh'){
      return new NativeMutationObserver(records=>{
        const meaningful=records.filter(r=>!isNavMutation(r));
        if(meaningful.length)callback(meaningful);
      });
    }
    return new NativeMutationObserver(callback);
  };
  window.MutationObserver.prototype=NativeMutationObserver.prototype;
})();