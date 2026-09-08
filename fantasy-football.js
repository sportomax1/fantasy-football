/* Fantasy Lens v28 bootstrap — fixes v27 activation ordering without adding repo files. */
(function(){
  const V27_URL='https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@e5105c1489b246674a8c960c53cdfeb46e3b3c27/fantasy-football.js';
  document.write('<script src="'+V27_URL+'"><\/script>');

  function activateAdvancedViews(){
    try{
      if(typeof installMatchupSettings==='function') installMatchupSettings();
      if(typeof installDefenseModal==='function') installDefenseModal();
      if(typeof installKickerModal==='function') installKickerModal();
      if(typeof render==='function') render();
    }catch(e){console.error('Fantasy Lens v28 activation failed',e)}
  }

  window.addEventListener('load',()=>{
    setTimeout(()=>{
      if(document.querySelector('#viewNav [data-view="weekly"]')){
        activateAdvancedViews();
        return;
      }

      // v27 can execute before its chained base globals are ready. Re-run the
      // immutable v27 patch once the page is fully loaded, while suppressing
      // its document.write bootstrap because the base/v26 layer is now ready.
      const oldWrite=document.write;
      document.write=()=>{};
      const s=document.createElement('script');
      s.src=V27_URL+'?retry=v28-'+Date.now();
      s.onload=()=>{
        document.write=oldWrite;
        activateAdvancedViews();
      };
      s.onerror=()=>{
        document.write=oldWrite;
        console.error('Fantasy Lens v28 failed to reload advanced-view patch');
      };
      document.body.appendChild(s);
    },80);
  });
})();
