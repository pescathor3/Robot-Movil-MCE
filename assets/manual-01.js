
'use strict';
const parts=window.AVIONETA||[];let visibleParts=parts.filter(p=>!p._overlay);const canvas=document.getElementById('view'),gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,preserveDrawingBuffer:false});
const error=document.getElementById('error');
if(!gl){error.style.display='grid';error.textContent='Este navegador no pudo activar WebGL2. Activa la aceleración por hardware de Edge o prueba Chrome.';throw Error('WebGL2 unavailable')}
const vs=`#version 300 es
precision highp float;
in vec3 aPosition; in vec3 aNormal; in vec3 aColor; in float aOpacity;
uniform vec3 uCenter; uniform vec2 uPan; uniform float uAz,uEl,uScale,uAspect,uDepth;
uniform float uBright; uniform float uMirror; uniform float uFocus; uniform float uMirrorExtra; uniform vec3 uTint; uniform vec3 uAssemblyOffset;
out vec3 vColor; out float vOpacity;
void main(){
vec3 p=aPosition+uAssemblyOffset-uCenter;
float ca=cos(uAz),sa=sin(uAz),ce=cos(uEl),se=sin(uEl);
float x=(p.x*uMirror)*ca-p.z*sa;
float z=(p.x*uMirror)*sa+p.z*ca;
float y=p.y*ce-z*se;
float d=p.y*se+z*ce;
gl_Position=vec4(x*uScale/uAspect+uPan.x,y*uScale+uPan.y,-d*uDepth,1.0);
vec3 n=normalize(aNormal);
float diffuse=abs(dot(n,normalize(vec3(-0.38,0.72,0.57))));
float lighting=0.69+0.31*diffuse;
vec3 base=aColor*lighting;vOpacity=aOpacity;
if(uFocus<0.0){vColor=mix(base,vec3(.84,.87,.90),.62);}
else if(uFocus>0.0){
 float pulse=uFocus;
 vColor=base;
}else{vColor=base;}
}`;
const fs=`#version 300 es
precision highp float;
in vec3 vColor; in float vOpacity; out vec4 fragColor;
void main(){fragColor=vec4(vColor,vOpacity);}`;
function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const loc={};for(let name of ['uCenter','uPan','uAz','uEl','uScale','uAspect','uDepth','uBright','uMirror','uFocus','uTint','uAssemblyOffset'])loc[name]=gl.getUniformLocation(program,name);
const colors={0:'#1B2A34',1:'#1E5AA8',2:'#269b4d',4:'#B40000',5:'#d4b037',6:'#9a755b',7:'#8A928D',8:'#41444b',9:'#528dcb',10:'#58AB41',11:'#00AAA4',14:'#FAC80A',15:'#F4F4F4',19:'#e9bc4c',25:'#e69e3b',70:'#a8b4c1',71:'#a8abb0',72:'#646464',73:'#5b7da5',74:'#7FC475',78:'#FFC995',85:'#441A91',110:'#26469A',191:'#FCAC00',100009:'#5484b6',16:'#F4F4F4',212:'#9DC3F7',41:'#559AB7',47:'#F59D29',256:'#292d35'};
Object.assign(colors,window.MCE_EXPORT_PALETTE||{});
const alphas={...(window.MCE_EXPORT_ALPHA||{})},pieceAlphas={...(window.MCE_EXPORT_PIECE_ALPHA||{})};
parts.forEach((p,i)=>{p.mceIndex=i});
// Identificador estable por unidad física. Las subgeometrías de estampados se asocian
// a la misma pieza lógica, pero conservan los colores LDraw de sus detalles impresos.
let mceLogicalMain=null,mceMainBaseColor=null;
parts.forEach((p,i)=>{
 if(!p._overlay){mceLogicalMain='main:'+i;mceMainBaseColor=p.c;}
 p.mcePieceId=mceLogicalMain||('main:'+i);
 p.mceBaseColor=mceMainBaseColor??p.c;
});
const mcePieceColors={...(window.MCE_PIECE_COLORS||{})};
function clampAlpha(v){return Math.max(0.08,Math.min(1,Number(v)||0))}
function opacityOf(p){const own=p.mceIndex!=null?pieceAlphas[p.mceIndex]:undefined;return own!=null?clampAlpha(own):(alphas[p.c]!=null?clampAlpha(alphas[p.c]):1)}
function makeGpuBuffer(g,data){const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array(data),g.STATIC_DRAW);return b}
function releaseGpuPair(g,b){if(b?.buffer)g.deleteBuffer(b.buffer);if(b?.transparentBuffer)g.deleteBuffer(b.transparentBuffer)}

function color(code){const h=colors[code]||'#a6aeba';return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)}
function mceColorOfPiece(p){
 const override=p?.mcePieceId&&mcePieceColors[p.mcePieceId];
 // Una subpieza con material LDraw exclusivo puede transferir su color también
 // a la instancia ya ensamblada del conjunto (por ejemplo: llanta/rin).
 let inherited=null;
 const children=window.SUBASSEMBLIES?.[String(p.r||'').toLowerCase()]?.steps;
 if(children?.length){
  const matches=children.map((q,i)=>({q,i})).filter(x=>!x.q._overlay&&x.q.c===p.c);
  if(matches.length===1)inherited=mcePieceColors['sub:'+String(p.r).toLowerCase()+':'+matches[0].i]||null;
 }
 const finalColor=inherited||((p._overlay&&p.c!==p.mceBaseColor)?null:override);
 if(!finalColor)return color(p.c);
 return [1,3,5].map(i=>parseInt(finalColor.slice(i,i+2),16)/255);
}
function mceHexOfPiece(p){return mcePieceColors[p.mcePieceId]||colors[p.c]||'#a6aeba'}
let bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],vertexCount=0;
for(const p of parts){for(let i=0;i<p.t.length;i+=3){for(let k=0;k<3;k++){bounds[k]=Math.min(bounds[k],p.t[i+k]);bounds[k+3]=Math.max(bounds[k+3],p.t[i+k])}}vertexCount+=p.t.length/3}
const center=[0,1,2].map(i=>(bounds[i]+bounds[i+3])/2),size=Math.max(...[0,1,2].map(i=>bounds[i+3]-bounds[i]));
const maxStep=Math.max(0,...parts.map(p=>p.s)),stepInput=document.getElementById('seek');stepInput.max=maxStep;
const mceNormalsCache=new WeakMap();
function mceSoftNormals(p){
 if(!/(wheel|rueda|tire|tyre|57519|41897|56908)/i.test(String(p.r||'')))return null;
 const existing=mceNormalsCache.get(p);if(existing)return existing;
 const t=p.t,n=t.length,all=new Float32Array(n),localNormals=new Float32Array(n),groups=new Map();
 const key=(x,y,z)=>`${Math.round(x*1000)},${Math.round(y*1000)},${Math.round(z*1000)}`;
 for(let i=0;i<n;i+=9){
  const ax=t[i],ay=-t[i+1],az=t[i+2],bx=t[i+3],by=-t[i+4],bz=t[i+5],cx=t[i+6],cy=-t[i+7],cz=t[i+8];
  let nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
  const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
  for(let j=0;j<9;j+=3){
   localNormals.set([nx,ny,nz],i+j);
   const k=key(t[i+j],t[i+j+1],t[i+j+2]);let arr=groups.get(k);
   if(!arr){arr=[];groups.set(k,arr);}arr.push(i+j);
  }
 }
 for(let i=0;i<n;i+=3){
  const k=key(t[i],t[i+1],t[i+2]),src=groups.get(k)||[],nx=localNormals[i],ny=localNormals[i+1],nz=localNormals[i+2];
  let sx=0,sy=0,sz=0;
  for(let j=0;j<src.length;j++){
   const at=src[j],a=localNormals[at],b=localNormals[at+1],c=localNormals[at+2];
   if(nx*a+ny*b+nz*c>=0.8){sx+=a;sy+=b;sz+=c;}
  }
  const m=Math.hypot(sx,sy,sz)||1;
  all[i]=sx/m;all[i+1]=sy/m;all[i+2]=sz/m;
 }
 mceNormalsCache.set(p,all);return all;
}
function buildBuffers(list){
 const opaque=[],transparent=[];
 for(const p of list){const t=p.t,c=mceColorOfPiece(p),alpha=opacityOf(p),data=alpha<.999?transparent:opaque,soft=mceSoftNormals(p);
  for(let i=0;i<t.length;i+=9){
   const ax=t[i],ay=-t[i+1],az=t[i+2],bx=t[i+3],by=-t[i+4],bz=t[i+5],cx=t[i+6],cy=-t[i+7],cz=t[i+8];
   let nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
   const norm=Math.hypot(nx,ny,nz)||1;nx/=norm;ny/=norm;nz/=norm;
   for(const [j,v] of [[ax,ay,az],[bx,by,bz],[cx,cy,cz]].entries()){
    const off=i+j*3; data.push(...v,soft?soft[off]:nx,soft?soft[off+1]:ny,soft?soft[off+2]:nz,...c,alpha);
   }
  }
 }
 return {buffer:makeGpuBuffer(gl,opaque),count:opaque.length/10,transparentBuffer:makeGpuBuffer(gl,transparent),transparentCount:transparent.length/10,totalCount:(opaque.length+transparent.length)/10};
}

// v1.0.5: cámara orbital con punto focal dinámico y zoom anclado al cursor.
// El desplazamiento de pantalla se convierte en un pivote 3D antes de girar.
function orbitFocus(center,panX,panY,az,el,scale,aspect,mirror){
 if(Math.abs(panX)+Math.abs(panY)<1e-10)return [0,0];
 const sx=-panX*aspect/scale,sy=-panY/scale;
 const ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
 const zr=-sy*se;
 const dx=(sx*ca+zr*sa)/mirror,dy=sy*ce,dz=-sx*sa+zr*ca;
 center[0]+=dx;center[1]+=dy;center[2]+=dz;
 return [0,0];
}
function cursorZoom(event,canvas,oldZoom,limitMin,limitMax,panX,panY){
 event.preventDefault();
 const next=Math.max(limitMin,Math.min(limitMax,oldZoom*Math.exp(-event.deltaY*.001)));
 const factor=next/oldZoom;
 const rect=canvas.getBoundingClientRect();
 const cx=2*(event.clientX-rect.left)/Math.max(1,rect.width)-1;
 const cy=1-2*(event.clientY-rect.top)/Math.max(1,rect.height);
 return [next,cx+(panX-cx)*factor,cy+(panY-cy)*factor];
}

const mainFocus=[center[0],-center[1],center[2]];
const originalMainFocus=[...mainFocus];
// Animación de inserción: desplaza sólo la geometría y los contornos del paso activo.
const animUI={play:document.getElementById('animPlay'),replay:document.getElementById('animReplay'),stop:document.getElementById('animStop'),seek:document.getElementById('animSeek'),speed:document.getElementById('animSpeed'),direction:document.getElementById('animDirection'),auto:document.getElementById('animAuto'),state:document.getElementById('animState')};
let animProgress=1,animPlaying=false,animLast=0,animDirectionSign=1;
const directionKey='makermachine-v12-direcciones-v1';
let stepDirections={...(window.MCE_DIRECTIONS||{})};
if(!window.MCE_STUDENT_MODE){}
let awaitingInsertion=false;
function storeDirections(){if(window.MCE_STUDENT_MODE)return;try{localStorage.setItem(directionKey,JSON.stringify(stepDirections))}catch(e){}}
function syncStepDirection(){animUI.direction.value=stepDirections[step]||'auto'}
function presentStep(){animPlaying=false;animLast=0;animDirectionSign=1;awaitingInsertion=true;setAnimProgress(0);animUI.state.textContent='Piezas listas · pulsa Siguiente para insertar';updateNextButton()}
function updateNextButton(){
 const b=document.getElementById('next'),prev=document.getElementById('prev');if(!b||!prev)return;
 b.textContent=awaitingInsertion?'▶ Insertar piezas':'Siguiente ❯';b.disabled=!awaitingInsertion&&step===maxStep;
 prev.disabled=step===0&&animProgress<=.001;
 prev.textContent=animPlaying&&animDirectionSign<0?'◀ Retirando…':animProgress>.001?'◀ Retirar piezas':'❮ Paso anterior';
}
function insertStep(){awaitingInsertion=false;animDirectionSign=1;animPlaying=true;animLast=0;setAnimProgress(0);updateNextButton()}
function reverseStep(){
 if(animPlaying&&animDirectionSign<0)return;
 animDirectionSign=-1;animPlaying=true;animLast=0;awaitingInsertion=false;
 // Retirar la pieza desde su posición actual, sin saltar entre pasos.
 updateNextButton();dirty=true;
}
function backStep(){
 if(animPlaying&&animDirectionSign<0)return;
 if(animProgress>.001){reverseStep();return}
 if(step===0)return;
 step--;update(); // Mostrar el paso anterior con sus piezas ya montadas.
 animPlaying=false;animLast=0;awaitingInsertion=false;setAnimProgress(1);updateNextButton();
}
document.getElementById('saveDirections').onclick=()=>{
 const payload={format:'mce-placement-directions',version:1,model:'MakerMachine Two-Wheeled Robot v1.2',directions:stepDirections};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='MakerMachine_v1.2_Direcciones_Animacion.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
};
document.getElementById('loadDirections').onclick=()=>document.getElementById('directionsFile').click();
document.getElementById('directionsFile').onchange=async e=>{
 const f=e.target.files?.[0];if(!f)return;
 try{const data=JSON.parse(await f.text());if(data.format!=='mce-placement-directions'||typeof data.directions!=='object')throw Error('Formato incompatible');
 const allowed=new Set(['auto','up','down','left','right','front','back']);
 stepDirections=Object.fromEntries(Object.entries(data.directions).filter(([k,v])=>/^\d+$/.test(k)&&allowed.has(v)));
 storeDirections();syncStepDirection();dirty=true;alert('Direcciones importadas correctamente')}
 catch(err){alert('No se pudo importar: '+err.message)}e.target.value=''
};

const animDuration=2200;
function easeOutCubic(x){return 1-Math.pow(1-x,3)}
function stepCentroid(n){let sx=0,sy=0,sz=0,c=0;for(const p of parts){if(p.s!==n)continue;const t=p.t;for(let i=0;i<t.length;i+=9){sx+=t[i]+t[i+3]+t[i+6];sy+=t[i+1]+t[i+4]+t[i+7];sz+=t[i+2]+t[i+5]+t[i+8];c+=3}}return c?[sx/c,sy/c,sz/c]:[center[0],center[1],center[2]]}
function animOffset(){if(animProgress>=.99999)return [0,0,0];let dir=animUI.direction.value;
if(dir==='auto'){
 const p=stepCentroid(step),q=stepCentroid(Math.max(0,step-1));
 const delta=[p[0]-q[0],p[1]-q[1],p[2]-q[2]];
 const axis=delta.map(Math.abs).indexOf(Math.max(...delta.map(Math.abs)));
 dir=axis===0?(delta[0]>=0?'right':'left'):axis===1?(delta[1]>=0?'down':'up'):(delta[2]>=0?'front':'back');
}
const dirs={up:[0,-1,0],down:[0,1,0],left:[-1,0,0],right:[1,0,0],front:[0,0,1],back:[0,0,-1]};
const v=dirs[dir]||dirs.up;
const distance=Math.max(18,Math.min(110,size*.28));
const k=(1-easeOutCubic(animProgress))*distance;
// El buffer de superficies tiene Y invertida; el de contornos se invierte en su shader.
return [v[0]*k,v[1]*k,v[2]*k];
}
function setAnimProgress(p){animProgress=Math.max(0,Math.min(1,p));animUI.seek.value=Math.round(animProgress*100);animUI.state.textContent=animProgress>=1?'Pieza colocada':animPlaying?(animDirectionSign<0?'Retirando pieza…':'Colocando pieza…'):'Posición '+Math.round(animProgress*100)+'%';dirty=true}
function beginAnimation(){awaitingInsertion=false;animDirectionSign=1;animPlaying=true;animLast=0;setAnimProgress(0);updateNextButton()}
function stopAnimation(){awaitingInsertion=false;animPlaying=false;animLast=0;setAnimProgress(1);updateNextButton()}
animUI.play.onclick=()=>{if(animProgress>=1)setAnimProgress(0);awaitingInsertion=false;animDirectionSign=1;animPlaying=true;animLast=0;updateNextButton()};
animUI.replay.onclick=beginAnimation;
animUI.stop.onclick=stopAnimation;
animUI.seek.oninput=()=>{animPlaying=false;awaitingInsertion=Number(animUI.seek.value)<100;setAnimProgress(Number(animUI.seek.value)/100);updateNextButton()};
animUI.direction.onchange=()=>{stepDirections[step]=animUI.direction.value;storeDirections();dirty=true};
function animateFrame(t){
 if(!animPlaying)return;
 if(animLast){const advance=Math.min(100,t-animLast)/animDuration*Number(animUI.speed.value)*animDirectionSign;setAnimProgress(animProgress+advance)}
 animLast=t;
 if((animDirectionSign>0&&animProgress>=1)||(animDirectionSign<0&&animProgress<=0)){
  const reversing=animDirectionSign<0;animPlaying=false;animLast=0;awaitingInsertion=reversing;setAnimProgress(reversing?0:1);
  if(reversing)animUI.state.textContent='Piezas retiradas · pulsa Anterior para volver al paso previo';
  updateNextButton();
 }
}
let gpu=[],step=0,az=.72,el=.32,zoom=1,drag=false,px=0,py=0,dirty=true; let panX=0,panY=0,navMode="rotate",dragMode="rotate";
for(let s=0;s<=maxStep;s++)gpu.push(buildBuffers(parts.filter(p=>p.s===s)));
let drawAssemblyOffset=[0,0,0];
function drawBuffer(b,bright,tint,focus=0,transparent=false){
 const count=transparent?b.transparentCount:b.count;if(!count)return;
 gl.bindBuffer(gl.ARRAY_BUFFER,transparent?b.transparentBuffer:b.buffer);
 for(let [name,offset,len] of [['aPosition',0,3],['aNormal',3,3],['aColor',6,3],['aOpacity',9,1]]){
  const id=gl.getAttribLocation(program,name);if(id<0)continue;gl.enableVertexAttribArray(id);gl.vertexAttribPointer(id,len,gl.FLOAT,false,40,offset*4)
 }
 gl.uniform3fv(loc.uAssemblyOffset,drawAssemblyOffset);gl.uniform1f(loc.uBright,bright);gl.uniform1f(loc.uFocus,focus);gl.uniform3fv(loc.uTint,tint);gl.drawArrays(gl.TRIANGLES,0,count);
}

// v1.0.5 — Contornos extraídos exclusivamente de líneas explícitas LDraw tipo 2; no se deducen de los triángulos.
const edgeVS=`#version 300 es
precision highp float;
in vec3 aPosition;
uniform vec3 uCenter; uniform vec2 uPan; uniform float uAz,uEl,uScale,uAspect,uDepth,uMirror; uniform vec3 uAssemblyOffset;
void main(){
 vec3 p=vec3(aPosition.x,-aPosition.y,aPosition.z)+uAssemblyOffset-uCenter;
 float ca=cos(uAz),sa=sin(uAz),ce=cos(uEl),se=sin(uEl);
 float x=(p.x*uMirror)*ca-p.z*sa;
 float z=(p.x*uMirror)*sa+p.z*ca;
 float y=p.y*ce-z*se;
 float d=p.y*se+z*ce;
 gl_Position=vec4(x*uScale/uAspect+uPan.x,y*uScale+uPan.y,-d*uDepth-0.00008,1.0);
}`;
const edgeFS=`#version 300 es
precision highp float;
uniform vec3 uLineColor;
out vec4 fragColor;
void main(){fragColor=vec4(uLineColor,1.0);}`;
function createEdgeProgram(g,depthBias=.00008){
 const prog=g.createProgram();
 function compile(t,source){const sh=g.createShader(t);g.shaderSource(sh,source);g.compileShader(sh);if(!g.getShaderParameter(sh,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(sh));return sh}
 g.attachShader(prog,compile(g.VERTEX_SHADER,edgeVS.replace("-d*uDepth-0.00008", "-d*uDepth-"+Number(depthBias).toFixed(5))));
 g.attachShader(prog,compile(g.FRAGMENT_SHADER,edgeFS));
 g.linkProgram(prog);
 const names=['uCenter','uPan','uAz','uEl','uScale','uAspect','uDepth','uMirror','uLineColor','uAssemblyOffset'];
 const loc={};for(const n of names)loc[n]=g.getUniformLocation(prog,n);
 return {prog,loc,pos:g.getAttribLocation(prog,'aPosition')};
}
const edgeProgram=createEdgeProgram(gl);
const edgeGroups=Array.from({length:maxStep+1},()=>[]);
const rawEdges=window.AVIONETA_EDGES||[];
for(let i=0;i<parts.length;i++)edgeGroups[parts[i].s].push(rawEdges[i]||[]);
const edgeBuffers=edgeGroups.map(group=>{
 const vertices=new Float32Array(group.flat());
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
 return {buffer:b,count:vertices.length/3};
});
function drawEdges(){
 if(!document.getElementById('edges').checked)return;
 gl.useProgram(edgeProgram.prog);
 const e=edgeProgram.loc;
 gl.uniform3fv(e.uCenter,mainFocus);gl.uniform2f(e.uPan,panX,panY);
 gl.uniform1f(e.uAz,az);gl.uniform1f(e.uEl,el);
 gl.uniform1f(e.uMirror,document.getElementById('mirror').checked?-1:1);
 gl.uniform1f(e.uScale,1.62/size*zoom);
 gl.uniform1f(e.uAspect,Math.max(1,canvas.clientWidth)/Math.max(1,canvas.clientHeight));
 gl.uniform1f(e.uDepth,1.7/size);
 gl.depthFunc(gl.LEQUAL);
 for(let i=0;i<=step;i++){
   const b=edgeBuffers[i];if(!b.count)continue;
   const faded=document.getElementById('highlight').checked&&i<step;
   gl.uniform3fv(e.uLineColor,faded?[.43,.47,.51]:[.15,.20,.24]);
   const eo=(i===step?animOffset():[0,0,0]);gl.uniform3fv(e.uAssemblyOffset,eo);
   gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);
   gl.enableVertexAttribArray(edgeProgram.pos);
   gl.vertexAttribPointer(edgeProgram.pos,3,gl.FLOAT,false,12,0);
   gl.drawArrays(gl.LINES,0,b.count);
 }
 gl.useProgram(program);
}
document.getElementById('edges').onchange=()=>{dirty=true;subDirty=true;catalogDirty=true};

function render(t){requestAnimationFrame(render);
animateFrame(t);
if(!dirty&&!animPlaying)return;dirty=false;
let w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),dpr=Math.min(devicePixelRatio||1,2);
if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.960,.971,.982,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
gl.uniform3fv(loc.uCenter,mainFocus);gl.uniform2f(loc.uPan,panX,panY);
gl.uniform1f(loc.uAz,az);gl.uniform1f(loc.uEl,el);gl.uniform1f(loc.uMirror,document.getElementById('mirror').checked?-1:1);
gl.uniform1f(loc.uScale,1.62/size*zoom);gl.uniform1f(loc.uAspect,w/h);gl.uniform1f(loc.uDepth,1.7/size);
let hi=document.getElementById('highlight').checked;
const pulse=0;
for(let i=0;i<=step;i++){
 const focus=!hi?0:(i===step?(document.getElementById('pulse').checked?(.30+.70*pulse):.46):-1);
 drawAssemblyOffset=i===step?animOffset():[0,0,0];
 drawBuffer(gpu[i],0,[.28,.91,.83],focus,false);
}
// Opaque first, then translucent with depth writes disabled.
gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
for(let i=0;i<=step;i++){
 const focus=!hi?0:(i===step?.46:-1);drawAssemblyOffset=i===step?animOffset():[0,0,0];
 drawBuffer(gpu[i],0,[.28,.91,.83],focus,true);
}
gl.depthMask(true);gl.disable(gl.BLEND);
drawEdges();
}
function update(){
document.getElementById('title').textContent=`Paso ${step+1} de ${maxStep+1}`;document.getElementById('stepInstruction').textContent=(window.MCE_STEP_TEXT||{})[step]||'';

document.getElementById('prev').disabled=step===0;document.getElementById('next').disabled=step===maxStep;stepInput.value=step;
let counter={};for(const p of visibleParts.filter(p=>p.s===step&&p.t.length))counter[p.r]=(counter[p.r]||0)+1;
document.getElementById('partlist').innerHTML=Object.entries(counter).map(([k,v])=>`<p>${v} × ${k.replace(/\.dat$/i,'')}</p>`).join('')||'<p>No hay nuevas piezas visibles</p>';
document.getElementById('stat').textContent=`${visibleParts.filter(p=>p.s<=step&&p.t.length).length} referencias acumuladas · ${gpu[step].totalCount/3|0} triángulos en este paso`;
document.getElementById('stepNumber').value=step+1;document.getElementById('diagnostic').textContent="Piezas sin malla: ninguna pieza sin superficie. Dependencias geométricas secundarias no resueltas: ninguna relevante.";
dirty=true;
syncStepDirection();if(animUI.auto.checked)beginAnimation();else presentStep();
}
document.getElementById('prev').onclick=backStep;
document.getElementById('next').onclick=()=>{if(animPlaying&&animDirectionSign<0)return;if(awaitingInsertion){insertStep();return;}if(step<maxStep){step++;update()}};
document.getElementById('all').onclick=()=>{step=maxStep;update()};
document.getElementById('reset').onclick=()=>{az=.72;el=.32;zoom=1;panX=0;panY=0;mainFocus.splice(0,3,...originalMainFocus);dirty=true};
stepInput.oninput=e=>{step=+e.target.value;update()};
function jumpToStep(){const field=document.getElementById('stepNumber');const n=Number(field.value);if(!Number.isFinite(n)){field.value=step+1;return;}step=Math.max(0,Math.min(maxStep,Math.round(n)-1));update();}
document.getElementById('goStep').onclick=jumpToStep;
document.getElementById('stepNumber').addEventListener('keydown',e=>{if(e.key==='Enter')jumpToStep()});

document.getElementById('highlight').onchange=()=>{dirty=true;subDirty=true;refreshFocusMark()};
document.getElementById('pulse').onchange=()=>{dirty=true;subDirty=true;refreshFocusMark()};
document.getElementById('mirror').onchange=()=>dirty=true;

function setNavMode(mode){navMode=mode;for(const [id,value] of [['navRotate','rotate'],['navPan','pan']]){const b=document.getElementById(id);b.classList.toggle('primary',mode===value);b.setAttribute('aria-pressed',String(mode===value));}}
document.getElementById('navRotate').onclick=()=>setNavMode('rotate');
document.getElementById('navPan').onclick=()=>setNavMode('pan');
document.getElementById('navCenter').onclick=()=>{mainFocus.splice(0,3,...originalMainFocus);panX=0;panY=0;dirty=true};
canvas.oncontextmenu=e=>e.preventDefault();
canvas.onpointerdown=e=>{if(e.button!==0&&e.button!==2)return;drag=true;dragMode=(e.button===2||e.shiftKey)?'pan':navMode;px=e.clientX;py=e.clientY;if(dragMode==='rotate'){[panX,panY]=orbitFocus(mainFocus,panX,panY,az,el,1.62/size*zoom,canvas.clientWidth/Math.max(1,canvas.clientHeight),document.getElementById('mirror').checked?-1:1)}canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-px,dy=e.clientY-py;if(dragMode==='pan'){panX+=2*dx/Math.max(1,canvas.clientWidth);panY-=2*dy/Math.max(1,canvas.clientHeight)}else{az-=dx*.008;el=Math.max(-1.5,Math.min(1.5,el+dy*.008))}px=e.clientX;py=e.clientY;dirty=true};
canvas.onpointerup=()=>drag=false;canvas.onpointercancel=()=>drag=false;
canvas.onwheel=e=>{[zoom,panX,panY]=cursorZoom(e,canvas,zoom,.25,8,panX,panY);dirty=true};
canvas.ondblclick=()=>document.getElementById('reset').click();
window.addEventListener('resize',()=>dirty=true);update();render();

// Subensambles: grupos reales presentes en el archivo Studio, con sus componentes individuales.
const subModels=window.SUBASSEMBLIES||{};
for(const [key,data] of Object.entries(subModels)){
 let lastId='',baseColor=null;
 data.steps.forEach((p,i)=>{
  if(!p._overlay){lastId='sub:'+key+':'+i;baseColor=p.c;}
  p.mcePieceId=lastId||('sub:'+key+':'+i);
  p.mceBaseColor=baseColor??p.c;
 });
}
const subIntegrationSteps=window.SUB_INTEGRATION_STEPS||{};
let subOriginalCenter=null;let activeSub=null,subStep=0,subGpu=[],subAz=.72,subEl=.32,subZoom=1,subDrag=false,subPx=0,subPy=0,subDirty=true;let subPanX=0,subPanY=0,subDragMode="rotate";
const subCanvas=document.getElementById('subview'),sg=subCanvas.getContext('webgl2',{antialias:true,alpha:false,depth:true});
let sp=null,sl={},subCenter=[0,0,0],subSize=1;
let subEdgeProgram=null,subEdgeGpu=[];
function compileFor(g,type,source){const sh=g.createShader(type);g.shaderSource(sh,source);g.compileShader(sh);if(!g.getShaderParameter(sh,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(sh));return sh}
if(sg){
sp=sg.createProgram();sg.attachShader(sp,compileFor(sg,sg.VERTEX_SHADER,vs));sg.attachShader(sp,compileFor(sg,sg.FRAGMENT_SHADER,fs));sg.linkProgram(sp);
for(const name of ['uCenter','uPan','uAz','uEl','uScale','uAspect','uDepth','uBright','uMirror','uFocus','uTint'])sl[name]=sg.getUniformLocation(sp,name);
subEdgeProgram=createEdgeProgram(sg,.002);
}
function subBuild(list){
 const opaque=[],transparent=[];
 for(const p of list){const t=p.t,c=mceColorOfPiece(p),alpha=opacityOf(p),data=alpha<.999?transparent:opaque,soft=mceSoftNormals(p);
  for(let i=0;i<t.length;i+=9){
   const a=[t[i],-t[i+1],t[i+2]],b=[t[i+3],-t[i+4],t[i+5]],d=[t[i+6],-t[i+7],t[i+8]];
   const u=b.map((x,j)=>x-a[j]),v=d.map((x,j)=>x-a[j]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   const norm=Math.hypot(...n)||1;n=n.map(x=>x/norm);
   for(const [j,pt] of [a,b,d].entries()){
    const off=i+j*3;data.push(...pt,soft?soft[off]:n[0],soft?soft[off+1]:n[1],soft?soft[off+2]:n[2],...c,alpha);
   }
  }
 }
 return {buffer:makeGpuBuffer(sg,opaque),count:opaque.length/10,transparentBuffer:makeGpuBuffer(sg,transparent),transparentCount:transparent.length/10};
}
function subDraw(buf,highlight,transparent=false){
 const count=transparent?buf.transparentCount:buf.count;if(!count)return;
 sg.bindBuffer(sg.ARRAY_BUFFER,transparent?buf.transparentBuffer:buf.buffer);
 for(const [name,off,len] of [['aPosition',0,3],['aNormal',3,3],['aColor',6,3],['aOpacity',9,1]]){
  const id=sg.getAttribLocation(sp,name);if(id<0)continue;sg.enableVertexAttribArray(id);sg.vertexAttribPointer(id,len,sg.FLOAT,false,40,off*4);
 }
 sg.uniform1f(sl.uBright,0);
 sg.uniform1f(sl.uFocus,!document.getElementById('highlight').checked?0:(highlight?.46:-1));
 sg.uniform3fv(sl.uTint,[.28,.91,.83]);sg.drawArrays(sg.TRIANGLES,0,count)
}
// Los subensambles reutilizan exactamente las líneas LDraw tipo 2 del modelo principal.
// suboutlines.js aplica la transformación rígida de cada pieza a sus coordenadas locales.
function subDrawEdges(){
 if(!subEdgeProgram||!document.getElementById('edges').checked)return;
 const ep=subEdgeProgram,loc=ep.loc;
 sg.useProgram(ep.prog);
 sg.uniform3fv(loc.uCenter,subCenter);sg.uniform2f(loc.uPan,subPanX,subPanY);
 sg.uniform1f(loc.uAz,subAz);sg.uniform1f(loc.uEl,subEl);
 sg.uniform1f(loc.uMirror,document.getElementById('mirror').checked?-1:1);
 sg.uniform1f(loc.uScale,1.62/subSize*subZoom);
 sg.uniform1f(loc.uAspect,Math.max(1,subCanvas.clientWidth)/Math.max(1,subCanvas.clientHeight));
 sg.uniform1f(loc.uDepth,1.7/subSize);
 sg.uniform3fv(loc.uAssemblyOffset,[0,0,0]);
 sg.depthFunc(sg.LEQUAL);
 sg.depthMask(false);
 for(let i=0;i<=subStep;i++){
  const b=subEdgeGpu[i];if(!b||!b.count)continue;
  const faded=document.getElementById('highlight').checked&&i<subStep;
  sg.uniform3fv(loc.uLineColor,faded?[.43,.47,.51]:[.15,.20,.24]);
  sg.bindBuffer(sg.ARRAY_BUFFER,b.buffer);
  sg.enableVertexAttribArray(ep.pos);
  sg.vertexAttribPointer(ep.pos,3,sg.FLOAT,false,12,0);
  sg.drawArrays(sg.LINES,0,b.count);
 }
 sg.depthMask(true);
 sg.useProgram(sp);
}
function subRender(){
requestAnimationFrame(subRender);
if(!sg||!activeSub||document.getElementById('submodal').hidden)return;
const animate=document.getElementById('highlight').checked&&document.getElementById('pulse').checked;
if(!subDirty&&!animate)return;
subDirty=false;
const w=Math.max(1,subCanvas.clientWidth),h=Math.max(1,subCanvas.clientHeight),dpr=Math.min(devicePixelRatio||1,2);
subCanvas.width=Math.round(w*dpr);subCanvas.height=Math.round(h*dpr);
sg.viewport(0,0,subCanvas.width,subCanvas.height);sg.clearColor(.960,.971,.982,1);sg.clear(sg.COLOR_BUFFER_BIT|sg.DEPTH_BUFFER_BIT);
sg.enable(sg.DEPTH_TEST);sg.depthFunc(sg.LEQUAL);sg.disable(sg.CULL_FACE);sg.disable(sg.BLEND);sg.useProgram(sp);
sg.uniform3fv(sl.uCenter,subCenter);sg.uniform2f(sl.uPan,subPanX,subPanY);sg.uniform1f(sl.uAz,subAz);sg.uniform1f(sl.uEl,subEl);
sg.uniform1f(sl.uScale,1.62/subSize*subZoom);sg.uniform1f(sl.uAspect,w/h);sg.uniform1f(sl.uDepth,1.7/subSize);
sg.uniform1f(sl.uMirror,document.getElementById('mirror').checked?-1:1);
// Desplazar levemente la profundidad de las superficies, no la de las líneas:
 // evita que los contornos LDraw del subensamble queden ocultos por z-fighting.
 sg.enable(sg.POLYGON_OFFSET_FILL);
 sg.polygonOffset(1.5,2.5);
 for(let i=0;i<=subStep;i++)subDraw(subGpu[i],i===subStep&&document.getElementById('highlight').checked,false);
 sg.enable(sg.BLEND);sg.blendFunc(sg.SRC_ALPHA,sg.ONE_MINUS_SRC_ALPHA);sg.depthMask(false);
 for(let i=0;i<=subStep;i++)subDraw(subGpu[i],i===subStep&&document.getElementById('highlight').checked,true);
 sg.depthMask(true);sg.disable(sg.BLEND);sg.disable(sg.POLYGON_OFFSET_FILL);
 subDrawEdges();
}
function updateSub(){
const data=subModels[activeSub];if(!data)return;
document.getElementById('subTitle').textContent=data.title;
document.getElementById('subCounter').textContent=`Pieza ${subStep+1} de ${data.steps.length}`;
const p=data.steps[subStep];
document.getElementById('subPart').textContent=`Agregar: ${p.r} · Color LDraw ${p.c}`;
document.getElementById('subPrev').disabled=subStep===0;document.getElementById('subNext').disabled=subStep===data.steps.length-1;
subDirty=true;
}
function openSub(key){
if(!sg){alert('El navegador no permite un segundo contexto WebGL2.');return}
activeSub=key;subStep=0;subAz=.72;subEl=.32;subZoom=1;subPanX=0;subPanY=0;
for(const b of subGpu)releaseGpuPair(sg,b);
for(const b of subEdgeGpu)sg.deleteBuffer(b.buffer);
const data=subModels[key];subGpu=data.steps.map(p=>subBuild([p]));
const outlines=(window.SUBASSEMBLY_EDGES||{})[key]||[];
subEdgeGpu=data.steps.map((p,i)=>{
 const vertices=new Float32Array(outlines[i]||[]);
 const buffer=sg.createBuffer();sg.bindBuffer(sg.ARRAY_BUFFER,buffer);
 sg.bufferData(sg.ARRAY_BUFFER,vertices,sg.STATIC_DRAW);
 return {buffer,count:vertices.length/3};
});
const xyz=data.steps.flatMap(p=>p.t),bb=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
for(let i=0;i<xyz.length;i+=3){for(let k=0;k<3;k++){bb[k]=Math.min(bb[k],xyz[i+k]);bb[k+3]=Math.max(bb[k+3],xyz[i+k])}}
subCenter=[(bb[0]+bb[3])/2,-(bb[1]+bb[4])/2,(bb[2]+bb[5])/2];
subSize=Math.max(1,bb[3]-bb[0],bb[4]-bb[1],bb[5]-bb[2]);subOriginalCenter=[...subCenter];
document.getElementById('submodal').hidden=false;updateSub();
}
function closeSub(){document.getElementById('submodal').hidden=true;activeSub=null;dirty=true}
// An instructor can override any step with an explicit subassembly list.
const subStepOverrides=window.MCE_SUB_STEP_OVERRIDES||{};
function autoSubKeys(n){
 const first=parts.filter(p=>p.s===n&&subModels[String(p.r).toLowerCase()]).map(p=>String(p.r).toLowerCase());
 const indirect=Object.keys(subModels).filter(key=>(subIntegrationSteps[key]||[]).includes(n));
 return [...new Set([...first,...indirect])];
}
function subKeysAt(n){
 const entry=subStepOverrides[n];
 if(entry&&entry.mode==='none')return [];
 if(entry&&entry.mode==='manual')return (entry.keys||[]).filter(k=>!!subModels[k]);
 return autoSubKeys(n);
}
function refreshSubFlag(){
 const keys=subKeysAt(step),flag=document.getElementById('subflag');flag.hidden=!keys.length;
 const hint=document.getElementById('subhint');const buttons=document.getElementById('mceSubButtons');
 if(!keys.length){hint.textContent='';buttons.replaceChildren();return}
 hint.textContent=keys.map(k=>`${subModels[k].title} · ${new Set(subModels[k].steps.map(p=>p.s)).size} pasos internos`).join(' | ');
 buttons.replaceChildren();for(const key of keys){const b=document.createElement('button');b.type='button';b.className='primary';b.textContent='Abrir '+subModels[key].title+' ↗';b.onclick=()=>openSub(key);buttons.append(b)}
}
window.MCE_SUB_BRIDGE={keys:()=>Object.keys(subModels).map(k=>({key:k,title:subModels[k].title})),
 snapshot:()=>JSON.parse(JSON.stringify(subStepOverrides)),
 at:()=>subKeysAt(step),
 apply:values=>{for(const k of Object.keys(subStepOverrides))delete subStepOverrides[k];
  if(values&&typeof values==='object')for(const [key,v] of Object.entries(values))if(/^\d+$/.test(key)&&+key<=maxStep&&v&&['auto','none','manual'].includes(v.mode))subStepOverrides[key]={mode:v.mode,keys:(v.keys||[]).filter(s=>subModels[s])};
  refreshSubFlag();},refresh:refreshSubFlag};
document.getElementById('closeSub').onclick=closeSub;
document.getElementById('subDone').onclick=closeSub;
document.getElementById('subPrev').onclick=()=>{subStep=Math.max(0,subStep-1);updateSub()};
document.getElementById('subNext').onclick=()=>{subStep=Math.min(subGpu.length-1,subStep+1);updateSub()};
document.getElementById('subReset').onclick=()=>{subAz=.72;subEl=.32;subZoom=1;subPanX=0;subPanY=0;if(subOriginalCenter)subCenter=[...subOriginalCenter];subDirty=true};
subCanvas.oncontextmenu=e=>e.preventDefault();
subCanvas.onpointerdown=e=>{if(e.button!==0&&e.button!==2)return;subDrag=true;subDragMode=(e.button===2||e.shiftKey)?'pan':'rotate';subPx=e.clientX;subPy=e.clientY;if(subDragMode==='rotate'){[subPanX,subPanY]=orbitFocus(subCenter,subPanX,subPanY,subAz,subEl,1.62/subSize*subZoom,subCanvas.clientWidth/Math.max(1,subCanvas.clientHeight),document.getElementById('mirror').checked?-1:1)}subCanvas.setPointerCapture(e.pointerId)};
subCanvas.onpointermove=e=>{if(!subDrag)return;const dx=e.clientX-subPx,dy=e.clientY-subPy;if(subDragMode==='pan'){subPanX+=2*dx/Math.max(1,subCanvas.clientWidth);subPanY-=2*dy/Math.max(1,subCanvas.clientHeight)}else{subAz-=dx*.008;subEl=Math.max(-1.5,Math.min(1.5,subEl+dy*.008))}subPx=e.clientX;subPy=e.clientY;subDirty=true};
subCanvas.onpointerup=()=>subDrag=false;subCanvas.onpointercancel=()=>subDrag=false;
subCanvas.onwheel=e=>{[subZoom,subPanX,subPanY]=cursorZoom(e,subCanvas,subZoom,.25,8,subPanX,subPanY);subDirty=true};
subCanvas.ondblclick=()=>document.getElementById('subReset').click();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeSub)closeSub()});
const oldUpdate=update;
update=function(){oldUpdate();refreshSubFlag()};
// Initialize subassembly warning after subassembly metadata is loaded.
update();
// La misma paleta de códigos LDraw se aplica a ensamble, catálogo y subensambles.
function rebuildColors(){
for(const b of gpu)releaseGpuPair(gl,b);
gpu=[];for(let s=0;s<=maxStep;s++)gpu.push(buildBuffers(parts.filter(p=>p.s===s)));
if(activeSub){for(const b of subGpu)releaseGpuPair(sg,b);subGpu=subModels[activeSub].steps.map(p=>subBuild([p]));subDirty=true}
dirty=true;
if(typeof catalogDirty!=='undefined'){catalogDirty=true;if(typeof catalogGroups!=='undefined'&&catalogGroups.length)catalogPreview(catalogIndex)}
}
const codes=[...new Set(parts.map(p=>p.c).concat(...Object.values(subModels).flatMap(x=>x.steps.map(p=>p.c))))].sort((a,b)=>a-b);
function showPalette(){
document.getElementById('palette').innerHTML='';
for(const code of codes){const row=document.createElement('label');row.className='colorrow';
const name=document.createElement('span');name.textContent=`Color ${code}`;const picker=document.createElement('input');picker.type='color';picker.value=colors[code]||'#a6aeba';
picker.oninput=()=>{colors[code]=picker.value;rebuildColors();window.dispatchEvent(new Event('mce-palette-changed'))};
row.append(name,picker);document.getElementById('palette').append(row)}
}
const originalColors={...colors};
document.getElementById('restoreColors').onclick=()=>{Object.assign(colors,originalColors);showPalette();rebuildColors();window.dispatchEvent(new Event('mce-palette-changed'))};
window.MCE_COLOR_BRIDGE={snapshot:()=>({...colors}),apply:values=>{if(values&&typeof values==='object'){for(const [k,v] of Object.entries(values))if(/^#[0-9a-f]{6}$/i.test(v))colors[k]=v;showPalette();rebuildColors();}},reset:()=>{Object.assign(colors,originalColors);showPalette();rebuildColors();}};
window.MCE_PIECE_COLOR_BRIDGE={
 snapshot:()=>({...mcePieceColors}),
 apply:obj=>{
  for(const key of Object.keys(mcePieceColors))delete mcePieceColors[key];
  if(obj&&typeof obj==='object')for(const [key,v] of Object.entries(obj)){
   if(/^(main:\d+|sub:.+:\d+)$/.test(key)&&/^#[0-9a-f]{6}$/i.test(v))mcePieceColors[key]=v;
  }
  rebuildColors();
 },
 setPiece:(id,v)=>{
  if(!id)return;
  if(!v)delete mcePieceColors[id];else if(/^#[0-9a-f]{6}$/i.test(v))mcePieceColors[id]=v;
  rebuildColors();
 },
 getPiece:id=>mcePieceColors[id]||null,
 base:p=>mceHexOfPiece(p)
};
window.MCE_ALPHA_BRIDGE={
 snapshot:()=>({palette:{...alphas},pieces:{...pieceAlphas}}),
 apply:data=>{if(!data||typeof data!=='object')return;
   for(const k of Object.keys(alphas))delete alphas[k];for(const k of Object.keys(pieceAlphas))delete pieceAlphas[k];
   for(const [k,v] of Object.entries(data.palette||{}))if(Number.isFinite(+v))alphas[k]=clampAlpha(v);
   for(const [k,v] of Object.entries(data.pieces||{}))if(Number.isFinite(+v)&&Number.isInteger(+k)&&parts[+k])pieceAlphas[k]=clampAlpha(v);
   rebuildColors();},
 setPalette:(code,v)=>{alphas[code]=clampAlpha(v);rebuildColors()},
 setPiece:(idx,v)=>{if(v==null||v===''){delete pieceAlphas[idx]}else pieceAlphas[idx]=clampAlpha(v);rebuildColors()},
 getPalette:code=>alphas[code]!=null?alphas[code]:1,
 getPiece:idx=>pieceAlphas[idx]!=null?pieceAlphas[idx]:null,
 indicesAt:s=>parts.map((p,i)=>({p,i})).filter(x=>x.p.s===s&&x.p.t.length).map(x=>({index:x.i,ref:x.p.r,color:x.p.c,alpha:opacityOf(x.p)})),
 reset:()=>{for(const k of Object.keys(alphas))delete alphas[k];for(const k of Object.keys(pieceAlphas))delete pieceAlphas[k];rebuildColors()}
};

showPalette();update();subRender();

// v1.0.5 — Catálogo interactivo con previsualización WebGL independiente.
let catalogPanX=0,catalogPanY=0,catalogDragMode="rotate",catalogOriginalCenter=null;
const catalogModal=document.getElementById('catalogModal'),catalogCanvas=document.getElementById('catalogView');
const cg=catalogCanvas.getContext('webgl2',{antialias:true,alpha:false,depth:true});
let cp=null,cl={},catalogEdgeProgram=null,catalogEdgeBuffer=null,catalogEdgeCount=0,catalogBuffer=null,catalogCount=0,catalogTransBuffer=null,catalogTransCount=0,catalogGroups=[],catalogIndex=0,catalogAz=.72,catalogEl=.32,catalogZoom=1,catalogCenter=[0,0,0],catalogSize=1,catalogDirty=true,catalogDrag=false,catalogPX=0,catalogPY=0;
const collectedByStep=new Map();
if(cg){cp=cg.createProgram();cg.attachShader(cp,compileFor(cg,cg.VERTEX_SHADER,vs));cg.attachShader(cp,compileFor(cg,cg.FRAGMENT_SHADER,fs));cg.linkProgram(cp);
for(const name of ['uCenter','uPan','uAz','uEl','uScale','uAspect','uDepth','uBright','uMirror','uFocus','uTint'])cl[name]=cg.getUniformLocation(cp,name);catalogEdgeProgram=createEdgeProgram(cg,.002)}
const catalogEdgeLookup=new WeakMap(parts.map((p,i)=>[p,(window.AVIONETA_EDGES||[])[i]||[]]));
let catalogScope={mode:'step',key:null};
function mceCatalogLogicalSteps(sequence,scope){
 const result=[],seen=new Set();let last=null;
 for(let i=0;i<sequence.length;i++){
  const p=sequence[i];if(!p.t?.length)continue;
  if(!p._overlay){
   last={p,parts:[p],index:i};result.push(last);
  }else if(last&&last.p.r===p.r){last.parts.push(p)}
 }
 return result;
}
function mceCatalogGroupRows(logicals,prefix,label){
 const rows=new Map();
 for(const item of logicals){const p=item.p;
  const key=prefix+'|'+p.r+'|'+p.c;
  let g=rows.get(key);
  if(!g){g={key,r:p.r,c:p.c,label,decorated:true,pieces:[],count:0};rows.set(key,g)}
  g.count++;
  if(g.pieces.length===0)g.pieces.push(...item.parts);
 }
 return [...rows.values()];
}
function catalogStepGroups(){
 if(catalogScope.mode==='sub'&&subModels[catalogScope.key]){
  const data=subModels[catalogScope.key];return mceCatalogGroupRows(mceCatalogLogicalSteps(data.steps),
      'sub|'+catalogScope.key,data.title+' · Piezas del subensamble');
 }
 const main=mceCatalogGroupRows(mceCatalogLogicalSteps(parts.filter(p=>p.s===step)),
      'main|'+step,'Paso principal');
 // Cada subensamble se despliega en sus piezas originales, no solo en su
 // referencia de inserción en el ensamble principal.
 for(const key of subKeysAt(step)){
  const data=subModels[key];if(!data)continue;
  main.push(...mceCatalogGroupRows(mceCatalogLogicalSteps(data.steps),
       'step|'+step+'|sub|'+key, data.title+' · Piezas internas'));
 }
 return main;
}
function catalogPreview(index){
 if(!cg)return;catalogIndex=index;const g=catalogGroups[index];if(!g)return;
 if(catalogBuffer)cg.deleteBuffer(catalogBuffer);
 if(catalogTransBuffer)cg.deleteBuffer(catalogTransBuffer);
 if(catalogEdgeBuffer)cg.deleteBuffer(catalogEdgeBuffer);
 const previewParts=g.pieces;
 const vertices=[],transVertices=[],bb=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
 for(const p of previewParts){const t=p.t,c=mceColorOfPiece(p),alpha=opacityOf(p),data=alpha<.999?transVertices:vertices;
  for(let i=0;i<t.length;i+=9){
   const a=[t[i],-t[i+1],t[i+2]],b=[t[i+3],-t[i+4],t[i+5]],d=[t[i+6],-t[i+7],t[i+8]];
   const u=b.map((x,j)=>x-a[j]),v=d.map((x,j)=>x-a[j]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   const len=Math.hypot(...n)||1;n=n.map(x=>x/len);
   for(const pt of [a,b,d]){data.push(...pt,...n,...c,alpha);for(let k=0;k<3;k++){bb[k]=Math.min(bb[k],pt[k]);bb[k+3]=Math.max(bb[k+3],pt[k])}}
  }
 }
 catalogCenter=[0,1,2].map(k=>(bb[k]+bb[k+3])/2);catalogSize=Math.max(1,...[0,1,2].map(k=>bb[k+3]-bb[k]));
 catalogBuffer=makeGpuBuffer(cg,vertices);catalogCount=vertices.length/10;
 catalogTransBuffer=makeGpuBuffer(cg,transVertices);catalogTransCount=transVertices.length/10;
 const edgeData=new Float32Array(previewParts.flatMap(p=>catalogEdgeLookup.get(p)||[]));
 catalogEdgeBuffer=cg.createBuffer();cg.bindBuffer(cg.ARRAY_BUFFER,catalogEdgeBuffer);cg.bufferData(cg.ARRAY_BUFFER,edgeData,cg.STATIC_DRAW);catalogEdgeCount=edgeData.length/3;
 document.getElementById('catalogSelected').textContent=`${window.MCE_PIECE_NAMES?.[g.r]||g.r} · ${g.count} unidad(es)`;
 for(const [i,el] of [...document.getElementById('catalogItems').children].entries())el.classList.toggle('selected',i===index);
 catalogAz=.72;catalogEl=.32;catalogZoom=1;catalogPanX=0;catalogPanY=0;catalogOriginalCenter=[...catalogCenter];catalogDirty=true;
}
function mceCatalogProgressKey(){return catalogScope.mode==='sub'?('sub:'+catalogScope.key):('step:'+step)}
function catalogCollection(){const k=mceCatalogProgressKey();if(!collectedByStep.has(k))collectedByStep.set(k,new Set());return collectedByStep.get(k)}
function catalogProgress(){const done=catalogCollection(),total=catalogGroups.reduce((n,g)=>n+g.count,0);
document.getElementById('catalogProgress').textContent=`${done.size} de ${total} piezas preparadas`}
function catalogPopulate(){catalogGroups=catalogStepGroups();document.getElementById('catalogTitle').textContent=catalogScope.mode==='sub'?`Catálogo · ${subModels[catalogScope.key]?.title||'Subensamble'}`:`Catálogo · Paso ${step+1}`;
const root=document.getElementById('catalogItems');root.replaceChildren();const done=catalogCollection();
for(const [i,g] of catalogGroups.entries()){const item=document.createElement('div');item.className='catalogItem';const check=document.createElement('input');check.type='checkbox';check.checked=Array.from({length:g.count},(_,j)=>done.has(g.key+':'+j)).every(Boolean);
check.onclick=e=>{e.stopPropagation();for(let j=0;j<g.count;j++){const id=g.key+':'+j;if(check.checked)done.add(id);else done.delete(id)}item.classList.toggle('done',check.checked);catalogProgress()};
const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=mceHexOfPiece(g.pieces[0]);
const info=document.createElement('div');info.className='info';const title=document.createElement('strong');title.textContent=window.MCE_PIECE_NAMES?.[g.r]||g.r;const desc=document.createElement('small');desc.textContent=`${g.count} × · ${g.label} · Color LDraw ${g.c}`;info.append(title,desc);item.append(check,swatch,info);
item.onclick=()=>catalogPreview(i);item.classList.toggle('done',check.checked);root.append(item)}
catalogProgress();if(catalogGroups.length)catalogPreview(0)}
function openCatalog(scope){catalogScope=(scope&&scope.mode==='sub'&&subModels[scope.key])?scope:{mode:'step',key:null};if(!cg){alert('No se pudo iniciar el visor 3D del catálogo.');return}catalogModal.hidden=false;catalogPopulate();catalogDirty=true}
function closeCatalog(){catalogModal.hidden=true;dirty=true}
document.getElementById('openCatalog').onclick=()=>openCatalog();
document.getElementById('subOpenCatalog').onclick=()=>{if(activeSub)openCatalog({mode:'sub',key:activeSub})};
document.getElementById('catalogClose').onclick=closeCatalog;
document.getElementById('catalogDone').onclick=closeCatalog;
document.getElementById('catalogClear').onclick=()=>{collectedByStep.set(mceCatalogProgressKey(),new Set());catalogPopulate()};
document.getElementById('catalogReset').onclick=()=>{catalogAz=.72;catalogEl=.32;catalogZoom=1;catalogPanX=0;catalogPanY=0;if(catalogOriginalCenter)catalogCenter=[...catalogOriginalCenter];catalogDirty=true};
catalogCanvas.oncontextmenu=e=>e.preventDefault();
catalogCanvas.onpointerdown=e=>{if(e.button!==0&&e.button!==2)return;catalogDrag=true;catalogDragMode=(e.button===2||e.shiftKey)?'pan':'rotate';catalogPX=e.clientX;catalogPY=e.clientY;if(catalogDragMode==='rotate'){[catalogPanX,catalogPanY]=orbitFocus(catalogCenter,catalogPanX,catalogPanY,catalogAz,catalogEl,1.62/catalogSize*catalogZoom,catalogCanvas.clientWidth/Math.max(1,catalogCanvas.clientHeight),document.getElementById('mirror').checked?-1:1)}catalogCanvas.setPointerCapture(e.pointerId)};
catalogCanvas.onpointermove=e=>{if(!catalogDrag)return;const dx=e.clientX-catalogPX,dy=e.clientY-catalogPY;if(catalogDragMode==='pan'){catalogPanX+=2*dx/Math.max(1,catalogCanvas.clientWidth);catalogPanY-=2*dy/Math.max(1,catalogCanvas.clientHeight)}else{catalogAz-=dx*.008;catalogEl=Math.max(-1.5,Math.min(1.5,catalogEl+dy*.008))}catalogPX=e.clientX;catalogPY=e.clientY;catalogDirty=true};
catalogCanvas.onpointerup=()=>catalogDrag=false;catalogCanvas.onpointercancel=()=>catalogDrag=false;
catalogCanvas.onwheel=e=>{[catalogZoom,catalogPanX,catalogPanY]=cursorZoom(e,catalogCanvas,catalogZoom,.25,8,catalogPanX,catalogPanY);catalogDirty=true};
catalogCanvas.ondblclick=()=>document.getElementById('catalogReset').click();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!catalogModal.hidden)closeCatalog()});
function catalogRender(){requestAnimationFrame(catalogRender);if(!cg||catalogModal.hidden||!catalogDirty)return;catalogDirty=false;
const w=Math.max(1,catalogCanvas.clientWidth),h=Math.max(1,catalogCanvas.clientHeight),dpr=Math.min(devicePixelRatio||1,2);
if(catalogCanvas.width!==Math.round(w*dpr)||catalogCanvas.height!==Math.round(h*dpr)){catalogCanvas.width=Math.round(w*dpr);catalogCanvas.height=Math.round(h*dpr)}
cg.viewport(0,0,catalogCanvas.width,catalogCanvas.height);cg.clearColor(.960,.971,.982,1);cg.clear(cg.COLOR_BUFFER_BIT|cg.DEPTH_BUFFER_BIT);cg.enable(cg.DEPTH_TEST);cg.depthFunc(cg.LEQUAL);cg.disable(cg.CULL_FACE);cg.disable(cg.BLEND);cg.useProgram(cp);
cg.uniform3fv(cl.uCenter,catalogCenter);cg.uniform2f(cl.uPan,catalogPanX,catalogPanY);cg.uniform1f(cl.uAz,catalogAz);cg.uniform1f(cl.uEl,catalogEl);cg.uniform1f(cl.uMirror,document.getElementById('mirror').checked?-1:1);
cg.uniform1f(cl.uScale,1.62/catalogSize*catalogZoom);cg.uniform1f(cl.uAspect,w/h);cg.uniform1f(cl.uDepth,1.7/catalogSize);cg.uniform1f(cl.uFocus,0);cg.uniform1f(cl.uBright,0);cg.uniform3fv(cl.uTint,[0,0,0]);
if((catalogBuffer&&catalogCount)||(catalogTransBuffer&&catalogTransCount)){
 cg.enable(cg.POLYGON_OFFSET_FILL);cg.polygonOffset(1.5,2.5);
 const drawCatalog=(buffer,count)=>{if(!count)return;
  cg.bindBuffer(cg.ARRAY_BUFFER,buffer);
  for(const [name,offset,len] of [['aPosition',0,3],['aNormal',3,3],['aColor',6,3],['aOpacity',9,1]]){
   const id=cg.getAttribLocation(cp,name);if(id<0)continue;cg.enableVertexAttribArray(id);cg.vertexAttribPointer(id,len,cg.FLOAT,false,40,offset*4);
  }cg.drawArrays(cg.TRIANGLES,0,count);
 };
 drawCatalog(catalogBuffer,catalogCount);
 cg.enable(cg.BLEND);cg.blendFunc(cg.SRC_ALPHA,cg.ONE_MINUS_SRC_ALPHA);cg.depthMask(false);
 drawCatalog(catalogTransBuffer,catalogTransCount);
 cg.depthMask(true);cg.disable(cg.BLEND);cg.disable(cg.POLYGON_OFFSET_FILL);
 }
 if(catalogEdgeProgram&&catalogEdgeBuffer&&catalogEdgeCount&&document.getElementById('edges').checked){
 const e=catalogEdgeProgram.loc;
 cg.useProgram(catalogEdgeProgram.prog);cg.depthMask(false);
 cg.uniform3fv(e.uCenter,catalogCenter);cg.uniform2f(e.uPan,catalogPanX,catalogPanY);
 cg.uniform1f(e.uAz,catalogAz);cg.uniform1f(e.uEl,catalogEl);
 cg.uniform1f(e.uMirror,document.getElementById('mirror').checked?-1:1);
 cg.uniform1f(e.uScale,1.62/catalogSize*catalogZoom);cg.uniform1f(e.uAspect,w/h);
 cg.uniform1f(e.uDepth,1.7/catalogSize);cg.uniform3fv(e.uAssemblyOffset,[0,0,0]);
 cg.uniform3fv(e.uLineColor,[.12,.17,.20]);
 cg.bindBuffer(cg.ARRAY_BUFFER,catalogEdgeBuffer);cg.enableVertexAttribArray(catalogEdgeProgram.pos);
 cg.vertexAttribPointer(catalogEdgeProgram.pos,3,cg.FLOAT,false,12,0);
 cg.drawArrays(cg.LINES,0,catalogEdgeCount);cg.depthMask(true);cg.useProgram(cp);
 }
}
catalogRender();
