import {ANIMAL_PROFILES,animalIntent} from './animals.js';
import {moveBody,blockingAt} from './physics.js';
import {terrainHeight,terrainNormal} from './terrain.js';
import * as THREE from './vendor/three.module.js';
import {HOME,ROADS,PATHS,PARCELS,BOUNDS,LAND_COLORS,surfaceAt,roofProfile,reserved,randomSource,inRect,weatherAt} from './landscape.js';
export function buildCountryside(scene,collider,colliders){
 const rand=randomSource(),batches=new Map(),materials=new Map(),actors=[],cars=[],clouds=[],buildings=[];
 const material=c=>{if(!materials.has(c))materials.set(c,new THREE.MeshToonMaterial({color:c}));return materials.get(c);};
 const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.IcosahedronGeometry(1,1),dummy=new THREE.Object3D();
 function shape(geo,c,x,y,z,sx,sy,sz,rz=0){const key=geo.uuid+':'+c;if(!batches.has(key))batches.set(key,{geo,mat:material(c),items:[]});batches.get(key).items.push({x,y:y+terrainHeight(x,z),z,sx,sy,sz,rz});}
 const surfaces=[];const box=(c,x,y,z,w,h,d,rz=0)=>{if(h<=.03&&rz===0){surfaces.push({x,z,w,d,c});return;}shape(cube,c,x,y,z,w,h,d,rz);};
 const ball=(c,x,y,z,w,h=w,d=w)=>shape(sphere,c,x,y,z,w,h,d);
 function tree(x,z,fruit=false){if(reserved(x,z,2.8))return;box(0x876649,x,1.4,z,.4,2.8,.4);ball(0x609052,x,3.4,z,1.7,2,1.7);ball(0x82a65d,x+.7,4,z,1.1);collider(x,z,.3,.3,3,'tree');if(fruit)for(let i=0;i<4;i++)ball(0xc7694e,x+(rand()-.5)*2,3+rand(),z+(rand()-.5)*2,.14);}
 const fenceSegments=[];
 function fence(x,z,w,d){
  // Short panels are omitted wherever their full extent reaches a road, path or gate.
  for(const horizontal of [true,false])for(const side of [-1,1]){
   const length=horizontal?w:d;for(let offset=-length/2;offset<length/2-.01;offset+=3){
    const span=Math.min(3,length/2-offset),cx=x+(horizontal?offset+span/2:side*w/2),cz=z+(horizontal?side*d/2:offset+span/2);
    if((horizontal&&Math.abs(cx-x)<3)||(reserved(cx,cz,span/2+.6)||surfaces.some(r=>inRect(cx,cz,r,span/2+.6))))continue;
    const hx=horizontal?span/2:.07,hz=horizontal?.07:span/2;
    for(const y of [.55,1])box(0xa08460,cx,y,cz,hx*2,.12,hz*2);
    box(0xa08460,cx-(horizontal?span/2:0),.65,cz-(horizontal?0:span/2),.15,1.3,.15);
    collider(cx,cz,hx,hz,1.06,'fence');fenceSegments.push({x:cx,z:cz,hx,hz});
   }
  }
 }
 function house(x,z,w=7,d=6,color=0xe5c9a0,home=false){
  box(color,x,1.6,z,w,3.2,d);
  // A roof prism is defined from its eaves and ridge, never rotated through the walls.
  const profile=roofProfile(w),section=new THREE.Shape();
  section.moveTo(-profile.half,profile.eave);section.lineTo(0,profile.ridge);section.lineTo(profile.half,profile.eave);section.closePath();
  const roofGeo=new THREE.ExtrudeGeometry(section,{depth:d+.9,bevelEnabled:false});roofGeo.translate(0,0,-(d+.9)/2);
  shape(roofGeo,0x805e50,x,0,z,1,1,1);
  buildings.push({x,z,w,d,...profile,wallTop:3.2});
  box(0x70574a,x+w*.28,4,z-1,.65,2,.65);
  if(home){ // Replace the solid facade with a wide, genuinely open sheep doorway.
   // The main visual block is omitted below by removing it from the batch.
   const items=batches.get(cube.uuid+':'+color).items;items.splice(items.findIndex(i=>i.x===x&&i.z===z&&i.sx===w),1);
   for(const side of [-1,1]){box(color,x+side*(w/4+.9),1.6,z,(w-3.6)/2,3.2,d);collider(x+side*(w/4+.9),z,(w-3.6)/4,d/2,4.7,'farmhouse');}
   box(color,x,2.9,z,3.6,.6,d);box(color,x,1.6,z-d/2,w,3.2,.2);collider(x,z-d/2,w/2,.1,4.7,'farmhouse');
   box(0x4b4a3b,x,.03,z,3.5,.04,d);box(0xe7bd69,x,2.5,z+d/2+.04,3.5,.18,.15);
  }else{collider(x,z,w/2,d/2,4.8,'building');box(0x70574a,x,.95,z+d/2+.02,1.1,1.9,.08);}
  // Link each frontage to a road, rather than ending drives in the grass.
  const frontage=z+d/2+.6;
  const ahead=ROADS.filter(r=>r.w>r.d&&Math.abs(x-r.x)<r.w/2&&r.z>frontage&&r.z-frontage<45).sort((a,b)=>a.z-b.z)[0];
  if(ahead)surfaces.push({x,z:(frontage+ahead.z)/2,w:2.8,d:ahead.z-frontage,c:0xcaba91});
  else {const sideRoad=ROADS.filter(r=>r.d>r.w&&Math.abs(z-r.z)<r.d/2).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0];if(sideRoad&&Math.abs(sideRoad.x-x)<55){const edge=x+Math.sign(sideRoad.x-x)*(w/2+.4);surfaces.push({x:(edge+sideRoad.x)/2,z:frontage,w:Math.abs(edge-sideRoad.x),d:2.8,c:0xcaba91});}}
  for(const side of [-1,1])box(0xa6d7d0,x+side*w*.32,1.9,z+d/2+.04,.9,.9,.06);
 }
 function actor(x,z,type){const g=new THREE.Group();scene.add(g);const add=(geo,c,px,py,pz,sx,sy,sz)=>{const m=new THREE.Mesh(geo,material(c));m.position.set(px,py,pz);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m);return m;};
  if(type==='person'){add(cube,[0x6b879b,0xca9a65,0x886a81][Math.floor(rand()*3)],0,.95,0,.45,.7,.3);add(sphere,0xe7b58d,0,1.55,0,.23,.25,.23);for(const s of [-1,1])add(cube,0x514e47,s*.14,.3,0,.15,.6,.2);}
  else if(type==='duck'){add(sphere,0xf5e9c7,0,.22,0,.28,.2,.42);add(sphere,0x7b9970,0,.47,.3,.18,.2,.19);add(cube,0xd9a14d,0,.44,.5,.19,.07,.17);}
  else {const cow=type==='cow',deer=type==='deer';const c=cow?0xf1e8d3:deer?0xad875a:type==='pig'?0xdca59c:0xf1d49a;add(sphere,c,0,cow?.9:.6,0,cow?.7:.4,cow?.5:.3,cow?1:.6);add(sphere,c,0,cow?1.1:.8,cow?.9:.6,.3,.35,.35);for(const x of [-.25,.25])for(const z of [-.4,.4])add(cube,0x665745,x,.25,z,.09,.5,.1);if(cow){add(sphere,0x635c50,.55,1,.1,.2,.22,.45);}if(deer)for(const side of [-1,1])add(cube,0x806744,side*.2,1.3,.6,.04,.6,.04);}
  if(type==='rabbit')for(const side of [-1,1])add(sphere,0xe3c5a1,side*.13,1.18,.6,.08,.3,.08);
  g.position.set(x,terrainHeight(x,z)+(type==='duck'?.17:0),z);
  const profile=ANIMAL_PROFILES[type],body={position:g.position,radius:profile.radius,height:profile.height,kind:type,active:true};colliders.bodies.push(body);
  actors.push({g,x,z,type,phase:rand()*6.28,body,state:'rest',home:{x,z}});
 }
 for(const road of ROADS){const vertical=road.d>road.w;const length=vertical?road.d:road.w;for(let i=-length/2+2;i<length/2;i+=6){if(ROADS.some(r=>r!==road&&inRect(road.x+(vertical?0:i),road.z+(vertical?i:0),r,2)))continue;(()=>{const x=road.x+(vertical?0:i),z=road.z+(vertical?i:0),w=vertical?.12:2.6,d=vertical?2.6:.12;const g=new THREE.PlaneGeometry(w,d,1,4);g.rotateX(-Math.PI/2);const positions=g.attributes.position;for(let k=0;k<positions.count;k++){const vx=positions.getX(k),vz=positions.getZ(k);positions.setY(k,terrainHeight(x+vx,z+vz)-terrainHeight(x,z)+.035);}g.computeVertexNormals();shape(g,0xe3d9b5,x,0,z,1,1,1);})();}}
 function sign(x,z,text){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=112;const c=canvas.getContext('2d');c.fillStyle='#f5e6bc';c.fillRect(0,0,512,112);c.strokeStyle='#8b7755';c.lineWidth=8;c.strokeRect(4,4,504,104);c.fillStyle='#42533e';c.font='600 36px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,56);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas)}));sprite.position.set(x,2.2+terrainHeight(x,z),z);sprite.scale.set(6,1.3,1);scene.add(sprite);box(0x967854,x,1,z,.12,2,.12);
 }
 sign(-4,-21,'Evening Farm ↑');sign(20,-87,'Brook Village →');sign(21,-37,'Apple Farm →');sign(-6,HOME.z+14,'Evening Farm');sign(-25,-30,'Willow Wood');
 // Footpath forms an unbroken, vehicle-free route from the starting meadow to home.
 for(const path of PATHS)surfaces.push({...path,c:0xcaba91});
 for(const p of PARCELS){
  const colors={pasture:0x9dbc74,forest:0x789963,pond:0x7ea685,crops:0xb9b475,flowers:0xc0bc77,farm:0xa6ad75,town:0xc6bb9c,residential:0xabb986,home:0xb4bc85,animals:0x9fb77a};
  
  if(p.use==='pasture')fence(p.x,p.z,p.w,p.d);
  if(p.use==='forest'){for(let i=0;i<Math.min(90,Math.floor(p.w*p.d/65));i++){const x=p.x+(rand()-.5)*(p.w-4),z=p.z+(rand()-.5)*(p.d-4);if(((x-p.x)/(p.w*.52))**2+((z-p.z)/(p.d*.52))**2<1&&Math.hypot(x-p.x,z-p.z)>4)tree(x,z);}for(let i=0;i<5;i++)actor(p.x+(rand()-.5)*30,p.z+(rand()-.5)*25,'deer');}
  if(p.use==='pond'){
   const rx=p.w*.43,rz=p.d*.42;ball(0xc4c397,p.x,.04,p.z,rx+.9,.04,rz+.9);ball(0x70b5bc,p.x,.09,p.z,rx,.025,rz);
   // Shoreline boxes prevent walking under the decorative water surface.
   for(let x=-rx+1;x<=rx-1;x+=2)for(let z=-rz+1;z<=rz-1;z+=2)if(x*x/(rx*rx)+z*z/(rz*rz)<.88)collider(p.x+x,p.z+z,1,1,3,'pond');
   for(let i=0;i<7;i++){actor(p.x+(rand()-.5)*12,p.z+(rand()-.5)*8,'duck');}tree(p.x-rx-2,p.z+rz*.7);
  }
  if(p.use==='crops'||p.use==='flowers'){
   fence(p.x,p.z,p.w,p.d);for(let x=-p.w/2+2;x<p.w/2;x+=3.4){if(PATHS.some(r=>inRect(p.x+x,p.z,r,1)))continue;box(0x9a9161,p.x+x,.018,p.z,.5,.02,p.d-4);for(let z=-p.d/2+2;z<p.d/2;z+=3){box(0x8a9e51,p.x+x,.35,p.z+z,.06,.7,.06);ball(p.use==='flowers'?0xf1cf65:0xd5c48c,p.x+x,.8,p.z+z,.21,.32,.21);}}
   for(let i=0;i<4;i++)actor(p.x+(rand()-.5)*22,p.z+(rand()-.5)*25,'rabbit');
  }
  if(p.use==='farm'){house(p.x+8,p.z-12,9,7,0xb78067);fence(p.x,p.z,p.w,p.d);for(let i=0;i<6;i++)actor(p.x-8+(rand()-.5)*8,p.z+(rand()-.5)*14,i%2?'pig':'cow');for(let i=0;i<8;i++)tree(p.x-13+(i%2)*6,p.z-14+Math.floor(i/2)*8,true);actor(p.x+5,p.z,'person');}
  if(p.use==='town'||p.use==='residential'){for(let i=0;i<Math.floor(p.w/12);i++){const x=p.x-p.w/2+7+i*12;house(x,p.z,7,6,[0xe4c59b,0xc6d0b9,0xd7b19c,0xead9b9][i%4]);box(0xcaba91,x,.02,p.z+6,3,.02,6);tree(x+4,p.z+7,true);actor(x,p.z+6,'person');}for(let i=0;i<4;i++)actor(p.x+(rand()-.5)*40,p.z+9,'person');}
  if(p.use==='home'){house(HOME.x,HOME.z,12,8,0xd9b58b,true);fence(p.x,p.z,p.w,p.d);actor(HOME.x-10,HOME.z+11,'person');tree(HOME.x-16,HOME.z-1,true);tree(HOME.x+16,HOME.z-1,true);}
  if(p.use==='animals'){fence(p.x,p.z,p.w,p.d);for(let i=0;i<9;i++)actor(p.x+(rand()-.5)*30,p.z+(rand()-.5)*25,'cow');}
 }
 // Hedges and wildflowers follow verges and parcel edges, never the main footpath.
 for(let i=0;i<1100;i++){const x=BOUNDS.minX+rand()*(BOUNDS.maxX-BOUNDS.minX),z=BOUNDS.maxZ-rand()*(BOUNDS.maxZ-BOUNDS.minZ);if(reserved(x,z,2)||PARCELS.some(p=>['pond','town','home','residential','crops','flowers'].includes(p.use)&&inRect(x,z,p)))continue;if(i%4===0)ball(0x72934f,x,.5,z,.8,.65,.8);else ball(i%2?0xf7e5a2:0xe8c4bb,x,.15,z,.15,.18,.15);}
 // Tessellate at every land-use, road and path boundary so surfaces never overlap.
 const rects=[...PARCELS,...ROADS,...PATHS,...surfaces];
 const xs=[BOUNDS.minX-100,BOUNDS.maxX+100],zs=[BOUNDS.minZ-100,BOUNDS.maxZ+100];
 for(const r of rects){xs.push(r.x-r.w/2,r.x+r.w/2);zs.push(r.z-r.d/2,r.z+r.d/2);}
 const sorted=a=>{const edges=[...new Set(a)].sort((a,b)=>a-b),result=[];for(let i=0;i<edges.length-1;i++){const count=Math.ceil((edges[i+1]-edges[i])/3);for(let j=0;j<count;j++)result.push(edges[i]+(edges[i+1]-edges[i])*j/count);}result.push(edges.at(-1));return result;};
 const xx=sorted(xs),zz=sorted(zs),vertices=[],colors=[],normals=[];
 const samples=xx.map(x=>zz.map(z=>({height:terrainHeight(x,z),normal:terrainNormal(x,z)})));
 for(let i=0;i<xx.length-1;i++)for(let j=0;j<zz.length-1;j++){
  const x=(xx[i]+xx[i+1])/2,z=(zz[j]+zz[j+1])/2;
  let color=surfaceAt(x,z);if(!ROADS.some(r=>inRect(x,z,r))){const detail=surfaces.find(r=>inRect(x,z,r));if(detail)color=detail.c;}
  const c=new THREE.Color(color);
  for(const [ix,iz] of [[i,j],[i,j+1],[i+1,j],[i+1,j],[i,j+1],[i+1,j+1]]){const sample=samples[ix][iz];vertices.push(xx[ix],sample.height,zz[iz]);normals.push(...sample.normal);colors.push(c.r,c.g,c.b);}
 }
 const terrainGeo=new THREE.BufferGeometry();terrainGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));terrainGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainGeo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));const terrain=new THREE.Mesh(terrainGeo,new THREE.MeshLambertMaterial({vertexColors:true}));terrain.name='rolling-terrain';terrain.receiveShadow=true;scene.add(terrain);
 for(const batch of batches.values()){const m=new THREE.InstancedMesh(batch.geo,batch.mat,batch.items.length);batch.items.forEach((v,i)=>{dummy.position.set(v.x,v.y,v.z);dummy.rotation.set(0,0,v.rz);dummy.scale.set(v.sx,v.sy,v.sz);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.castShadow=true;m.receiveShadow=true;scene.add(m);}
 for(const road of ROADS.filter(r=>r.d>r.w))for(const direction of [-1,1])for(let i=0;i<2;i++){const g=new THREE.Group();scene.add(g);const part=(c,x,y,z,w,h,d)=>{const m=new THREE.Mesh(cube,material(c));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;g.add(m);};part(i?0xb75f53:0x698ea3,0,.55,0,1.5,.6,2.8);part(0xb7d3cf,0,1.05,-.1,1.3,.6,1.5);for(const x of [-.78,.78])for(const z of [-.85,.85])part(0x4a4b46,x,.3,z,.18,.5,.55);const body={position:g.position,radius:1.75,hx:.85,hz:1.5,height:1.4,kind:'car',active:true};colliders.bodies.push(body);cars.push({g,direction,road,body,previous:null,start:i*105+(direction===1?0:50)});}
 for(let i=0;i<40;i++){const g=new THREE.Group();for(let j=0;j<3;j++){const m=new THREE.Mesh(sphere,new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.86}));m.position.set(j*2,Math.sin(j)*.6,0);m.scale.set(3,1.2,2);g.add(m);}g.position.set(BOUNDS.minX+rand()*525,22+rand()*13,BOUNDS.minZ+rand()*535);scene.add(g);clouds.push(g);}
 const swimColliders=colliders.filter(c=>c.kind!=='pond');swimColliders.groundHeight=terrainHeight;swimColliders.bodies=colliders.bodies;
 // Spawn on clear ground after all trees, fences and buildings have been generated.
 for(const a of actors){if(a.type!=='duck'&&blockingAt(a.x,a.z,terrainHeight(a.x,a.z),a.body.radius,colliders,a.g.position)){
  for(let i=0;i<120;i++){const angle=i*2.399,r=1+Math.sqrt(i)*.5,x=a.x+Math.cos(angle)*r,z=a.z+Math.sin(angle)*r;if(!blockingAt(x,z,terrainHeight(x,z),a.body.radius,colliders,a.g.position)){a.g.position.set(x,terrainHeight(x,z),z);a.home={x,z};break;}}
 }a.start=a.g.position.clone();}
 function resetActors(){for(const a of actors){a.g.position.copy(a.start);a.g.rotation.set(0,0,0);a.state='rest';a.nextUpdate=0;a.lastUpdate=0;}}
 const rainGeo=new THREE.BufferGeometry(),drops=new Float32Array(600*3);for(let i=0;i<drops.length;i++)drops[i]=(rand()-.5)*50;rainGeo.setAttribute('position',new THREE.BufferAttribute(drops,3));const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xb4d1dd,size:.09,transparent:true,opacity:.6}));scene.add(rain);
 const beacon=new THREE.Mesh(new THREE.ConeGeometry(.7,1.5,5),material(0xf9dd82));scene.add(beacon);beacon.rotation.z=Math.PI;
 function updateTraffic(time){
  for(const c of cars){const previous=c.g.position.clone();c.g.position.set(c.road.x+c.direction*1.6,0,c.road.z+c.road.d/2-((time*7*c.direction+c.start+100000)%c.road.d));c.g.position.y=terrainHeight(c.g.position.x,c.g.position.z)+.04;const normal=terrainNormal(c.g.position.x,c.g.position.z);c.g.up.set(...normal);c.g.lookAt(c.g.position.x,terrainHeight(c.g.position.x,c.g.position.z-c.direction)+.04,c.g.position.z-c.direction);c.previous=previous.distanceTo(c.g.position)>2?c.g.position.clone():previous;}
 }
 updateTraffic(0);
 function update(dt,time,player,won){
  swimColliders.bodyBuckets=colliders.bodyBuckets;
  for(const a of actors){
   const far=Math.hypot(a.g.position.x-player.x,a.g.position.z-player.z)>95;a.g.visible=!far;if(far&&time<(a.nextUpdate||0))continue;const elapsed=a.lastUpdate===undefined?dt:Math.max(dt,time-a.lastUpdate);a.lastUpdate=time;a.nextUpdate=far?time+.25:time;
   const dtMove=Math.min(elapsed,.25),intent=animalIntent(a.type,time,a.phase,a.home,a.g.position,player);a.state=intent.state;
   const radius=a.body.radius,world=a.type==='duck'?swimColliders:colliders;
   let vx=intent.x,vz=intent.z;
   const nextX=a.g.position.x+vx*.5,nextZ=a.g.position.z+vz*.5;
   if(blockingAt(nextX,nextZ,a.g.position.y,radius,world,a.g.position)){const turn=(Math.sin(a.phase)>0?1:-1)*Math.PI/2;const c=Math.cos(turn),sn=Math.sin(turn),x=vx;vx=x*c-vz*sn;vz=x*sn+vz*c;}
   const previous=a.g.position.clone();moveBody(a.g.position,vx*dtMove,vz*dtMove,radius,world);
   if(a.type==='duck'){const pond=PARCELS.find(p=>p.use==='pond'&&inRect(a.home.x,a.home.z,p));if(pond&&((a.g.position.x-pond.x)/(pond.w*.34))**2+((a.g.position.z-pond.z)/(pond.d*.32))**2>1)a.g.position.copy(previous);}
   const moved=a.g.position.distanceTo(previous)>1e-4;
   a.g.position.y=terrainHeight(a.g.position.x,a.g.position.z)+(a.type==='duck'?.17:a.type==='rabbit'&&moved?Math.max(0,Math.sin(time*13+a.phase))*.22:0);
   if(moved)a.g.rotation.y=Math.atan2(vx,vz);
   a.g.rotation.x=intent.state==='graze'||intent.state==='root'?Math.sin(time*2+a.phase)*.08:0;
   a.g.visible=Math.hypot(a.g.position.x-player.x,a.g.position.z-player.z)<95;
  }
  const weather=weatherAt(time),rainy=weather==='Rain';
  clouds.forEach((g,i)=>{g.position.x+=dt*(.35+i%3*.08);if(g.position.x>BOUNDS.maxX)g.position.x=BOUNDS.minX;g.children.forEach(m=>{m.material.color.lerp(new THREE.Color(rainy?0x929fa6:0xffffff),1-Math.exp(-dt*.5));});});
  rain.visible=rainy;rain.position.set(player.x,player.y+12,player.z);if(rainy){for(let i=1;i<drops.length;i+=3){drops[i]-=dt*22;if(drops[i]<-12)drops[i]=18;}rainGeo.attributes.position.needsUpdate=true;}
  beacon.visible=!won;beacon.position.set(HOME.x,terrainHeight(HOME.x,HOME.doorZ)+6+Math.sin(time*2)*.3,HOME.doorZ);
  return weather;
 }
 return {update,updateTraffic,cars,resetActors,actors,buildings,fenceSegments,parcels:PARCELS,roads:ROADS,home:HOME,stats:{people:actors.filter(a=>a.type==='person').length,animals:actors.filter(a=>a.type!=='person').length,cars:cars.length,clouds:clouds.length}};
}
