
/* Control táctil: un dedo gira; dos dedos hacen zoom y desplazan.
   Se instala después del visor principal para respetar los controles de ratón existentes. */
(function(){
 function install(el,opts){
   if(!el)return;
   const pointers=new Map();
   let gesture=null;
   const oldDown=el.onpointerdown,oldMove=el.onpointermove,oldUp=el.onpointerup,oldCancel=el.onpointercancel;
   const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
   const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
   function clearMouseDrag(){opts.stopMouseDrag()}
   function baseline(){
     if(pointers.size<2){gesture=null;return}
     const [a,b]=[...pointers.values()];
     gesture={d:Math.max(5,distance(a,b)),m:mid(a,b),zoom:opts.getZoom(),pan:opts.getPan()};
     clearMouseDrag();
   }
   el.onpointerdown=function(e){
     if(e.pointerType!=='touch'){if(oldDown)oldDown.call(this,e);return}
     e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
     try{el.setPointerCapture(e.pointerId)}catch(_){}
     if(pointers.size===1){gesture=null;clearMouseDrag()}
     else baseline();
   };
   el.onpointermove=function(e){
     if(e.pointerType!=='touch'){if(oldMove)oldMove.call(this,e);return}
     if(!pointers.has(e.pointerId))return;
     e.preventDefault();const prev=pointers.get(e.pointerId);
     pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
     if(pointers.size===1){
       const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
       opts.rotate(dx,dy);
     }else if(gesture){
       const [a,b]=[...pointers.values()],m=mid(a,b),d=Math.max(5,distance(a,b));
       opts.setZoom(Math.max(.25,Math.min(8,gesture.zoom*d/gesture.d)));
       const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);
       opts.setPan(gesture.pan[0]+2*(m.x-gesture.m.x)/w,gesture.pan[1]-2*(m.y-gesture.m.y)/h);
     }
     opts.redraw();
   };
   function finish(e){
     if(e.pointerType!=='touch'){if(oldUp)oldUp.call(this,e);return}
     pointers.delete(e.pointerId);
     if(pointers.size>=2)baseline();else gesture=null;
     try{if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId)}catch(_){}
     clearMouseDrag();
   }
   el.onpointerup=finish;
   el.onpointercancel=function(e){if(e.pointerType==='touch')finish.call(this,e);else if(oldCancel)oldCancel.call(this,e)};
 }
 install(canvas,{
   stopMouseDrag:()=>{drag=false},getZoom:()=>zoom,getPan:()=>[panX,panY],
   rotate:(dx,dy)=>{az-=dx*.008;el=Math.max(-1.5,Math.min(1.5,el+dy*.008))},
   setZoom:v=>{zoom=v},setPan:(x,y)=>{panX=x;panY=y},redraw:()=>{dirty=true}
 });
 install(subCanvas,{
   stopMouseDrag:()=>{subDrag=false},getZoom:()=>subZoom,getPan:()=>[subPanX,subPanY],
   rotate:(dx,dy)=>{subAz-=dx*.008;subEl=Math.max(-1.5,Math.min(1.5,subEl+dy*.008))},
   setZoom:v=>{subZoom=v},setPan:(x,y)=>{subPanX=x;subPanY=y},redraw:()=>{subDirty=true}
 });
 install(catalogCanvas,{
   stopMouseDrag:()=>{catalogDrag=false},getZoom:()=>catalogZoom,getPan:()=>[catalogPanX,catalogPanY],
   rotate:(dx,dy)=>{catalogAz-=dx*.008;catalogEl=Math.max(-1.5,Math.min(1.5,catalogEl+dy*.008))},
   setZoom:v=>{catalogZoom=v},setPan:(x,y)=>{catalogPanX=x;catalogPanY=y},redraw:()=>{catalogDirty=true}
 });
})();

// Bridge: el editor puede modificar geometría real sin recrear la escena.
window.MCE_REPAIR_BRIDGE={
 getStep:()=>step,
 setStep:v=>{step=v},
 refs:()=>[...new Set(visibleParts.filter(p=>p.s===step).map(p=>p.r))],
 getTargets:(ref)=>parts.map((p,i)=>({p,i})).filter(x=>x.p.s===step&&x.p.r===ref),
 apply:(ref,triangles,lines)=>{
  const targets=parts.map((p,i)=>({p,i})).filter(x=>x.p.s===step&&x.p.r===ref);
  if(!targets.length)throw Error('La referencia no está en este paso');
  for(const {p,i} of targets){p.t=triangles.slice();rawEdges[i]=lines.slice()}
  const old=gpu[step];gl.deleteBuffer(old.buffer);gpu[step]=buildBuffers(parts.filter(p=>p.s===step));
  const prev=edgeBuffers[step];gl.deleteBuffer(prev.buffer);
  const all=parts.flatMap((p,i)=>p.s===step?(rawEdges[i]||[]):[]);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(all),gl.STATIC_DRAW);
  edgeBuffers[step]={buffer:b,count:all.length/3};dirty=true;catalogDirty=true;subDirty=true;update();
 },
 original:()=>parts.map((p,i)=>({ref:p.r,step:p.s,triangles:p.t.slice(),lines:(rawEdges[i]||[]).slice()}))
};
