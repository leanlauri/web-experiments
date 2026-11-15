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
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("http://localhost/__vehicle-damage-test", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="module">
 import {Game} from '/web-experiments/rratedsheepgame/simulation.js';import {createWorld} from '/web-experiments/rratedsheepgame/world.js';import {initVehicleHealth} from '/web-experiments/rratedsheepgame/vehicle-damage.js';
 const g=new Game(),w=createWorld(document.querySelector('canvas'));g.phase='heist';g.police=[];g.updateOpponents=()=>{};Object.assign(g.player,{x:180,z:0});
 g.vehicles=[0,1].map((id)=>initVehicleHealth({id,x:180+id*5,z:0,heading:0,kind:'car',stolen:true,vx:0,vz:0,disabled:0}));g.vehicle=0;
 g.animals=[{id:0,type:'sheep',farm:0,x:180,z:0,origin:{x:330,z:80},following:true,boarded:0,down:false,hp:3}];g.guards=[{id:'g0-0',x:185,z:2,hp:3,armor:3,down:0,heading:0}];
 const snapshot=()=>({health:g.vehicles[0].health,maxHealth:g.vehicles[0].maxHealth,hearts:g.player.hp,aboard:g.vehicle,animalDown:g.animals[0].down,fire:g.vehicles[0].burnStarted,destroyed:!!g.vehicles[0].destroyed,stats:w.stats(),playerFlying:!!g.player.ragdoll});
 window.fixture={
 bullet(){g.shots.push({x:177,z:0,vx:36,vz:0,life:1,power:1,owner:'enemy'});for(let i=0;i<10;i++)g.updateShots(1/60);w.render(g);return snapshot();},
 ignite(){g.damageCar(g.vehicles[0],999);w.render(g);return snapshot();},
 step(n){for(let i=0;i<n;i++)g.update(1/60);w.render(g);return snapshot();},
 crash(){g.animals=[];g.guards=[];g.police=[];g.player.ragdoll=null;g.player.y=0;g.player.stun=0;g.player.hp=3;g.vehicle=0;g.vehicles=[0,1].map(id=>initVehicleHealth({id,x:180+id*2.9,z:id*.8,heading:0,kind:'car',stolen:true,vx:id?0:20,vz:0,disabled:0}));g.player.x=180;g.player.z=0;for(let i=0;i<15;i++)g.update(1/60);w.render(g);return {a:g.vehicles[0],b:g.vehicles[1]};}
 };w.render(g);
 </script>`,
      }),
    );
    await page.goto("http://localhost/__vehicle-damage-test");
    await page.waitForFunction(() => window.fixture);
    let state = await page.evaluate(() => fixture.bullet());
    assert(state.health < state.maxHealth);
    assert.equal(state.hearts, 5);
    assert(!state.animalDown);
    await page.evaluate(() => fixture.ignite());
    state = await page.evaluate(() => fixture.step(294));
    assert(!state.destroyed);
    assert.equal(state.stats.burningVehicles, 1);
    await page.screenshot({ path: "/tmp/rratedsheepgame-vehicle-fire.png" });
    state = await page.evaluate(() => fixture.step(18));
    assert(state.destroyed);
    assert.equal(state.aboard, null);
    assert.equal(state.hearts, 3);
    assert(state.playerFlying);
    assert(state.stats.airborneVehicles >= 2);
    assert.equal(state.stats.blastEffects, 1);
    assert.equal(state.stats.burningVehicles, 0);
    await page.screenshot({
      path: "/tmp/rratedsheepgame-vehicle-explosion.png",
    });
    state = await page.evaluate(() => fixture.step(180));
    assert.equal(state.stats.blastEffects, 0);
    const crash = await page.evaluate(() => fixture.crash());
    assert(crash.b.x > 183.2, "struck vehicle keeps moving after impact");
    assert(
      Math.abs(crash.a.heading) + Math.abs(crash.b.heading) > 0.05,
      "off-centre hit visibly spins cars",
    );
    assert(crash.a.health < crash.a.maxHealth);
    await page.screenshot({ path: "/tmp/rratedsheepgame-car-collision.png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real WebGL car armor, five-second flames/smoke, explosion/shockwave/debris, ejected player, airborne vehicles and FX cleanup.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
