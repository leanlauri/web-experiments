// Horizontal circles against boxes, with solid tops for safe landings.
export const WALK_SPEED = 3.7 * 1.4;
export const RUN_SPEED = 6 * 1.4;
export const GRAVITY = 17;
export const JUMP_SPEED = 8;
// Static spatial buckets keep collision probes local as the countryside grows.
const spatial=new WeakMap(),CELL=12;
function nearby(x,z,r,colliders){
 let index=spatial.get(colliders);
 if(!index||index.length!==colliders.length){
  const buckets=new Map();for(const c of colliders)for(let gx=Math.floor((c.x-c.hx)/CELL);gx<=Math.floor((c.x+c.hx)/CELL);gx++)for(let gz=Math.floor((c.z-c.hz)/CELL);gz<=Math.floor((c.z+c.hz)/CELL);gz++){const key=gx+','+gz;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(c);}index={length:colliders.length,buckets};spatial.set(colliders,index);
 }
 const found=new Set();for(let gx=Math.floor((x-r)/CELL);gx<=Math.floor((x+r)/CELL);gx++)for(let gz=Math.floor((z-r)/CELL);gz<=Math.floor((z+r)/CELL);gz++)for(const c of index.buckets.get(gx+','+gz)||[])found.add(c);return found;
}
function groundAt(x,z,colliders){return colliders.groundHeight?.(x,z)??0;}
export function overlaps(x,z,r,c){
  const nearX=Math.max(c.x-c.hx,Math.min(x,c.x+c.hx));
  const nearZ=Math.max(c.z-c.hz,Math.min(z,c.z+c.hz));
  return (x-nearX)**2+(z-nearZ)**2 < r*r;
}
export function indexBodies(colliders){
 const buckets=new Map();for(const body of colliders.bodies||[]){if(body.active===false)continue;const p=body.position,r=body.radius+2;for(let x=Math.floor((p.x-r)/CELL);x<=Math.floor((p.x+r)/CELL);x++)for(let z=Math.floor((p.z-r)/CELL);z<=Math.floor((p.z+r)/CELL);z++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(body);}}colliders.bodyBuckets=buckets;
}
function nearbyBodies(x,z,r,colliders){if(!colliders.bodyBuckets)return colliders.bodies||[];const bodies=new Set();for(let gx=Math.floor((x-r)/CELL);gx<=Math.floor((x+r)/CELL);gx++)for(let gz=Math.floor((z-r)/CELL);gz<=Math.floor((z+r)/CELL);gz++)for(const b of colliders.bodyBuckets.get(gx+','+gz)||[])bodies.add(b);return bodies;}
function bodyBlock(x,z,y,r,b,ignore){
 if(b.position===ignore||b.active===false)return false;
 const p=b.position;if(y>=p.y+b.height||y+1.5<=p.y)return false;
 if(b.kind==='car'){
  const box={x:p.x,z:p.z,hx:b.hx,hz:b.hz};if(!overlaps(x,z,r,box))return false;
  if(ignore&&overlaps(ignore.x,ignore.z,r,box)&&Math.hypot(x-p.x,z-p.z)>Math.hypot(ignore.x-p.x,ignore.z-p.z)+1e-7)return false;
  return true;
 }
 const d=Math.hypot(x-p.x,z-p.z),limit=r+b.radius;
 if(d>=limit-.001)return false;
 // Allow already touching/spawned bodies to separate, without tunnelling through one another.
 if(ignore&&Math.hypot(ignore.x-p.x,ignore.z-p.z)<limit&&d>Math.hypot(ignore.x-p.x,ignore.z-p.z)+1e-7)return false;
 return true;
}
export function blockingAt(x,z,y,r,colliders,ignore=null){
 for(const c of nearby(x,z,r,colliders))if((y<c.h-.001||(colliders.sheepPositions?.has(ignore)&&c.kind==='fence'))&&overlaps(x,z,r,c))return c;
 for(const b of nearbyBodies(x,z,r,colliders))if(bodyBlock(x,z,y,r,b,ignore))return {kind:b.kind==='car'?'car':'animal',h:b.position.y+b.height,base:b.position.y,body:b};
}
export function supportAt(p,r,colliders){let floor=groundAt(p.x,p.z,colliders);for(const c of nearby(p.x,p.z,r,colliders))if(c.h<=p.y+.025&&overlaps(p.x,p.z,r,c))floor=Math.max(floor,c.h);return floor;}
export function moveBody(p,dx,dz,r,colliders){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));
  for(let i=0;i<steps;i++){
    const oldGround=groundAt(p.x,p.z,colliders),onGround=Math.abs(p.y-oldGround)<.05;
    if(!blockingAt(p.x+dx/steps,p.z,p.y,r,colliders,p))p.x+=dx/steps;
    if(!blockingAt(p.x,p.z+dz/steps,p.y,r,colliders,p))p.z+=dz/steps;
    if(onGround)p.y+=groundAt(p.x,p.z,colliders)-oldGround;
  }
}
export function verticalStep(p,vy,dt,r,colliders){
  const previous=p.y;vy-=GRAVITY*dt;let next=previous+vy*dt;
  let floor=groundAt(p.x,p.z,colliders);
  if(vy<=0)for(const c of nearby(p.x,p.z,r,colliders))if(c.h<=previous+.025&&c.h>=next&&overlaps(p.x,p.z,r,c))floor=Math.max(floor,c.h);
  if(next<=floor){next=floor;vy=0;}p.y=next;return vy;
}
export function obstacleAhead(p,v,r,colliders,maxHeight=Infinity){
  const speed=Math.hypot(v.x,v.z);if(speed<.05)return null;
  // Sweep the entire approach; endpoint-only probes miss thin fences and logs.
  for(let d=.08;d<=r+.85;d+=.08){const c=blockingAt(p.x+v.x/speed*d,p.z+v.z/speed*d,p.y,r,colliders,p);if(c&&c.h-(c.base??0)<=maxHeight)return c;}
  return null;
}
