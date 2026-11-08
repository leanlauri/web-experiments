import {createImpactSystem} from './impacts.js';
import {avoidObstacle,turnToward} from './steering.js';
import {SHEEP_HOP_SPEED,sheepCanHop} from './animals.js';
import {sheepRoute} from './navigation.js';
import {terrainHeight} from './terrain.js';
import * as THREE from './vendor/three.module.js';
import {WALK_SPEED,RUN_SPEED,JUMP_SPEED,indexBodies,moveBody as moveSolid,verticalStep,supportAt,obstacleAhead} from './physics.js';
import {buildCountryside} from './countryside.js';
import {HOME,BOUNDS,PATHS,canShelter} from './landscape.js';
const colliders=[];colliders.groundHeight=terrainHeight;colliders.bodies=[];colliders.sheepPositions=new WeakSet();
function collider(x,z,hx,hz,h,kind){colliders.push({x,z,hx,hz,h:h+terrainHeight(x,z),base:terrainHeight(x,z),kind});}
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
// A small following patch continues the same height field beyond the detailed map.
const groundGeo=new THREE.PlaneGeometry(240,240,80,80);groundGeo.rotateX(-Math.PI/2);
const ground=mesh(groundGeo,new THREE.MeshLambertMaterial({color:0x91b76c}),scene);let groundX=Infinity,groundZ=Infinity;
function updateOuterGround(x,z){const gx=Math.round(x/24)*24,gz=Math.round(z/24)*24;if(gx===groundX&&gz===groundZ)return;groundX=gx;groundZ=gz;const positions=groundGeo.attributes.position;for(let i=0;i<positions.count;i++)positions.setY(i,terrainHeight(positions.getX(i)+gx,positions.getZ(i)+gz)-.12);positions.needsUpdate=true;groundGeo.computeVertexNormals();groundGeo.computeBoundingSphere();ground.position.set(gx,0,gz);}
updateOuterGround(0,8);
let seed=324;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const obstacles=[{x:2,z:1,r:1.65,h:.55},{x:-7,z:-4,r:1.5,h:.5},{x:9,z:-10,r:1.8,h:.6}];
for(const o of obstacles){collider(o.x,o.z,o.r,o.h/2,o.h,'log');const log=mesh(new THREE.CylinderGeometry(o.h/2,o.h/2,o.r*2,9),wood,scene,o.x,terrainHeight(o.x,o.z)+o.h/2,o.z);log.rotation.z=Math.PI/2;for(const dx of [-1,1]){const end=mesh(new THREE.CircleGeometry(o.h*.39,9),mat(0xc9a67b),scene,o.x+dx*(o.r+.01),terrainHeight(o.x,o.z)+o.h/2,o.z);end.rotation.y=dx*Math.PI/2;}}
const countryside=buildCountryside(scene,collider,colliders);
function sheepModel(){const g=new THREE.Group();ball(g,wool,0,.82,0,.53,.5,.73);for(let i=0;i<7;i++){const a=i*2.4;ball(g,wool,Math.cos(a)*.35,.92+(i%2)*.19,Math.sin(a)*.44,.28);}ball(g,dark,0,.94,.66,.27,.3,.3);for(const s of [-1,1]){ball(g,dark,s*.32,1.01,.63,.19,.08,.12);ball(g,mat(0xffffff),s*.15,1.02,.91,.06);ball(g,mat(0x292c28),s*.15,1.02,.96,.026);}const legs=[];for(const x of [-.28,.28])for(const z of [-.4,.4])legs.push(box(g,dark,x,.27,z,.12,.5,.13));ball(g,wool,0,.91,-.7,.16);return {g,legs};}
const flock=[];for(let i=0;i<12;i++){const model=sheepModel();scene.add(model.g);const a=i*2.4,r=4+Math.sqrt(i)*2.4;model.g.position.set(Math.cos(a)*r,terrainHeight(Math.cos(a)*r,Math.sin(a)*r-3),Math.sin(a)*r-3);const body={position:model.g.position,radius:.48,height:1.35,kind:'sheep',active:true};colliders.bodies.push(body);colliders.sheepPositions.add(model.g.position);flock.push({...model,body,v:new THREE.Vector3(),vy:0,following:false,phase:rand()*6.28});}
const player=new THREE.Group();scene.add(player);const coat=mat(0x477a87),skin=mat(0xf0be92),boots=mat(0x534b3e),hat=mat(0xd6b875);
box(player,coat,0,1.03,0,.58,.75,.35);ball(player,skin,0,1.64,0,.25,.28,.24);mesh(new THREE.CylinderGeometry(.42,.42,.08,12),hat,player,0,1.87,0);mesh(new THREE.CylinderGeometry(.25,.3,.25,10),hat,player,0,1.99,0);const arms=[];for(const s of [-1,1]){arms.push(box(player,coat,s*.37,1.01,0,.17,.63,.2));ball(player,skin,s*.37,.66,0,.10);}const legs=[box(player,boots,-.17,.35,0,.2,.65,.24),box(player,boots,.17,.35,0,.2,.65,.24)];mesh(new THREE.CylinderGeometry(.035,.035,1.8,6),wood,player,.57,.93,.12);player.position.set(0,terrainHeight(0,8),8);
const playerBody={position:player.position,radius:.32,height:2.1,kind:'shepherd',active:true};colliders.bodies.push(playerBody);
const impacts=createImpactSystem(scene,colliders,terrainHeight);
impacts.register(player,playerBody,[...arms,...legs],1,()=>{vy=0;});
for(const s of flock)impacts.register(s.g,s.body,s.legs,.75,()=>{s.v.set(0,0,0);s.vy=0;s.hopVelocity=null;s.route=null;s.avoidance={};s.stalled=0;});
const keys=new Set();let jumpQueued=false,vy=0,time=0,sheltered=0,won=false;const trail=[new THREE.Vector3(0,terrainHeight(0,8),8)];const forward=new THREE.Vector3(-.6,0,-.8),right=new THREE.Vector3(.8,0,-.6);
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
function reset(){countryside.resetActors();sheltered=0;won=false;time=0;trail.length=0;trail.push(new THREE.Vector3(0,terrainHeight(0,8),8));document.querySelector('#victory').hidden=true;releaseStick();keys.clear();jumpQueued=false;vy=0;player.position.set(0,terrainHeight(0,8),8);flock.forEach((s,i)=>{const a=i*2.4,r=4+Math.sqrt(i)*2.4;s.g.position.set(Math.cos(a)*r,terrainHeight(Math.cos(a)*r,Math.sin(a)*r-3),Math.sin(a)*r-3);s.sheltered=false;s.body.active=true;s.route=null;s.routeTime=0;s.routeGoal=null;s.avoidance={};s.resting=false;s.stalled=0;s.g.visible=true;s.following=false;s.v.set(0,0,0);s.vy=0;s.hopVelocity=null;});impacts.reset();countryside.updateTraffic(0);count.textContent='0';message.textContent='Your flock is waiting to meet you.';}
document.querySelector('#reset').onclick=reset;
function moveBody(p,dx,dz,r=.32){moveSolid(p,dx,dz,r,colliders);}
function update(dt){indexBodies(colliders);time+=dt;const last=trail[trail.length-1];if(Math.hypot(player.position.x-last.x,player.position.z-last.z)>1){trail.push(player.position.clone());if(trail.length>1400)trail.shift();}let dx=right.x*analog.x-forward.x*analog.y,dz=right.z*analog.x-forward.z*analog.y;if(keys.has('KeyW')||keys.has('ArrowUp')){dx+=forward.x;dz+=forward.z;}if(keys.has('KeyS')||keys.has('ArrowDown')){dx-=forward.x;dz-=forward.z;}if(keys.has('KeyD')||keys.has('ArrowRight')){dx+=right.x;dz+=right.z;}if(keys.has('KeyA')||keys.has('ArrowLeft')){dx-=right.x;dz-=right.z;}const playerTumbling=impacts.step(player,dt,time);if(playerTumbling){dx=0;dz=0;jumpQueued=false;}const len=Math.hypot(dx,dz),inputStrength=Math.min(1,len),speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?RUN_SPEED:WALK_SPEED;if(len){dx/=len;dz/=len;moveBody(player.position,dx*speed*inputStrength*dt,dz*speed*inputStrength*dt);player.rotation.y=Math.atan2(dx,dz);}if(!playerTumbling){if(jumpQueued&&player.position.y<=supportAt(player.position,.32,colliders)+.025&&vy<=0)vy=JUMP_SPEED;jumpQueued=false;vy=verticalStep(player.position,vy,dt,.32,colliders);legs.forEach((l,i)=>l.rotation.x=len?Math.sin(time*11+i*Math.PI)*.55:0);arms.forEach((l,i)=>l.rotation.x=len?Math.sin(time*11+i*Math.PI)*-.3:0);}
for(const s of flock){const p=s.g.position;if(s.sheltered)continue;if(impacts.step(s.g,dt,time))continue;
if(canShelter({following:s.following,x:p.x,z:p.z})){s.sheltered=true;s.body.active=false;s.g.visible=false;impacts.hide(s.g);sheltered++;if(sheltered===12){won=true;document.querySelector('#victory').hidden=false;}continue;}
let followTarget=player.position;
if(s.following&&Math.hypot(player.position.x-HOME.x,player.position.z-HOME.doorZ)<15){followTarget=new THREE.Vector3(HOME.x,0,HOME.z+1);}
else if(s.following&&p.distanceTo(player.position)>8){let nearest=0,best=Infinity;for(let i=0;i<trail.length;i++){const d=(p.x-trail[i].x)**2+(p.z-trail[i].z)**2;if(d<best){best=d;nearest=i;}}followTarget=trail[Math.min(nearest+4,trail.length-1)];}
if(s.following){
 const desired=new THREE.Vector3(followTarget.x-p.x,0,followTarget.z-p.z),hit=obstacleAhead(p,desired,.48,colliders);
 const goalMoved=s.routeGoal&&Math.hypot(followTarget.x-s.routeGoal.x,followTarget.z-s.routeGoal.z)>6;
 const needsRoute=(!s.route?.length&&hit&&hit.kind!=='animal'&&!sheepCanHop(hit,desired))||goalMoved||(s.stalled||0)>1.5;
 if(time>(s.routeTime||0)&&needsRoute){
  const route=sheepRoute(p,followTarget,colliders,terrainHeight);
  if(route.length){s.route=route;s.routeGoal={x:followTarget.x,z:followTarget.z};}
  s.routeTime=time+2;s.stalled=0;
 }
 while(s.route?.length&&Math.hypot(p.x-s.route[0].x,p.z-s.route[0].z)<1)s.route.shift();
 if(s.route?.length)followTarget=s.route[0];
}
const toPlayer=new THREE.Vector3(followTarget.x-p.x,0,followTarget.z-p.z);const distance=toPlayer.length();if(!s.following&&p.distanceTo(player.position)<2.65){s.following=true;const n=flock.filter(q=>q.following).length;count.textContent=n;message.textContent=n===12?'All together. Take your flock for a wander!':'A new friend! Keep exploring the meadow.';}
const force=new THREE.Vector3();if(s.following&&distance>(followTarget===player.position?2.1:.4))force.addScaledVector(toPlayer.normalize(),Math.min(5.32,(distance-(followTarget===player.position?2:.2))*1.8));else if(!s.following){force.set(Math.sin(time*.22+s.phase)*.17,0,Math.cos(time*.19+s.phase)*.17);}
const separation=new THREE.Vector3(),alignment=new THREE.Vector3(),center=new THREE.Vector3();let neighbors=0;for(const q of flock){if(q===s||q.sheltered||impacts.snapshot(q.g).active)continue;const diff=new THREE.Vector3().subVectors(p,q.g.position);diff.y=0;const d=diff.length();if(d<1.5&&d>.001)separation.addScaledVector(diff,1/(d*d));if(d<4&&q.following===s.following){alignment.add(q.v);center.add(q.g.position);neighbors++;}}
force.addScaledVector(separation,s.route?.length ? .75 : 1.4);if(neighbors&&s.following){force.addScaledVector(alignment.divideScalar(neighbors),s.route?.length ? .08 : .25);center.divideScalar(neighbors).sub(p);center.y=0;force.addScaledVector(center,s.route?.length ? .03 : .1);}if(followTarget===player.position&&distance<1.35)force.addScaledVector(new THREE.Vector3(p.x-player.position.x,0,p.z-player.position.z),2);
// Arrival hysteresis prevents attraction/repulsion from toggling at one distance.
if(followTarget===player.position&&s.following){
 if(distance>3.3||separation.length()>1.8)s.resting=false;
 else if(distance<2.7&&s.v.length()<.6)s.resting=true;
 if(s.resting)force.multiplyScalar(0);
}else s.resting=false;
force.clampLength(0,s.following?5.88:.7);
s.avoidance ||= {};
const guided=avoidObstacle(s.avoidance,force,dt,time,v=>{
 const hit=obstacleAhead(p,v,.48,colliders);return hit&&!sheepCanHop(hit,v);
});
s.v.lerp(new THREE.Vector3(guided.x,0,guided.z),1-Math.exp(-5*dt));
if(s.v.length()<.06&&Math.hypot(guided.x,guided.z)<.08)s.v.set(0,0,0);
const grounded=p.y<=supportAt(p,.48,colliders)+.025&&s.vy<=0;
if(grounded){
  s.hopVelocity=null;
  const hit=obstacleAhead(p,s.v,.48,colliders);
  // Wait until near a low log; fences and animal bodies are never hop targets.
  const nearLog=hit&&sheepCanHop(hit,s.v)&&Math.abs(p.z-hit.z)<hit.hz+.48+.3;
  if(nearLog){
    s.vy=SHEEP_HOP_SPEED;
    // Commit to crossing so flock separation cannot cancel a hop halfway through.
    s.hopVelocity=s.v.clone().normalize().multiplyScalar(Math.max(6.8,s.v.length()));
  }
}
const travel=s.hopVelocity||s.v;
s.vy=verticalStep(p,s.vy,dt,.48,colliders);
const oldX=p.x,oldZ=p.z;
moveBody(p,travel.x*dt,travel.z*dt,.48);
const movedX=p.x-oldX,movedZ=p.z-oldZ,actualSpeed=Math.hypot(movedX,movedZ)/dt;
if(actualSpeed<.08&&Math.hypot(guided.x,guided.z)>.3)s.stalled=(s.stalled||0)+dt;else s.stalled=0;
// Collision-clipped velocity must not keep driving the next frame into the wall.
if(!s.hopVelocity){if(Math.abs(movedX)<Math.abs(s.v.x*dt)*.15)s.v.x=0;if(Math.abs(movedZ)<Math.abs(s.v.z*dt)*.15)s.v.z=0;}
if(actualSpeed>.12)s.g.rotation.y=turnToward(s.g.rotation.y,Math.atan2(movedX,movedZ),dt);
s.legs.forEach((l,i)=>l.rotation.x=Math.sin(time*10+s.phase+i*Math.PI)*Math.min(.5,actualSpeed*.2));s.g.rotation.x=!s.following?Math.sin(time*1.4+s.phase)*.09:0;}
const weather=countryside.update(dt,time,player.position,won);countryside.updateTraffic(time);impacts.collide(countryside.cars,time);
const night=won?1:Math.min(.65,time/600);const sky=new THREE.Color(weather==='Rain'?0x9cabb1:0xc9e4de).lerp(new THREE.Color(0x65778e),night);scene.fog.color.lerp(sky,1-Math.exp(-dt*.5));renderer.setClearColor(scene.fog.color);sun.intensity+=( (weather==='Rain'?1.2:3)*(1-night*.65)-sun.intensity)*(1-Math.exp(-dt*.5));
const distanceHome=Math.round(Math.hypot(player.position.x-HOME.x,player.position.z-HOME.doorZ));
document.querySelector('#journey').textContent=`${weather} · ${sheltered}/12 safely inside · Farmhouse ${distanceHome} m`;
const hx=HOME.x-player.position.x,hz=HOME.doorZ-player.position.z;document.querySelector('#direction').style.transform=`rotate(${Math.atan2(.8*hx-.6*hz,-(.6*hx+.8*hz))}rad)`;
drawMap();
updateOuterGround(player.position.x,player.position.z);sun.position.set(player.position.x-18,terrainHeight(player.position.x,player.position.z)+30,player.position.z+14);sun.target.position.set(player.position.x,terrainHeight(player.position.x,player.position.z),player.position.z);sun.target.updateMatrixWorld();
const groundY=terrainHeight(player.position.x,player.position.z);const target=new THREE.Vector3(player.position.x+13,groundY+16,player.position.z+18);camera.position.lerp(target,1-Math.exp(-3*dt));camera.lookAt(player.position.x-2.5,groundY+.5,player.position.z-2);}
const map=document.querySelector('#map'),mapCtx=map.getContext('2d');
function drawMap(){const c=mapCtx,scale=Math.min(140/(BOUNDS.maxX-BOUNDS.minX),160/(BOUNDS.maxZ-BOUNDS.minZ)),px=x=>5+(x-BOUNDS.minX)*scale,pz=z=>5+(z-BOUNDS.minZ)*scale;c.clearRect(0,0,150,170);c.fillStyle='#9db67b';c.fillRect(0,0,150,170);for(const p of countryside.parcels){c.fillStyle=({forest:'#59794c',pond:'#68a5b5',town:'#c9b59c',home:'#e3c980',crops:'#c2b26a',flowers:'#d3c779'})[p.use]||'#b1c48b';c.fillRect(px(p.x-p.w/2),pz(p.z-p.d/2),p.w*scale,p.d*scale);}c.fillStyle='#7a7c71';for(const r of countryside.roads)c.fillRect(px(r.x-r.w/2),pz(r.z-r.d/2),r.w*scale,r.d*scale);c.strokeStyle='#e8dbaf';c.lineWidth=2;c.beginPath();for(const path of PATHS){c.moveTo(px(path.x-path.w/2),pz(path.z-path.d/2));c.lineTo(px(path.x+path.w/2),pz(path.z+path.d/2));}c.stroke();for(const s of flock){if(s.sheltered)continue;c.fillStyle='#fff9e5';c.fillRect(px(s.g.position.x)-1,pz(s.g.position.z)-1,2,2);}c.fillStyle='#9d6145';c.fillRect(px(HOME.x)-3,pz(HOME.z)-3,6,6);c.fillStyle='#284e67';c.beginPath();c.arc(px(player.position.x),pz(player.position.z),3,0,Math.PI*2);c.fill();}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();camera.position.set(13,terrainHeight(0,8)+16,26);const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{update(Math.min(clock.getDelta(),.04));renderer.render(scene,camera);});
// Read-only state for gameplay smoke checks.
window.sheepGame={getState:()=>({player:player.position.toArray(),playerImpact:impacts.snapshot(player),followers:flock.filter(s=>s.following).length,sheep:flock.map(s=>({position:s.g.position.toArray(),following:s.following,impact:impacts.snapshot(s.g)})),obstacles,colliders,sheltered,won,weather:document.querySelector('#journey').textContent,world:countryside.stats,parcels:countryside.parcels,home:HOME})};
