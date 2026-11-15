const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 700, height: 720 },
        isMobile: true,
        hasTouch: true,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("http://localhost/__scenery-test", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="module">
   import {Game} from '/web-experiments/rratedsheepgame/simulation.js';
   import {createWorld} from '/web-experiments/rratedsheepgame/world.js';
   import {treesInChunk,blocked,HOME} from '/web-experiments/rratedsheepgame/region.js';
   import {vehicleBlocked} from '/web-experiments/rratedsheepgame/vehicle-collisions.js';
   import {initVehicleHealth} from '/web-experiments/rratedsheepgame/vehicle-damage.js';
   const trees=[];for(let x=1;x<=4;x++)for(let z=-2;z<=2;z++)trees.push(...treesInChunk(x,z));
   const tree=trees.find(t=>trees.every(o=>o===t||Math.hypot(t.x-o.x,t.z-o.z)>8)&&!vehicleBlocked({kind:'car',heading:0,x:t.x-6,z:t.z}));
   const g=new Game(),w=createWorld(document.querySelector('canvas'));g.phase='heist';g.animals=[];g.guards=[];g.police=[];g.updateOpponents=()=>{};
   const car=initVehicleHealth({id:0,x:tree.x-6,z:tree.z,heading:0,kind:'car',stolen:true,disabled:0,vx:18,vz:0});g.vehicles=[car];g.vehicle=0;Object.assign(g.player,{x:car.x,z:car.z});
   const render=()=>{for(let i=0;i<35;i++)w.render(g);return {tree,car:{x:car.x,z:car.z,health:car.health,maxHealth:car.maxHealth},blocked:blocked(tree,.5),stats:w.stats()};};
   window.fixture={snapshot:render,crash(){for(let i=0;i<90;i++)g.update(1/60,{x:1});return render();},away(){g.vehicle=null;Object.assign(g.player,{x:-400,z:-400});return render();},back(){Object.assign(g.player,{x:tree.x-4,z:tree.z+4});return render();},home(){g.vehicles=[];g.vehicle=null;g.parts=3;Object.assign(g.player,{x:HOME.x,z:HOME.z+6});return render();}};render();
   </script>`,
      }),
    );
    await page.goto("http://localhost/__scenery-test");
    await page.waitForFunction(() => window.fixture);
    let state = await page.evaluate(() => fixture.crash());
    assert(state.car.x < state.tree.x - 1.8);
    assert(state.car.health < state.car.maxHealth);
    assert(state.stats.scenery.trees > 0);
    assert(state.stats.scenery.props > 20);
    assert(state.stats.chunks <= 49);
    await page.screenshot({ path: "/tmp/rratedsheepgame-tree-collision.png" });
    const saved = state.car;
    state = await page.evaluate(() => fixture.away());
    assert(state.blocked, "offscreen tree remains solid");
    assert(state.stats.chunks <= 49);
    state = await page.evaluate(() => fixture.back());
    assert.deepEqual(
      state.car,
      saved,
      "chunk reload cannot move colliders or cars",
    );
    assert(state.blocked);
    state = await page.evaluate(() => fixture.home());
    assert.equal(state.stats.rocket.built, 3);
    assert.equal(state.stats.rocket.padY, 0);
    await page.screenshot({
      path: "/tmp/rratedsheepgame-solid-home-props.png",
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: mobile WebGL tree/hull impact, hull damage, shared visible scenery/props, collision persistence across chunk unload/reload, bounded scenery and home launch equipment.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
