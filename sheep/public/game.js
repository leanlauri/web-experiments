import * as THREE from './vendor/three.module.js';
const canvas=document.querySelector('#world');
let renderer;
try { renderer=new THREE.WebGLRenderer({canvas,antialias:true}); } catch(e){document.querySelector('#error').hidden=false;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0xc9e4de);renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xc9e4de,48,110);
const camera=new THREE.PerspectiveCamera(43,1,.1,180);
scene.add(new THREE.HemisphereLight(0xfff9e9,0x748c68,2.7));
const sun=new THREE.DirectionalLight(0xffedc9,3);sun.position.set(-18,30,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36});sun.shadow.bias=-.0005;scene.add(sun);
const mat=c=>new THREE.MeshToonMaterial({color:c});
const grass=mat(0x91b76c), wool=mat(0xfff6df), dark=mat(0x514f43), wood=mat(0x9b7450), leaves=mat(0x699654), trunk=mat(0x876649);
function mesh(geo,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function ball(p,m,x,y,z,sx,sy=sx,sz=sx){const b=mesh(new THREE.IcosahedronGeometry(1,1),m,p,x,y,z);b.scale.set(sx,sy,sz);return b;}
function box(p,m,x,y,z,w,h,d){return mesh(new THREE.BoxGeometry(w,h,d),m,p,x,y,z);}
mesh(new THREE.PlaneGeometry(250,250),grass,scene).rotation.x=-Math.PI/2;
// Rolling silhouettes surround a flat, playable meadow.
for(let i=0;i<18;i++){const a=i/18*Math.PI*2;ball(scene,mat(i%2?0x8eb17c:0x9fbe88),Math.cos(a)*65,-2,Math.sin(a)*65,20,9+i%5,18);}
let seed=324;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<25;i++){const a=i*2.399,r=25+rand()*18,x=Math.cos(a)*r,z=Math.sin(a)*r;const tree=new THREE.Group();tree.position.set(x,0,z);scene.add(tree);mesh(new THREE.CylinderGeometry(.22,.38,3,7),trunk,tree,0,1.5,0);ball(tree,leaves,0,3.8,0,2,2.3,1.8);ball(tree,mat(0x83aa60),.8,4.5,.2,1.4);}
// Fence, with an open entrance and low logs to hop over.
for(let i=-6;i<=6;i++){for(const z of [-24,24]){box(scene,wood,i*4,.7,z,.17,1.4,.17);if(i<6){box(scene,wood,i*4+2,.55,z,4,.12,.12);box(scene,wood,i*4+2,1.05,z,4,.12,.12);}}}
const obstacles=[{x:2,z:1,r:1.65,h:.55},{x:-7,z:-4,r:1.5,h:.5},{x:9,z:-10,r:1.8,h:.6}];
for(const o of obstacles){const log=mesh(new THREE.CylinderGeometry(o.h/2,o.h/2,o.r*2,9),wood,scene,o.x,o.h/2,o.z);log.rotation.z=Math.PI/2;for(const dx of [-1,1]){const end=mesh(new THREE.CircleGeometry(o.h*.39,9),mat(0xc9a67b),scene,o.x+dx*(o.r+.01),o.h/2,o.z);end.rotation.y=dx*Math.PI/2;}}
for(let i=0;i<500;i++){const x=(rand()-.5)*49,z=(rand()-.5)*44;if(rand()<.3){const c=rand()>.5?0xffefb0:0xf8f5e4;ball(scene,mat(c),x,.12,z,.07,.10,.07);}else{const g=mesh(new THREE.ConeGeometry(.08,.28,3),mat(0x739a56),scene,x,.14,z);g.rotation.z=.2;}}
// Little red barn on the far side.
const barn=new THREE.Group();barn.position.set(-16,0,-18);scene.add(barn);box(barn,mat(0xbb7461),0,1.6,0,5,3.2,4);for(const side of [-1,1]){const roof=box(barn,mat(0x626d60),side*1.3,3.65,0,3.2,.18,4.7);roof.rotation.z=-side*.55;}box(barn,mat(0xeee2c8),0,1,2.02,1.7,2,.08);box(barn,wood,0,1,2.08,1.4,1.8,.08);
function sheepModel(){const g=new THREE.Group();ball(g,wool,0,.82,0,.53,.5,.73);for(let i=0;i<7;i++){const a=i*2.4;ball(g,wool,Math.cos(a)*.35,.92+(i%2)*.19,Math.sin(a)*.44,.28);}ball(g,dark,0,.94,.66,.27,.3,.3);for(const s of [-1,1]){ball(g,dark,s*.32,1.01,.63,.19,.08,.12);ball(g,mat(0xffffff),s*.15,1.02,.91,.06);ball(g,mat(0x292c28),s*.15,1.02,.96,.026);}const legs=[];for(const x of [-.28,.28])for(const z of [-.4,.4])legs.push(box(g,dark,x,.27,z,.12,.5,.13));ball(g,wool,0,.91,-.7,.16);return {g,legs};}
const flock=[];for(let i=0;i<12;i++){const model=sheepModel();scene.add(model.g);const a=i*2.4,r=4+Math.sqrt(i)*2.4;model.g.position.set(Math.cos(a)*r,0,Math.sin(a)*r-3);flock.push({...model,v:new THREE.Vector3(),vy:0,following:false,phase:rand()*6.28});}
const player=new THREE.Group();scene.add(player);const coat=mat(0x477a87),skin=mat(0xf0be92),boots=mat(0x534b3e),hat=mat(0xd6b875);
box(player,coat,0,1.03,0,.58,.75,.35);ball(player,skin,0,1.64,0,.25,.28,.24);mesh(new THREE.CylinderGeometry(.42,.42,.08,12),hat,player,0,1.87,0);mesh(new THREE.CylinderGeometry(.25,.3,.25,10),hat,player,0,1.99,0);const arms=[];for(const s of [-1,1]){arms.push(box(player,coat,s*.37,1.01,0,.17,.63,.2));ball(player,skin,s*.37,.66,0,.10);}const legs=[box(player,boots,-.17,.35,0,.2,.65,.24),box(player,boots,.17,.35,0,.2,.65,.24)];mesh(new THREE.CylinderGeometry(.035,.035,1.8,6),wood,player,.57,.93,.12);player.position.set(0,0,8);
const keys=new Set();let jumpQueued=false,vy=0,time=0;const forward=new THREE.Vector3(-.6,0,-.8),right=new THREE.Vector3(.8,0,-.6);
const stick=document.querySelector('#thumbstick'),knob=document.querySelector('#stick-knob');
const analog={x:0,y:0};let stickPointer=null;
function releaseStick(){stickPointer=null;analog.x=analog.y=0;knob.style.transform='translate(0px,0px)';stick.classList.remove('active');}
function steerStick(e){const rect=stick.getBoundingClientRect(),radius=(rect.width-knob.offsetWidth)/2;let x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2;const distance=Math.hypot(x,y);if(distance>radius){x*=radius/distance;y*=radius/distance;}knob.style.transform=`translate(${x}px,${y}px)`;const magnitude=Math.min(distance/radius,1),power=Math.max(0,(magnitude-.12)/.88);analog.x=distance?x/Math.hypot(x,y)*power:0;analog.y=distance?y/Math.hypot(x,y)*power:0;}
stick.addEventListener('pointerdown',e=>{if(stickPointer!==null)return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('active');steerStick(e);});
stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)steerStick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===stickPointer)releaseStick();});
addEventListener('blur',releaseStick);document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseStick();keys.clear();jumpQueued=false;}});
addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Space'&&!e.repeat)jumpQueued=true;keys.add(e.code);});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();jumpQueued=false;});
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);if(b.dataset.key==='Space')jumpQueued=true;});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));}
const count=document.querySelector('#count'),message=document.querySelector('#message');
function reset(){releaseStick();keys.clear();jumpQueued=false;vy=0;player.position.set(0,0,8);flock.forEach((s,i)=>{const a=i*2.4,r=4+Math.sqrt(i)*2.4;s.g.position.set(Math.cos(a)*r,0,Math.sin(a)*r-3);s.following=false;s.v.set(0,0,0);s.vy=0;});count.textContent='0';message.textContent='Your flock is waiting to meet you.';}
document.querySelector('#reset').onclick=reset;
function obstacleAt(x,z){return obstacles.some(o=>Math.abs(x-o.x)<o.r+.25&&Math.abs(z-o.z)<.6);}
function moveBody(p,dx,dz){const x=THREE.MathUtils.clamp(p.x+dx,-22.8,22.8),z=THREE.MathUtils.clamp(p.z+dz,-22.8,22.8);if(p.y>.65||!obstacleAt(x,p.z))p.x=x;if(p.y>.65||!obstacleAt(p.x,z))p.z=z;}
function update(dt){time+=dt;let dx=right.x*analog.x-forward.x*analog.y,dz=right.z*analog.x-forward.z*analog.y;if(keys.has('KeyW')||keys.has('ArrowUp')){dx+=forward.x;dz+=forward.z;}if(keys.has('KeyS')||keys.has('ArrowDown')){dx-=forward.x;dz-=forward.z;}if(keys.has('KeyD')||keys.has('ArrowRight')){dx+=right.x;dz+=right.z;}if(keys.has('KeyA')||keys.has('ArrowLeft')){dx-=right.x;dz-=right.z;}const len=Math.hypot(dx,dz),inputStrength=Math.min(1,len),speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?6:3.7;if(len){dx/=len;dz/=len;moveBody(player.position,dx*speed*inputStrength*dt,dz*speed*inputStrength*dt);player.rotation.y=Math.atan2(dx,dz);}if(jumpQueued&&player.position.y<=.001)vy=6.5;jumpQueued=false;vy-=17*dt;player.position.y=Math.max(0,player.position.y+vy*dt);if(player.position.y===0)vy=0;legs.forEach((l,i)=>l.rotation.x=len?Math.sin(time*11+i*Math.PI)*.55:0);arms.forEach((l,i)=>l.rotation.x=len?Math.sin(time*11+i*Math.PI)*-.3:0);
for(const s of flock){const p=s.g.position;const toPlayer=new THREE.Vector3(player.position.x-p.x,0,player.position.z-p.z);const distance=toPlayer.length();if(!s.following&&distance<2.65){s.following=true;const n=flock.filter(q=>q.following).length;count.textContent=n;message.textContent=n===12?'All together. Take your flock for a wander!':'A new friend! Keep exploring the meadow.';}
const force=new THREE.Vector3();if(s.following&&distance>2.1)force.addScaledVector(toPlayer.normalize(),Math.min(3.8,(distance-2)*1.5));else if(!s.following){force.set(Math.sin(time*.22+s.phase)*.17,0,Math.cos(time*.19+s.phase)*.17);}
const separation=new THREE.Vector3(),alignment=new THREE.Vector3(),center=new THREE.Vector3();let neighbors=0;for(const q of flock){if(q===s)continue;const diff=new THREE.Vector3().subVectors(p,q.g.position);diff.y=0;const d=diff.length();if(d<1.5&&d>.001)separation.addScaledVector(diff,1/(d*d));if(d<4&&q.following===s.following){alignment.add(q.v);center.add(q.g.position);neighbors++;}}
force.addScaledVector(separation,1.8);if(neighbors&&s.following){force.addScaledVector(alignment.divideScalar(neighbors),.3);center.divideScalar(neighbors).sub(p);center.y=0;force.addScaledVector(center,.13);}if(distance<1.35)force.addScaledVector(new THREE.Vector3(p.x-player.position.x,0,p.z-player.position.z),2);
s.v.lerp(force,1-Math.exp(-3*dt));s.v.clampLength(0,s.following?4.2:.5);if(p.y===0&&s.v.length()>.3&&obstacleAt(p.x+s.v.x*.4,p.z+s.v.z*.4))s.vy=5.5;s.vy-=17*dt;p.y=Math.max(0,p.y+s.vy*dt);if(p.y===0)s.vy=0;moveBody(p,s.v.x*dt,s.v.z*dt);if(s.v.length()>.18)s.g.rotation.y=Math.atan2(s.v.x,s.v.z);s.legs.forEach((l,i)=>l.rotation.x=Math.sin(time*10+s.phase+i*Math.PI)*Math.min(.5,s.v.length()*.2));s.g.rotation.x=!s.following?Math.sin(time*1.4+s.phase)*.09:0;}
const target=new THREE.Vector3(player.position.x+13,16,player.position.z+18);camera.position.lerp(target,1-Math.exp(-3*dt));camera.lookAt(player.position.x-2.5,.5,player.position.z-2);}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();camera.position.set(13,16,26);const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{update(Math.min(clock.getDelta(),.04));renderer.render(scene,camera);});
// Read-only state for gameplay smoke checks.
window.sheepGame={getState:()=>({player:player.position.toArray(),followers:flock.filter(s=>s.following).length,sheep:flock.map(s=>({position:s.g.position.toArray(),following:s.following})),obstacles})};
