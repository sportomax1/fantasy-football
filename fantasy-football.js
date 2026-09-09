/* Fantasy Lens v40 — preserve v39 and add RB/WR team usage split analysis. */
document.write('<script src="https://cdn.jsdelivr.net/gh/sportomax1/fantasy-football@875aed40deb0a246f0cd8a82c7e61a5abd774069/fantasy-football.js"><\/script>');
document.write('<script src="./committee-splits.js?v=1"><\/script>');
/* The split modal redraws as its search filters; restore focus/caret after each redraw. */
document.addEventListener('input',function(e){
  if(e.target&&e.target.id==='splitSearchV40'){
    var n=String(e.target.value||'').length;
    setTimeout(function(){var x=document.querySelector('#splitSearchV40');if(x){x.focus();try{x.setSelectionRange(n,n)}catch(_){}}},0);
  }
});
