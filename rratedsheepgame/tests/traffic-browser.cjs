const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 700, height: 700 },
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("http://localhost/__traffic-test", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas><script type="module">
 import {Game} from '/web-experiments/rratedsheepgame/simulation.js';
 import {createWorld} from '/web-experiments/rratedsheepgame/world.js';
 const game=new Game(),world=createWorld(document.querySelector('canvas'));game.player.x=game.player.z=0;game.phase='heist';game.animals=[];game.guards=[];game.updateOpponents=()=>{};
 window.fixture={advance(){let maxMove=0,maxTurn=0,contacts=0;for(let i=0;i<1800;i++){const before=game.vehicles.map(v=>({...v}));game.update(1/30);contacts+=game.vehicleContacts;for(const v of game.vehicles){if(v.stolen)continue;const old=before[v.id];maxMove=Math.max(maxMove,Math.hypot(v.x-old.x,v.z-old.z));maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(v.heading-old.heading),Math.cos(v.heading-old.heading))));}}world.render(game);return {count:game.vehicles.filter(v=>!v.stolen).length,nearTown:game.vehicles.filter(v=>!v.stolen&&Math.hypot(v.x,v.z)<100).length,maxMove,maxTurn,contacts,stats:world.stats()};}};world.render(game);
 </script>`,
      }),
    );
    await page.goto("http://localhost/__traffic-test");
    await page.waitForFunction(() => window.fixture);
    const state = await page.evaluate(() => fixture.advance());
    assert.equal(state.count, 48);
    assert(state.nearTown > 8);
    assert(state.maxMove < 0.401);
    assert(state.maxTurn < 0.061);
    assert.equal(state.contacts, 0);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: "/tmp/rratedsheepgame-town-traffic.png" });
    console.log(
      "PASS: deployed 48-car traffic, smooth positions/headings in town, collision-free following/merges and WebGL street-grid rendering.",
      state,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
