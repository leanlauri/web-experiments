const assert=require('node:assert/strict'),fs=require('node:fs');
const source=name=>fs.readFileSync(__dirname+'/../public/'+name,'utf8');
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
(async()=>{
 const landscapeUrl=url(source('landscape.js'));const {terrainHeight,terrainNormal,TERRAIN_PADS}=await import(url(source('terrain.js').replace("'./landscape.js'",JSON.stringify(landscapeUrl))));
 const physics=await import(url(source('physics.js')));const {PARCELS}=await import(landscapeUrl);
 let min=Infinity,max=-Infinity,maxSlope=0;
 for(let x=-250;x<270;x+=3)for(let z=-470;z<65;z+=3){const h=terrainHeight(x,z),n=terrainNormal(x,z);min=Math.min(min,h);max=Math.max(max,h);maxSlope=Math.max(maxSlope,Math.hypot(n[0],n[2])/n[1]);assert(Number.isFinite(h));}
 assert(max-min>7,'visible broad hills');assert(maxSlope<.8,'no cliff-like transitions');
 for(const p of TERRAIN_PADS){assert(Math.abs(terrainHeight(p.x+p.w*.4,p.z+p.d*.4)-terrainHeight(p.x,p.z))<1e-8,'level water and building plots');}
 const colliders=[];colliders.groundHeight=terrainHeight;let body={x:-20,z:0,y:terrainHeight(-20,0)},vy=0;
 for(let i=0;i<1200;i++){physics.moveBody(body,.05,0,.32,colliders);vy=physics.verticalStep(body,vy,1/120,.32,colliders);assert(Math.abs(body.y-terrainHeight(body.x,body.z))<1e-6,'walking follows ground without falling or sinking');}
 vy=physics.JUMP_SPEED;let airborne=false;for(let i=0;i<240;i++){physics.moveBody(body,.025,-.025,.32,colliders);vy=physics.verticalStep(body,vy,1/120,.32,colliders);airborne ||=body.y-terrainHeight(body.x,body.z)>1.5;}
 assert(airborne);assert(Math.abs(body.y-terrainHeight(body.x,body.z))<1e-6,'jump lands on changing terrain');
 console.log(`PASS: ${ (max-min).toFixed(1)} m height range, maximum grade ${maxSlope.toFixed(2)}, level plots/ponds, hill walking and jump landing`);
})().catch(e=>{console.error(e);process.exitCode=1});
