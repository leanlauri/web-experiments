const {chromium}=require('/home/lauri/node_modules/playwright-core');
const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/game.js',async route=>{const source=fs.readFileSync(__dirname+'/../public/game.js','utf8');await route.fulfill({contentType:'application/javascript',body:source+'\nrenderer.setAnimationLoop(null);window.testWorld={player,flock,update,reset,renderer,scene,camera,countryside,terrainHeight};'});});
await page.goto('http://localhost/web-experiments/rratedsheepgame/');await page.waitForFunction(()=>window.testWorld);
const oversizedScenery=await page.evaluate(()=>testWorld.scene.children.filter(m=>m.geometry?.type==='IcosahedronGeometry'&&Math.max(m.scale.x,m.scale.y,m.scale.z)>10).length);assert.equal(oversizedScenery,0,'no giant decorative hill spheres in the playable countryside');
const solidAnimals=await page.evaluate(()=>testWorld.countryside.actors.every(a=>a.body&&a.body.position===a.g.position&&a.body.radius>0));assert(solidAnimals,'all countryside actors have live collision bodies');
const state=await page.evaluate(()=>sheepGame.getState());assert(state.world.people>=12);assert(state.world.animals>=20);assert(state.world.cars>=4);assert(state.world.clouds>=15);assert(state.parcels.length>=10);
const fenceTrial=await page.evaluate(()=>{const {player,flock,update,terrainHeight}=testWorld;flock.forEach((s,i)=>s.g.position.set(100+i*2,terrainHeight(100+i*2,8),8));const s=flock[0];s.g.position.set(-9,terrainHeight(-9,-20),-20);s.following=true;player.position.set(-9,terrainHeight(-9,-27),-27);let highest=0;for(let i=0;i<900;i++){update(1/60);highest=Math.max(highest,s.g.position.y-terrainHeight(s.g.position.x,s.g.position.z));}return {position:s.g.position.toArray(),highest};});
assert(fenceTrial.position[2]<-23,'sheep reaches the other side using a gate');assert(fenceTrial.highest<.1,'sheep never jumps the fence');await page.evaluate(()=>testWorld.reset());
await page.evaluate(()=>{const {player,flock,update}=testWorld;for(const s of flock){player.position.copy(s.g.position);update(1/60);}player.position.set(0,testWorld.terrainHeight(0,8),8);});
assert.equal((await page.evaluate(()=>sheepGame.getState())).followers,12);
const geometry=await page.evaluate(()=>{const {countryside,scene}=testWorld;return {badFences:countryside.fenceSegments.filter(f=>countryside.roads.some(r=>Math.abs(f.x-r.x)<f.hx+r.w/2&&Math.abs(f.z-r.z)<f.hz+r.d/2)),roofs:countryside.buildings,terrainMeshes:scene.children.filter(m=>m.geometry?.attributes.color).length};});
assert.deepEqual(geometry.badFences,[],'no fence intersects a road');assert.equal(geometry.terrainMeshes,1,'one unified ground surface');assert(geometry.roofs.every(r=>r.eave===r.wallTop&&r.ridge>r.eave),'roofs sit exactly on walls');
// Walk the whole route in small steps: followers use their actual steering, jumps and collision handling.
let journey;
for(let batch=0;batch<8;batch++){
 journey=await page.evaluate(batch=>{const {player,update}=testWorld;for(let j=0;j<1000;j++){const i=batch*1000+j;player.position.x=0;player.position.z=Math.max(-386,8-i*.065);player.position.y=testWorld.terrainHeight(player.position.x,player.position.z);update(1/60);}return sheepGame.getState();},batch);
 if(process.env.SHEEP_TEST_DEBUG)console.log('Journey step',batch*1000+1000,JSON.stringify({sheltered:journey.sheltered,sheep:journey.sheep.filter(s=>!s.sheltered).map(s=>s.position.map(v=>Math.round(v)))}));
}
assert.equal(journey.sheltered,12,'all twelve sheep can follow the full route and enter home');assert(journey.won);assert(await page.locator('#victory').isVisible());
await page.evaluate(()=>{testWorld.reset();testWorld.update(90);});assert((await page.evaluate(()=>sheepGame.getState())).weather.includes('Rain'));
await page.evaluate(()=>{testWorld.reset();testWorld.update(1/60);testWorld.renderer.render(testWorld.scene,testWorld.camera);});assert.equal((await page.evaluate(()=>sheepGame.getState())).sheltered,0);assert(!(await page.locator('#victory').isVisible()));
await page.screenshot({path:'/tmp/sheep-countryside.png'});
await page.evaluate(()=>{const t=testWorld;t.player.position.set(65,0,-92);t.camera.position.set(78,16,-74);t.camera.lookAt(62,.5,-106);t.update(1/60);t.renderer.render(t.scene,t.camera);});await page.screenshot({path:'/tmp/sheep-village.png'});
await page.setViewportSize({width:412,height:850});await page.waitForTimeout(100);await page.evaluate(()=>testWorld.renderer.render(testWorld.scene,testWorld.camera));await page.screenshot({path:'/tmp/sheep-village-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS: structured world, residents, animals, two-way traffic, clouds, full 12-sheep journey, indoor victory, rain cycle, reset, browser errors');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
