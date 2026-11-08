import {PARCELS} from './landscape.js';
// Broad continuous waves, not separate hill meshes. Maximum natural grades are gentle.
export function naturalHeight(x,z){
 return 2.7*Math.sin((x+18)/52)*Math.cos((z-12)/77)
  +1.65*Math.sin((z+23)/49)+.95*Math.cos((x+z)/94);
}
// Level only foundations and water, leaving gardens and pasture free to roll.
export const TERRAIN_PADS=[];
function pad(x,z,w,d){TERRAIN_PADS.push({x,z,w,d,height:naturalHeight(x,z)});}
for(const p of PARCELS){
 if(p.use==='pond')pad(p.x,p.z,p.w,p.d);
 if(p.use==='farm')pad(p.x+8,p.z-12,12,10);
 if(p.use==='home')pad(p.x,p.z-8,16,12);
 if(p.use==='town'||p.use==='residential')for(let i=0;i<Math.floor(p.w/12);i++)pad(p.x-p.w/2+7+i*12,p.z,9,8);
}
const pads=TERRAIN_PADS;
export function terrainHeight(x,z){
 let weight=1,total=naturalHeight(x,z);
 for(const p of pads){
  const dx=Math.max(0,Math.abs(x-p.x)-p.w/2),dz=Math.max(0,Math.abs(z-p.z)-p.d/2),distance=Math.hypot(dx,dz);
  if(distance===0)return p.height;
  const t=distance/24;if(t>=1)continue;
  // Inverse cubic weights meet each level plot with zero slope and curvature.
  const w=((1-t)/t)**3;weight+=w;total+=w*p.height;
 }
 return total/weight;
}
export function terrainNormal(x,z){const step=.1;const dx=(terrainHeight(x+step,z)-terrainHeight(x-step,z))/(2*step),dz=(terrainHeight(x,z+step)-terrainHeight(x,z-step))/(2*step),length=Math.hypot(dx,1,dz);return [-dx/length,1/length,-dz/length];}
