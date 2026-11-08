const {chromium}=require('/home/lauri/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/game.js',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(__dirname+'/../public/game.js','utf8')+'\nrenderer.setAnimationLoop(null);window.testWorld={player,flock,update,reset,countryside,colliders,terrainHeight};'}));
 await page.goto('http://localhost/web-experiments/rratedsheepgame/');await page.waitForFunction(()=>window.testWorld);
 const results=await page.evaluate(()=>{
  const t=testWorld,results=[];
  function trial(name,start,goal,frames,wobble=false){t.reset();t.flock.forEach((q,i)=>{q.g.position.set(240+i*2,t.terrainHeight(240+i*2,30),30);q.body.active=false;});const s=t.flock[0];s.body.active=true;s.following=true;s.g.position.set(start.x,t.terrainHeight(start.x,start.z),start.z);t.player.position.set(goal.x,t.terrainHeight(goal.x,goal.z),goal.z);let reversals=0,turns=0,previous=null,previousTurn=0,walked=0;const blocker={position:{x:start.x,y:t.terrainHeight(start.x,(start.z+goal.z)/2),z:(start.z+goal.z)/2},radius:.85,height:1.5,active:true};if(wobble)t.colliders.bodies.push(blocker);
   for(let i=0;i<frames;i++){if(wobble)blocker.position.x=start.x+Math.sin(i*.7)*.03;const old=s.g.position.clone();t.update(1/60);const dx=s.g.position.x-old.x,dz=s.g.position.z-old.z,length=Math.hypot(dx,dz);walked+=length;if(length>.003){if(previous){const dot=(dx*previous.x+dz*previous.z)/(length*previous.length);if(dot<-.25)reversals++;const cross=dx*previous.z-dz*previous.x;if(Math.abs(cross)>length*previous.length*.05){const sign=Math.sign(cross);if(previousTurn&&sign!==previousTurn)turns++;previousTurn=sign;}}previous={x:dx,z:dz,length};}}
   if(wobble)blocker.active=false;results.push({name,reversals,turns,walked,remaining:Math.hypot(s.g.position.x-goal.x,s.g.position.z-goal.z)});
  }
  trial('meadow fence and gate',{x:-9,z:-20},{x:-9,z:-27},900);
  const trees=t.colliders.filter(c=>c.kind==='tree');const tree=trees.find(c=>c.x<-35&&c.z<-40&&c.z>-90);
  trial('tree trunk',{x:tree.x,z:tree.z+4},{x:tree.x,z:tree.z-4},900);
  trial('slightly moving animal',{x:-5,z:9},{x:-5,z:1},900,true);
  trial('settled flock arrival',{x:5,z:8},{x:5,z:5},600);
  return results;
 });
 for(const r of results){assert(r.reversals<=3,JSON.stringify(r));assert(r.turns<=12,'no rapid left/right oscillation: '+JSON.stringify(r));assert(r.remaining<3.4,'sheep makes progress past obstacle: '+JSON.stringify(r));}assert.deepEqual(errors,[]);console.log('PASS: stable gate, tree and arrival movement',JSON.stringify(results));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
