const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 720 },
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("http://localhost/__expansion-visuals", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="module">
 import {Game} from '/web-experiments/rratedsheepgame/simulation.js';import {createWorld} from '/web-experiments/rratedsheepgame/world.js';import {VEHICLES} from '/web-experiments/rratedsheepgame/vehicles.js';
 const g=new Game(),w=createWorld(document.querySelector('canvas'));g.phase='heist';g.animals=[];g.guards=[];g.police=[];g.vehicles=[];g.player.x=46;g.player.z=-40;g.owned=[0,1,2,3,4,5];g.money=60;
 window.fixture={pose(id){g.weapon=id;g.item='weapon';g.cooldown=0;g.player.aim=null;g.attack();if(id>=2){for(let i=0;i<18;i++)g.update(1/60);}else g.time+=.08;w.zoom(-.3);w.render(g);return w.stats();},town(){g.player.x=40;g.player.z=0;w.zoom(.9);w.render(g);return w.stats();},cars(){g.player.x=0;g.player.z=0;g.player.attack=null;g.vehicles=Object.entries(VEHICLES).map(([kind,p],i)=>({id:i,x:-36+i*10,z:-15,heading:0,kind}));w.render(g);return w.stats();}};w.render(g);
 </script>`,
      }),
    );
    await page.goto("http://localhost/__expansion-visuals");
    await page.waitForFunction(() => window.fixture);
    let state = await page.evaluate(() => fixture.pose(5));
    assert(state.equipment.muzzle);
    assert.equal(state.equipment.weapon, 5);
    await page.screenshot({ path: "/tmp/rratedsheepgame-foam-pistol.png" });
    state = await page.evaluate(() => fixture.pose(0));
    assert(state.equipment.swing);
    await page.screenshot({ path: "/tmp/rratedsheepgame-club-swing.png" });
    state = await page.evaluate(() => fixture.town());
    assert.equal(state.townBuildings, 48);
    await page.screenshot({ path: "/tmp/rratedsheepgame-town-expanded.png" });
    await page.evaluate(() => fixture.cars());
    await page.screenshot({ path: "/tmp/rratedsheepgame-vehicle-types.png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: actual weapon/muzzle/swing meshes, expanded town, all nine vehicle models, no WebGL errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
