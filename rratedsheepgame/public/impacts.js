import * as THREE from './vendor/three.module.js';
import {moveBody,verticalStep,supportAt} from './physics.js';
// Sweep relative motion through an expanded car rectangle (including vertical overlap).
export function carContact(car,from,to,radius,height){
 const old=car.previous||car.g.position,now=car.g.position;
 const a={x:from.x-old.x,z:from.z-old.z},b={x:to.x-now.x,z:to.z-now.z};
 let enter=0,exit=1;
 for(const [axis,size] of [['x',.85+radius],['z',1.5+radius]]){const d=b[axis]-a[axis];if(Math.abs(d)<1e-8){if(Math.abs(a[axis])>size)return false;}else{let first=(-size-a[axis])/d,last=(size-a[axis])/d;if(first>last)[first,last]=[last,first];enter=Math.max(enter,first);exit=Math.min(exit,last);if(enter>exit)return false;}}
 const y=from.y+(to.y-from.y)*enter,carY=old.y+(now.y-old.y)*enter;
 return y<carY+1.4&&y+height>carY;
}
export function createImpactSystem(scene,colliders,heightAt){
 const targets=[],byRoot=new WeakMap(),staticWorld=colliders.slice();staticWorld.groundHeight=heightAt;
 const starShape=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.095:.22;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?starShape.lineTo(x,y):starShape.moveTo(x,y);}starShape.closePath();
 const starGeometry=new THREE.ShapeGeometry(starShape),starMaterial=new THREE.MeshBasicMaterial({color:0xffdd58,side:THREE.DoubleSide});
 function register(root,body,limbs=[],center=.8,onRecover=()=>{}){
  const pivot=new THREE.Group();pivot.position.y=center;
  for(const child of [...root.children]){root.remove(child);child.position.y-=center;pivot.add(child);}root.add(pivot);
  const stars=new THREE.Group();for(let i=0;i<4;i++){const star=new THREE.Mesh(starGeometry,starMaterial);stars.add(star);}stars.visible=false;scene.add(stars);
  const t={root,body,pivot,stars,limbs,center,onRecover,active:false,immuneUntil:0,starsUntil:0,previous:root.position.clone(),velocity:new THREE.Vector3(),spin:new THREE.Vector3(),phase:'normal'};targets.push(t);byRoot.set(root,t);return t;
 }
 function hit(t,car,time){
  if(t.active||time<t.immuneUntil||t.body.active===false)return;
  const side=t.root.position.x>=car.g.position.x?1:-1;
  t.velocity.set(side*5.5,8.2,-car.direction*10);t.spin.set(6,-side*3.5,side*7);t.active=true;t.phase='flying';t.still=0;t.age=0;t.starsUntil=Infinity;t.immuneUntil=Infinity;
 }
 function collide(cars,time){for(const t of targets){if(t.body.active===false)continue;for(const car of cars)if(carContact(car,t.previous.distanceTo(t.root.position)>2?t.root.position:t.previous,t.root.position,t.body.radius+.06,t.body.height))hit(t,car,time);t.previous.copy(t.root.position);}}
 function step(root,dt,time){const t=byRoot.get(root);if(!t)return false;
  t.stars.visible=t.body.active!==false&&(t.active||time<t.starsUntil);
  if(t.stars.visible){t.stars.position.set(root.position.x,root.position.y+2.4,root.position.z);t.stars.children.forEach((s,i)=>{const a=time*3+i*Math.PI/2;s.position.set(Math.cos(a)*.65,Math.sin(a*2)*.1,Math.sin(a)*.65);s.rotation.set(0,-root.rotation.y,time+i);});}
  if(!t.active)return false;
  t.age+=dt;
  if(t.phase==='recovering'){
   const alpha=Math.min(1,t.recovery/ .65);t.pivot.position.y=t.center+t.restOffset*(1-alpha);t.recovery+=dt;t.pivot.quaternion.slerpQuaternions(t.restRotation,new THREE.Quaternion(),alpha);
   for(const limb of t.limbs)limb.rotation.x*=Math.exp(-dt*8);
   if(alpha>=1){t.active=false;t.phase='normal';t.pivot.rotation.set(0,0,0);t.immuneUntil=time+2;t.starsUntil=time+2;t.onRecover();}
   return true;
  }
  const p=root.position,oldX=p.x,oldZ=p.z,oldVy=t.velocity.y;
  const radius=t.body.radius;
  moveBody(p,t.velocity.x*dt,t.velocity.z*dt,radius,staticWorld);
  if(Math.abs(p.x-oldX)<Math.abs(t.velocity.x*dt)*.2)t.velocity.x*=-.25;
  if(Math.abs(p.z-oldZ)<Math.abs(t.velocity.z*dt)*.2)t.velocity.z*=-.25;
  t.velocity.y=verticalStep(p,t.velocity.y,dt,radius,staticWorld);
  const grounded=p.y<=supportAt(p,radius,staticWorld)+.025&&t.velocity.y===0;
  if(grounded&&oldVy<-2)t.velocity.y=-oldVy*.18;
  const drag=Math.exp(-dt*(grounded?5:.3));t.velocity.x*=drag;t.velocity.z*=drag;t.spin.multiplyScalar(Math.exp(-dt*(grounded?5:.2)));
  t.pivot.rotation.x+=t.spin.x*dt;t.pivot.rotation.y+=t.spin.y*dt;t.pivot.rotation.z+=t.spin.z*dt;
  // Floppy limbs accompany the rotating body while airborne, then settle.
  for(let i=0;i<t.limbs.length;i++)t.limbs[i].rotation.x=Math.sin(t.age*11+i*1.8)*Math.min(1.2,t.spin.length()*.12);
  // Keep the rotated body above terrain: its visible lowest point, not just its origin.
  t.pivot.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(t.pivot);const clearance=Math.max(0,t.pivot.position.y-t.center+heightAt(p.x,p.z)-bounds.min.y);t.pivot.position.y=t.center+clearance;
  t.still=grounded&&Math.hypot(t.velocity.x,t.velocity.z)<.22&&t.spin.length()<.3?t.still+dt:0;
  if(t.still>.55){t.phase='recovering';t.recovery=0;t.restRotation=t.pivot.quaternion.clone();t.restOffset=t.pivot.position.y-t.center;}
  return true;
 }
 function reset(){for(const t of targets){t.active=false;t.phase='normal';t.immuneUntil=0;t.starsUntil=0;t.stars.visible=false;t.pivot.rotation.set(0,0,0);t.pivot.position.y=t.center;for(const limb of t.limbs)limb.rotation.set(0,0,0);t.previous.copy(t.root.position);}}
 function snapshot(root){const t=byRoot.get(root);return {active:t.active,phase:t.phase,stars:t.stars.visible,spin:t.pivot.rotation.toArray().slice(0,3)};}
 return {register,collide,step,reset,snapshot,targets,hide:root=>{byRoot.get(root).stars.visible=false;}};
}
