
(()=>{
  window.MCE_TIPS=window.MCE_STUDENT_TIPS||window.MCE_TIPS||{};
  const trigger=document.getElementById('maintyFlag');
  const modal=document.getElementById('maintyModal');
  const dialog=modal.querySelector('.maintyDialog');
  const txt=document.getElementById('maintyAdvice');
  const closeButton=document.getElementById('maintyClose');
  const doneButton=document.getElementById('maintyConfirm');
  let activeStep=null,returnFocus=null;
  function closeMessage(restoreFocus=true){
    if(modal.hidden)return;
    modal.hidden=true;document.body.classList.remove('maintyModalOpen');
    if(restoreFocus&&returnFocus&&returnFocus.isConnected&&!returnFocus.hidden)returnFocus.focus();
    returnFocus=null;
  }
  function refresh(){
    const entry=window.MCE_TIPS?.[step];
    const enabled=!!(entry&&entry.enabled&&String(entry.text||'').trim());
    // A step change closes the message instead of retaining stale instructions.
    if(activeStep!==step){closeMessage(false);activeStep=step;}
    trigger.hidden=!enabled;
    txt.textContent=enabled?String(entry.text):'';
    if(!enabled)closeMessage(false);
  }
  trigger.addEventListener('click',()=>{
    refresh();if(trigger.hidden)return;
    returnFocus=document.activeElement;
    modal.hidden=false;document.body.classList.add('maintyModalOpen');
    closeButton.focus();
  });
  closeButton.addEventListener('click',()=>closeMessage());
  doneButton.addEventListener('click',()=>closeMessage());
  document.getElementById('maintyBackdrop').addEventListener('click',()=>closeMessage());
  document.addEventListener('keydown',event=>{
    if(modal.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closeMessage();return;}
    if(event.key==='Tab'){
      const focusables=[closeButton,doneButton].filter(el=>!el.disabled);
      if(event.shiftKey&&document.activeElement===focusables[0]){event.preventDefault();focusables[focusables.length-1].focus()}
      else if(!event.shiftKey&&document.activeElement===focusables[focusables.length-1]){event.preventDefault();focusables[0].focus()}
      else if(!dialog.contains(document.activeElement)){event.preventDefault();focusables[0].focus()}
    }
  });
  window.MCE_REFRESH_TIP=refresh;
  const beforeTipsUpdate=update;
  update=function(){beforeTipsUpdate();refresh()};
  refresh();
})();
