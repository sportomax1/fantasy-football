/* Fantasy Lens v50 compatibility shim — Rotowire-first news + inline workspace. */
(function(){
  const add=(src,key)=>{if(document.querySelector(`script[data-${key}]`))return;const s=document.createElement('script');s.src=src;s.dataset[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]='1';document.head.appendChild(s)};
  add('./player-news-v53.js?v=53','fl-news-v53');
  add('./inline-workspace-v52.js?v=52','fl-inline-v52');
  add('./inline-workspace-controls-v52.js?v=52','fl-inline-controls-v52');
})();
