/* Fantasy Lens v52 control relay patch — checkbox/radio controls toggle exactly once. */
(function(){
  function install(){
    const body=document.querySelector('#v52body');if(!body||body.dataset.v52ControlPatch)return false;
    body.dataset.v52ControlPatch='1';
    body.addEventListener('click',e=>{
      const input=e.target.closest?.('input[type="checkbox"][data-v52-key],input[type="radio"][data-v52-key]');
      if(!input)return;
      const key=input.dataset.v52Key,source=document.querySelector(`.modal.open.v52SourceModal [data-v52-key="${CSS.escape(key)}"]`);
      if(!source)return;
      e.preventDefault();e.stopImmediatePropagation();
      source.click();
      setTimeout(()=>window.FantasyLensInlineWorkspace?.scan?.(),30);
    },true);
    return true;
  }
  if(!install())setTimeout(install,900);
  window.addEventListener('load',()=>setTimeout(install,900));
})();