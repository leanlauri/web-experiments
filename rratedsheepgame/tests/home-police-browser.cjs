const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("http://localhost/__home-police-test", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="module">
   import {Game} from '/web-experiments/rratedsheepgame/simulation.js';
   import {createWorld} from '/web-experiments/rratedsheepgame/world.js';
   import {HOME,HOUSE} from '/web-experiments/rratedsheepgame/region.js';
   import {initVehicleHealth} from '/web-experiments/rratedsheepgame/vehicle-damage.js';
   const g=new Game(),w=createWorld(document.querySelector('canvas'));
   const render=()=>{for(let i=0;i<90;i++)w.render(g);return w.stats();};
   const reset=()=>{g.reset();g.phase='heist';g.animals=[];g.guards=[];g.police=[];g.vehicles=[];g.updateOpponents=()=>{};Object.assign(g.player,{x:HOME.x,z:HOME.z+6});w.render(g);};
   reset();window.fixture={
    rocket(parts){g.parts=parts;return render();},
    launch(){g.parts=5;g.launch();for(let i=0;i<180;i++)g.update(1/60);return render();},
    wreck(){reset();g.vehicles=[initVehicleHealth({id:0,x:HOME.x,z:HOME.z+2,kind:'van',heading:.2,stolen:true,disabled:1,destroyed:true,explodedAt:-10})];return render();},
    boardWreck(){g.interact();return g.vehicle;},
    house(){reset();Object.assign(g.player,{x:HOUSE.x,z:HOUSE.z+7});for(let i=0;i<45;i++)g.update(1/60,{z:-1});return {shop:g.shop,inside:g.houseInside,stats:render()};},
    roll(){reset();Object.assign(g.player,{x:180,z:0});g.vehicles=[initVehicleHealth({id:0,x:180,z:0,kind:'car',heading:0,stolen:true,disabled:0,vx:15,vz:0})];g.vehicle=0;g.interact();for(let i=0;i<22;i++)g.update(1/60);return {roll:!!g.player.exitRoll,hp:g.player.hp,stars:g.player.starsUntil,stats:render()};},
    patrol(){reset();g.updateOpponents=Game.prototype.updateOpponents;Object.assign(g.player,{x:65,z:15});g.hurt=()=>{};g.wanted=2;g.updateOpponents(1/60);const car=g.vehicles.find(v=>v.policeDriving);Object.assign(car,{x:0,z:0,heading:Math.PI/2});g.vehicles=[car];Object.assign(g.player,{x:-6,z:4});w.zoom(-.3);return {riding:g.police.filter(p=>p.inVehicle!==undefined).length,stats:render()};}
   };render();
   </script>`,
      }),
    );
    await page.goto("http://localhost/__home-police-test");
    await page.waitForFunction(() => window.fixture);
    for (const parts of [0, 2, 5]) {
      const s = await page.evaluate((n) => fixture.rocket(n), parts);
      assert.equal(s.rocket.built, parts);
      assert.equal(s.rocket.blueprints, 5 - parts);
      assert.equal(s.rocket.padY, 0);
      if (parts === 2)
        await page.screenshot({
          path: "/tmp/rratedsheepgame-rocket-construction.png",
        });
    }
    let s = await page.evaluate(() => fixture.launch());
    assert.equal(s.rocket.padY, 0, "pad stays on ground during launch");
    assert.equal(s.rocket.blueprints, 0);
    s = await page.evaluate(() => fixture.wreck());
    assert.equal(s.wrecks, 1);
    assert.equal(
      s.wreckIntactPieces,
      0,
      "all original wheels, bodywork and glass are hidden",
    );
    assert.equal(await page.evaluate(() => fixture.boardWreck()), null);
    await page.screenshot({ path: "/tmp/rratedsheepgame-black-wreck.png" });
    s = await page.evaluate(() => fixture.house());
    assert(s.shop && s.inside && s.stats.houseOpen);
    await page.screenshot({ path: "/tmp/rratedsheepgame-house-workshop.png" });
    s = await page.evaluate(() => fixture.roll());
    assert(s.roll);
    assert.equal(s.hp, 3);
    assert.equal(s.stars, 0);
    assert.equal(s.stats.playerStars, false);
    await page.screenshot({ path: "/tmp/rratedsheepgame-exit-roll.png" });
    s = await page.evaluate(() => fixture.patrol());
    assert.equal(s.riding, 2);
    assert.equal(s.stats.policeCars, 1);
    await page.screenshot({ path: "/tmp/rratedsheepgame-patrol-car.png" });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("http://localhost/web-experiments/rratedsheepgame/");
      await page.waitForFunction(() => window.sheepGame);
      assert(
        !(await page.locator("#mission").isVisible()),
        "mission card removed at every screen size",
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: mobile WebGL construction stages and stationary pad, black wreck with no intact pieces, undrivable wreck, house cutaway/shop, painless roll without stars, marked police car and hidden mission card.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
