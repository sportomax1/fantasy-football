/* Fantasy Lens v50 compatibility shim — corrected news implementation lives in v51. */
if(!document.querySelector('script[data-fl-news-v51]')){
  const s=document.createElement('script');
  s.src='./player-news-v51.js?v=51';
  s.dataset.flNewsV51='1';
  document.head.appendChild(s);
}
