const assert=require('node:assert/strict');
(async()=>{
 const {createWorld,tick,move,solid,stations,stickVector}=await import('data:text/javascript;base64,'+require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/world.js')).toString('base64'));
 let w=createWorld();assert.equal(w.jobs.length,4);assert.deepEqual(w.jobs.map(j=>j.kind),['notebook','pencil','pen','headphones']);
 w.phase='playing';move(w,1,0,.1);assert.ok(w.player.x>0);assert.ok(solid(0,1));assert.ok(!solid(2.8,1));
 // Long movement cannot jump through a shelf.
 w.player={x:2,z:1,angle:0};move(w,-1,0,2);assert.ok(w.player.x>=1.38);
 w.player={x:stations[0].x,z:stations[0].z+1.4,angle:0};
 tick(w,.1,{x:0,z:0,spray:false});assert.equal(w.active,0);assert.equal(w.jobs[0].clean,0);
 for(let i=0;i<28;i++)tick(w,.1,{x:0,z:0,spray:true});assert.equal(w.jobs[0].clean,1);assert.equal(w.suspicion,0,'Authorised washing is welcome');
 assert.equal(w.jobs[1].clean,0,'Only the nearby item gets washed');
 w.player={x:0,z:7,angle:0};for(let i=0;i<20;i++)tick(w,.1,{x:0,z:0,spray:true});assert.ok(w.suspicion>30,'Stray spraying causes suspicion');
 const previous=w.suspicion;for(let i=0;i<60;i++)tick(w,.1,{x:0,z:0,spray:false});assert.ok(w.suspicion<previous,'Suspicion cools down');
 w.phase='paused';const frozen=JSON.stringify(w);tick(w,1,{x:1,z:1,spray:true});assert.equal(JSON.stringify(w),frozen,'Pause freezes the world');
 w.phase='playing';for(const job of w.jobs){w.player={x:job.x,z:job.z+1.4,angle:0};for(let i=0;i<28;i++)tick(w,.1,{x:0,z:0,spray:true});assert.equal(job.clean,1,`${job.name} can be washed`)}w.player={x:0,z:9,angle:0};tick(w,.1,{x:0,z:0,spray:false});assert.equal(w.phase,'won');
 w=createWorld();w.phase='playing';w.player={x:0,z:7,angle:0};for(let i=0;i<60;i++)tick(w,.1,{x:0,z:0,spray:true});assert.equal(w.phase,'lost');
 w=createWorld();assert.equal(w.suspicion,0);assert.ok(w.jobs.every(j=>j.clean===0));
 assert.equal(stickVector(1,1,35).x,0);assert.equal(stickVector(300,0,35).x,1);const v=stickVector(300,300,35);assert.ok(Math.abs(Math.hypot(v.x,v.z)-1)<.0001);
 console.log('PASS 3D world: jobs, movement, shelf collisions, washing range/progress, suspicion, pause, win, loss, restart, analog control');
})().catch(e=>{console.error(e);process.exitCode=1});
