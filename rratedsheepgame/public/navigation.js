import {blockingAt} from './physics.js';
const worlds=new WeakMap();
// A small local grid routes around fence lines to real openings; edges are swept too.
export function sheepRoute(start,goal,colliders,heightAt){
 const step=2,margin=22,minX=Math.floor((Math.min(start.x,goal.x)-margin)/step),maxX=Math.ceil((Math.max(start.x,goal.x)+margin)/step),minZ=Math.floor((Math.min(start.z,goal.z)-margin)/step),maxZ=Math.ceil((Math.max(start.z,goal.z)+margin)/step);
 let world=worlds.get(colliders);if(!world||world.count!==colliders.length){world={count:colliders.length,view:colliders.slice(),cache:new Map()};worlds.set(colliders,world);}const {view,cache}=world;
 function free(x,z){const key=x.toFixed(3)+','+z.toFixed(3);if(!cache.has(key))cache.set(key,!blockingAt(x,z,heightAt(x,z)+.05,.5,view));return cache.get(key);}
 function clear(a,b){const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.4);for(let i=1;i<=n;i++)if(!free(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;return true;}
 let sx=Math.round(start.x/step),sz=Math.round(start.z/step);if(!free(sx*step,sz*step)||!clear(start,{x:sx*step,z:sz*step})){let found=false;for(let radius=1;radius<=3&&!found;radius++)for(let dx=-radius;dx<=radius&&!found;dx++)for(let dz=-radius;dz<=radius;dz++){const x=Math.round(start.x/step)+dx,z=Math.round(start.z/step)+dz;if(free(x*step,z*step)&&clear(start,{x:x*step,z:z*step})){sx=x;sz=z;found=true;break;}}if(!found)return [];}const tx=Math.round(goal.x/step),tz=Math.round(goal.z/step),key=(x,z)=>x+','+z;
 const first={x:sx,z:sz,g:0,f:0,parent:null},open=[first],best=new Map([[key(sx,sz),0]]);let visited=0;
 while(open.length&&visited++<4500){let index=0;for(let i=1;i<open.length;i++)if(open[i].f<open[index].f)index=i;const node=open.splice(index,1)[0];
  const here={x:node.x*step,z:node.z*step};
  if(Math.hypot(here.x-goal.x,here.z-goal.z)<3&&clear(here,goal)){const path=[goal];for(let n=node;n;n=n.parent)path.push({x:n.x*step,z:n.z*step});return path.reverse();}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=node.x+dx,z=node.z+dz;if(x<minX||x>maxX||z<minZ||z>maxZ)continue;const cost=node.g+Math.hypot(dx,dz),k=key(x,z);if(cost>=(best.get(k)??Infinity)||!clear(here,{x:x*step,z:z*step}))continue;best.set(k,cost);open.push({x,z,g:cost,f:cost+Math.hypot(x-tx,z-tz),parent:node});}
 }
 return [];
}
