const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
const p=await import('data:text/javascript;base64,'+fs.readFileSync(__dirname+'/../public/physics.js').toString('base64'));
assert.equal(p.WALK_SPEED,5.18);assert.equal(p.RUN_SPEED,8.399999999999999);
const barn={x:0,z:0,hx:2.5,hz:2.1,h:4.6};const tree={x:10,z:0,hx:.38,hz:.38,h:3};
for(const obstacle of [barn,tree]){const body={x:obstacle.x-5,y:0,z:0};p.moveBody(body,10,0,.32,[obstacle]);assert(body.x<obstacle.x-obstacle.hx,'solid obstacle blocks walking');}
const free={x:22,y:0,z:0};p.moveBody(free,100,0,.32,[]);assert(free.x>120,'no meadow boundary');
for(const c of [{x:0,z:0,hx:1.8,hz:.3,h:.6},{x:0,z:0,hx:2,hz:.06,h:1.11},{x:0,z:0,hx:.085,hz:.085,h:1.4}]){
 for(const axis of ['x','z']){
  const b={x:0,y:0,z:0};b[axis]=-c[axis==='x'?'hx':'hz']-2;
  const v={x:axis==='x'?6.8:0,z:axis==='z'?6.8:0};let vy=0,jumped=false,max=0;
  for(let i=0;i<240;i++){if(!jumped&&p.obstacleAhead(b,v,.48,[c],1.4)){vy=p.JUMP_SPEED;jumped=true;}vy=p.verticalStep(b,vy,1/120,.48,[c]);p.moveBody(b,v.x/120,v.z/120,.48,[c]);max=Math.max(max,b.y);}
  assert(jumped,'detects thin and wide obstacles');assert(b[axis]>c[axis==='x'?'hx':'hz']+.48,'jumping body clears obstacle along '+axis);assert(max>1.4,'jump clears fence posts');
 }
}
const top={x:0,y:2,z:0};let vy=-1;for(let i=0;i<100;i++)vy=p.verticalStep(top,vy,1/120,.32,[{x:0,z:0,hx:2,hz:.06,h:1.11}]);assert.equal(top.y,1.11,'landing on fence is supported');
console.log('PASS: solid barn/trees, open map, 40% speed increase, shepherd crossing logs/fences/posts on both axes, supported landings');
})().catch(e=>{console.error(e);process.exitCode=1});
