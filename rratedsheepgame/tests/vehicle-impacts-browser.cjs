const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 600, height: 720 },
      hasTouch: true,
      isMobile: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    // Intercepted by this test only; no controls or fixture are published with the game.
    await page.route("http://localhost/__vehicle-impact-test", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas id="world"></canvas><script type="module">
   import {Game} from '/web-experiments/rratedsheepgame/simulation.js';
   import {createWorld} from '/web-experiments/rratedsheepgame/world.js';
   import {FARMS} from '/web-experiments/rratedsheepgame/region.js';
   const g=new Game(),world=createWorld(document.querySelector('canvas')),f=FARMS[0],t=.6;
   g.phase='heist';g.police=[];g.updateOpponents=()=>{};
   const v={id:0,x:f.x*t-Math.sin(f.angle)*3,z:f.z*t+Math.cos(f.angle)*3,heading:f.angle,route:0,t,dir:1,speed:24,kind:'car',disabled:0,stolen:false};
   const victim=side=>({x:v.x+Math.cos(f.angle)*3.8-Math.sin(f.angle)*side,z:v.z+Math.sin(f.angle)*3.8+Math.cos(f.angle)*side,y:0,heading:0});
   Object.assign(g.player,victim(0));g.vehicles=[v];
   g.animals=[{...victim(.9),id:0,type:'sheep',farm:0,origin:victim(.9),following:true,down:false,boarded:null,delivered:false}];
   g.guards=[{...victim(-.9),id:'g0-0',farm:0,down:0,hp:1,armor:1,cooldown:10}];
   const snapshot=()=>({hp:g.player.hp,player:!!g.player.ragdoll,animal:!!g.animals[0].ragdoll,guard:!!g.guards[0].ragdoll,height:g.player.y,spin:g.player.ragdoll?.rx||0,starsUntil:g.player.starsUntil,time:g.time,stats:world.stats()});
   window.fixture={step(n){for(let i=0;i<n;i++)g.update(1/60);world.render(g);return snapshot();},snapshot};world.render(g);
  </script>`,
      }),
    );
    await page.goto("http://localhost/__vehicle-impact-test");
    await page.waitForFunction(() => window.fixture);
    let state = await page.evaluate(() => fixture.step(18));
    assert(state.player && state.animal && state.guard);
    assert(state.height > 0.5);
    assert(Math.abs(state.spin) > 0.5);
    assert.equal(state.hp, 4);
    assert.equal(state.stats.recoveringActors, 3);
    await page.screenshot({ path: "/tmp/rratedsheepgame-vehicle-tumbles.png" });
    state = await page.evaluate(() => fixture.step(210));
    assert(!state.player && !state.animal && !state.guard);
    assert(state.starsUntil > state.time);
    assert.equal(state.stats.recoveringActors, 3);
    state = await page.evaluate(() => fixture.step(180));
    assert.equal(state.stats.recoveringActors, 0);
    assert.equal(state.height, 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: WebGL airborne player/animal/guard, spinning bodies, floppy limbs, recovery stars and automatic get-up.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
