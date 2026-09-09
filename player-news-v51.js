/* Fantasy Lens v51 compatibility shim — Recent News implementation lives in v53. */
if(!document.querySelector('script[data-fl-news-v53]')){
  const s=document.createElement('script');
  s.src='./player-news-v53.js?v=53';
  s.dataset.flNewsV53='1';
  document.head.appendChild(s);
}
