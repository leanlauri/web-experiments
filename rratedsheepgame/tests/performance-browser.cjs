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
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost/web-experiments/rratedsheepgame/");
    await page.waitForFunction(() => window.sheepGame);
    assert.equal(
      (await page.evaluate(() => sheepGame.getState())).stats.quality.targetFps,
      30,
    );
    await page
      .locator("#pause-button:visible, #menu-button:visible")
      .first()
      .click();
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => sheepGame.getState());
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => sheepGame.getState());
    assert.equal(after.time, before.time);
    assert.equal(
      after.scheduling.renders,
      before.scheduling.renders,
      "paused world is not redrawn",
    );
    assert(after.scheduling.maxCatchUp <= 4);
    await page.locator("#quality-button").click();
    assert.equal(
      (await page.evaluate(() => sheepGame.getState())).stats.quality.mode,
      "low",
    );
    await page.locator("#quality-button").click();
    assert.equal(
      (await page.evaluate(() => sheepGame.getState())).stats.quality.mode,
      "high",
    );
    await page.reload();
    await page.waitForFunction(() => window.sheepGame);
    assert.equal(
      (await page.evaluate(() => sheepGame.getState())).stats.quality.mode,
      "high",
    );
    // Test traversal, cache eviction and shared resource reuse via an unpublished fixture.
    await page.route("http://localhost/__performance-test", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="module">import {Game} from '/web-experiments/rratedsheepgame/simulation.js';import {createWorld} from '/web-experiments/rratedsheepgame/world.js';import {FARMS} from '/web-experiments/rratedsheepgame/region.js';const g=new Game(),w=createWorld(document.querySelector('canvas'));w.setQuality('low');window.runTour=()=>{for(let j=0;j<4;j++)for(const f of FARMS){Object.assign(g.player,f);g.time+=1;w.render(g);}Object.assign(g.player,{x:0,z:0});w.render(g);return w.stats();};</script>`,
      }),
    );
    await page.goto("http://localhost/__performance-test");
    await page.waitForFunction(() => window.runTour);
    const tour = await page.evaluate(() => runTour());
    assert(tour.actors < 100, "inactive model cache stays bounded");
    assert.equal(tour.chunks, 25);
    assert(tour.drawCalls < 160, "town scenery is batched");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: mobile auto quality, saved controller-accessible quality setting, paused render suspension, bounded scheduling, model eviction/recreation, tree budget and batched town.",
      tour,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
