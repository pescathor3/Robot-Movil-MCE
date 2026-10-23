
(function(){
 function placeAlerts(){
  const stage=document.querySelector('.stage');
  const mainty=document.getElementById('maintyFlag');
  const sub=document.getElementById('subflag');
  if(!stage||!mainty||!sub)return;
  let stack=stage.querySelector('#mceTopAlerts');
  if(!stack){stack=document.createElement('div');stack.id='mceTopAlerts';stack.className='mceTopAlerts';stage.appendChild(stack)}
  stack.append(mainty,sub);
  mainty.classList.add('maintyOverlay');sub.classList.add('mceSubOverlay');
  const avatar=mainty.querySelector('.maintyTriggerAvatar');
  const modalImg=document.querySelector('.maintyDialogPicture img');
  if(avatar&&!avatar.getAttribute('src')&&modalImg?.getAttribute('src'))avatar.src=modalImg.src;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',placeAlerts,{once:true});
 else placeAlerts();
})();
