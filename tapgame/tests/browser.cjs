// Install Playwright outside public/, or pass PLAYWRIGHT_MODULE to an existing installation.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(process.env.GAME_URL||'http://localhost/web-experiments/tapgame/');
  await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
  await page.click('#start');assert.equal(await page.locator('#overlay').isVisible(),false);
  await page.keyboard.press('p');assert.equal(await page.locator('#overlay').isVisible(),true);
  await page.click('#start');assert.equal(await page.locator('#overlay').isVisible(),false);
  assert.equal(await page.locator('.job').count(),4);
  await page.click('#view');assert.equal(await page.locator('#view').textContent(),'Follow Tappy');await page.click('#view');
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);
   const layout=await page.evaluate(()=>{const stage=document.getElementById('stage').getBoundingClientRect();return ['game','thumbstick','wash'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=stage.left&&r.right<=stage.right&&r.top>=stage.top&&r.bottom<=stage.bottom&&r.bottom<=innerHeight})});
   assert.ok(layout,`Game and controls fit ${viewport.width}×${viewport.height}`);
  }
  assert.deepEqual(errors,[]);console.log('PASS browser: WebGL scene loads, start, pause/resume, four jobs, camera toggle, phone portrait/landscape, no console errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
