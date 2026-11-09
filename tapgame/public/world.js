export const stations = [
  {name:'Notebook',kind:'notebook',x:-8,z:-4,color:0x998477,customer:'Maya'},
  {name:'Pencils',kind:'pencil',x:-2.8,z:-4,color:0xd2a35d,customer:'Noah'},
  {name:'Pens',kind:'pen',x:3.2,z:-4,color:0x678f9d,customer:'Alex'},
  {name:'Headphones',kind:'headphones',x:8.5,z:-4,color:0x757c92,customer:'Sam'}
];
export const shelves=[{x:-5.5,z:1,w:2,d:7},{x:0,z:1,w:2,d:7},{x:5.5,z:1,w:2,d:7}];
export function solid(x,z){return x < -10.7 || x > 10.7 || z < -9.5 || z > 10.4 || shelves.some(s=>Math.abs(x-s.x)<s.w/2+.38&&Math.abs(z-s.z)<s.d/2+.38) || stations.some(s=>Math.abs(x-s.x)<.85&&Math.abs(z-s.z)<.65)}
export function createWorld(){return {phase:'intro',player:{x:0,z:9,angle:0},jobs:stations.map(s=>({...s,clean:0})),time:0,suspicion:0,lastTrouble:-10,spraying:false,moving:false,active:-1,keeper:{x:9,z:8,waypoint:0},message:'Four customers. Four things to make sparkle.'}}
export function move(w,dx,dz,dt){const n=Math.max(1,Math.hypot(dx,dz));dx/=n;dz/=n;w.moving=Math.hypot(dx,dz)>.05;if(!w.moving)return;const p=w.player,steps=Math.ceil(3.8*dt/.12);for(let i=0;i<steps;i++){const x=p.x+dx*3.8*dt/steps,z=p.z+dz*3.8*dt/steps;if(!solid(x,p.z))p.x=x;if(!solid(p.x,z))p.z=z}p.angle=Math.atan2(dx,dz)}
export function tick(w,dt,input){if(w.phase!=='playing')return;w.time+=dt;move(w,input.x,input.z,dt);w.spraying=!!input.spray;w.active=-1;
 const nearest=w.jobs.map((j,i)=>({i,d:Math.hypot(j.x-w.player.x,j.z-w.player.z)})).filter(a=>w.jobs[a.i].clean<1).sort((a,b)=>a.d-b.d)[0];
 if(nearest&&nearest.d<2.15){w.active=nearest.i;const j=w.jobs[nearest.i];w.message=`Hold WASH to clean ${j.customer}’s ${j.name.toLowerCase()}`;if(w.spraying){w.player.angle=Math.atan2(j.x-w.player.x,j.z-w.player.z);j.clean=Math.min(1,j.clean+dt/2.6);if(j.clean===1)w.message=`${j.customer}: Thank you! It’s sparkling!`}}
 else if(w.jobs.every(j=>j.clean===1))w.message='Everything is clean! Return to the green service desk.';
 else w.message='Find a customer’s wash station — follow the floating item signs.';
 // The shopkeeper minds stray spray, while washing at a station is welcome.
 if(w.spraying&&!w.jobs.some(j=>Math.hypot(j.x-w.player.x,j.z-w.player.z)<2.15)){w.suspicion=Math.min(100,w.suspicion+dt*19);w.lastTrouble=w.time;w.message='Shopkeeper: At the wash stations, please!'}
 if(w.time-w.lastTrouble>3)w.suspicion=Math.max(0,w.suspicion-dt*9);
 const route=[[9,8],[9,-8],[-9,-8],[-9,7],[9,7]],k=w.keeper,t=route[k.waypoint];const dx=t[0]-k.x,dz=t[1]-k.z,d=Math.hypot(dx,dz),speed=w.suspicion>60?2.8:1.1;
 if(d<.1)k.waypoint=(k.waypoint+1)%route.length;else{k.x+=dx/d*Math.min(d,speed*dt);k.z+=dz/d*Math.min(d,speed*dt)}
 if(w.suspicion>=100){w.phase='lost';w.spraying=false;w.message='Too much stray spray! The shopkeeper has asked you to try again.'}
 if(w.jobs.every(j=>j.clean===1)&&Math.abs(w.player.x)<2&&w.player.z>8){w.phase='won';w.spraying=false;w.message='Four happy customers. A perfect little washing day!'}
}
export function stickVector(dx,dy,radius){const d=Math.hypot(dx,dy),n=Math.min(1,d/radius),speed=Math.max(0,(n-.12)/.88);return {x:d?dx/d*speed:0,z:d?dy/d*speed:0,px:d?dx/d*Math.min(d,radius):0,py:d?dy/d*Math.min(d,radius):0}}
