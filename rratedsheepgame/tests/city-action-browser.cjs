const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 760, height: 720 },
        isMobile: true,
        hasTouch: true,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("http://localhost/__city-action", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="module">
   import {Game} from '/web-experiments/rratedsheepgame/simulation.js';import {createWorld} from '/web-experiments/rratedsheepgame/world.js';import {HOME,FARMS,WEAPONS} from '/web-experiments/rratedsheepgame/region.js';import {startAim,stepAim} from '/web-experiments/rratedsheepgame/combat.js';import {initVehicleHealth} from '/web-experiments/rratedsheepgame/vehicle-damage.js';
   const g=new Game(),w=createWorld(document.querySelector('canvas'));let crossed=new Set();
   const reset=()=>{g.reset();g.phase='heist';g.animals=[];g.guards=[];g.police=[];g.civilians=[];g.vehicles=[];g.updateOpponents=()=>{};Object.assign(g.player,{x:0,z:0});w.render(g);};
   const render=()=>{w.render(g);return {aim:!!g.player.aim,stats:w.stats(),time:g.time,money:g.money,delivered:g.delivered,hearts:g.player.hp,civilians:g.civilians.length,tumbles:g.civilians.filter(c=>c.ragdoll).length,queued:g.animals.filter(a=>a.delivering).length,crossed:crossed.size};};
   window.fixture={
    aim(){reset();g.weapon=5;g.owned=[0,5];g.attack();return render();},
    step(n){for(let i=0;i<n;i++){g.update(1/60);for(const guard of g.guards)stepAim(g,guard);for(const a of g.animals)if(a.barnGateCrossed)crossed.add(a.id);}return render();},
    enemy(){reset();g.wanted=2;g.guards=[{id:'test-guard',x:0,z:12,heading:Math.PI*1.5,weapon:5,farm:1,down:0,hp:2,armor:2,cooldown:1}];startAim(g,g.guards[0],{...WEAPONS[5],id:5},g.player,'enemy');return render();},
    theft(){reset();g.vehicles=[initVehicleHealth({id:0,x:0,z:0,kind:'car',heading:0,vx:18,vz:0,seats:4,speed:18,occupied:true,stolen:false,disabled:0})];g.interact();return render();},
    barn(){reset();crossed=new Set();g.vehicles=[initVehicleHealth({id:0,x:0,z:HOME.z+8,kind:'bus',heading:0,vx:0,vz:0,seats:13,stolen:true,disabled:0})];g.vehicle=0;Object.assign(g.player,{x:0,z:HOME.z+8});for(let i=0;i<12;i++){g.addAnimal('cow',0,0,0);Object.assign(g.animals[i],{following:true,boarded:0,origin:{x:FARMS[2].x,z:FARMS[2].z}});}return render();},
    town(){reset();g.player.x=5;g.player.z=0;for(let i=0;i<40;i++)w.render(g);return render();}
   };reset();render();
   </script>`,
      }),
    );
    await page.goto("http://localhost/__city-action");
    await page.waitForFunction(() => window.fixture);
    let s = await page.evaluate(() => fixture.aim());
    assert(s.aim && s.stats.equipment.aiming);
    assert(!s.stats.equipment.muzzle);
    assert(s.stats.equipment.armAngle < -1);
    await page.screenshot({ path: "/tmp/rratedsheepgame-player-aim.png" });
    s = await page.evaluate(() => fixture.step(18));
    assert(s.stats.equipment.muzzle);
    assert(!s.aim);
    await page.screenshot({ path: "/tmp/rratedsheepgame-muzzle-flash.png" });
    s = await page.evaluate(() => fixture.enemy());
    assert.equal(s.stats.aimingActors, 1);
    s = await page.evaluate(() => fixture.step(18));
    assert.equal(s.stats.npcMuzzles, 1);
    await page.screenshot({ path: "/tmp/rratedsheepgame-enemy-shot.png" });
    s = await page.evaluate(() => fixture.theft());
    assert.equal(s.civilians, 1);
    assert.equal(s.tumbles, 1);
    assert(s.stats.recoveringActors >= 1);
    await page.screenshot({ path: "/tmp/rratedsheepgame-theft-driver.png" });
    await page.evaluate(() => fixture.barn());
    s = await page.evaluate(() => fixture.step(240));
    assert(s.queued > 0);
    assert.equal(s.delivered, 0);
    await page.screenshot({ path: "/tmp/rratedsheepgame-barn-unloading.png" });
    s = await page.evaluate(() => fixture.step(1500));
    assert.equal(s.delivered, 12);
    assert.equal(s.crossed, 12);
    assert.equal(s.money, 96);
    assert.equal(s.hearts, 5);
    s = await page.evaluate(() => fixture.town());
    assert.equal(s.stats.townBuildings, 48);
    await page.screenshot({ path: "/tmp/rratedsheepgame-grid-town.png" });
    await page.goto("http://localhost/web-experiments/rratedsheepgame/");
    await page.waitForFunction(() => window.sheepGame);
    await page.keyboard.press("Escape");
    assert(
      (await page.locator("#menu").innerText()).trim().split(/\s+/).length < 55,
      "pause menu uses short labels",
    );
    await page.screenshot({ path: "/tmp/rratedsheepgame-minimal-pause.png" });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    assert(await page.locator("#atlas").isVisible());
    assert(
      (await page.locator("#atlas").innerText()).trim().split(/\s+/).length <
        50,
      "map uses markers and a compact legend",
    );
    await page.screenshot({ path: "/tmp/rratedsheepgame-minimal-map.png" });
    await page.keyboard.press("Escape");
    await page.locator("#menu-help").tap();
    assert.equal(await page.locator("#help .guide-card").count(), 8);
    await page.locator("#help-wanted").tap();
    assert(
      (await page.locator("#guide-content").innerText()).includes("Roadblocks"),
    );
    await page.screenshot({ path: "/tmp/rratedsheepgame-short-guide.png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real mobile WebGL player/enemy aim and muzzle flashes, ejected driver tumble, visible barn unloading/gate crossings before payment, five hearts, grid town and compact console pause/map/guide screens.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
