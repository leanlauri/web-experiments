const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const serveSource = async (route) => {
  const name =
    new URL(route.request().url()).pathname.split("/rratedsheepgame/")[1] ||
    "index.html";
  const file = path.resolve(__dirname, "../public", name);
  if (!file.startsWith(path.resolve(__dirname, "../public") + "/"))
    return route.abort();
  const body = await fs.readFile(file);
  await route.fulfill({
    body,
    contentType:
      name.endsWith(".js") || name.endsWith(".mjs")
        ? "application/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : "text/html",
  });
};
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(
      "http://localhost/web-experiments/rratedsheepgame/**",
      serveSource,
    );
    await page.goto("http://localhost/web-experiments/rratedsheepgame/");
    await page.waitForFunction(() => window.sheepGame);
    assert.equal(
      (await page.evaluate(() => sheepGame.getState())).sheep.length,
      12,
    );
    await page.keyboard.down("Space");
    await page.waitForTimeout(100);
    assert((await page.evaluate(() => sheepGame.getState())).player[1] > 0);
    await page.keyboard.up("Space");
    const before = await page.evaluate(() => sheepGame.getState().player);
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1000);
    await page.keyboard.up("KeyW");
    const after = await page.evaluate(() => sheepGame.getState().player);
    assert(Math.hypot(after[0] - before[0], after[2] - before[2]) > 2);
    await page.click("#map-button");
    await page.waitForTimeout(150);
    assert(await page.locator("#atlas").isVisible());
    await page.screenshot({ path: "/tmp/rratedsheepgame-map.png" });
    await page.click("#atlas-close");
    await page.screenshot({ path: "/tmp/rratedsheepgame-desktop.png" });
    await page.evaluate(() =>
      localStorage.setItem(
        "little-pastures-moon-v1",
        JSON.stringify({
          version: 1,
          phase: "heist",
          money: 500,
          delivered: 56,
          heists: 4,
          parts: 0,
          revives: 3,
          maxHp: 3,
          owned: [0],
        }),
      ),
    );
    await page.reload();
    await page.waitForFunction(() => window.sheepGame);
    await page.keyboard.press("KeyB");
    await page.waitForTimeout(200);
    assert(await page.locator("#shop").isVisible());
    for (let i = 0; i < 5; i++)
      await page
        .getByRole("button", { name: "Install part", exact: true })
        .click();
    await page.screenshot({ path: "/tmp/rratedsheepgame-shop.png" });
    await page.click("#launch");
    await page.waitForFunction(
      () => sheepGame.getState().phase === "credits",
      null,
      { timeout: 30000 },
    );
    await page.screenshot({ path: "/tmp/rratedsheepgame-moon.png" });
    await page.click("#play-again");
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    mobile.on("pageerror", (e) => errors.push(e.message));
    await mobile.route(
      "http://localhost/web-experiments/rratedsheepgame/**",
      serveSource,
    );
    await mobile.goto("http://localhost/web-experiments/rratedsheepgame/");
    await mobile.waitForFunction(() => window.sheepGame);
    assert(await mobile.locator("#touch").isVisible());
    const mobileBefore = await mobile.evaluate(
      () => sheepGame.getState().player,
    );
    const stickBox = await mobile.locator("#thumbstick").boundingBox();
    await mobile.mouse.move(stickBox.x + 90, stickBox.y + 30);
    await mobile.mouse.down();
    await mobile.waitForTimeout(600);
    await mobile.mouse.up();
    const mobileAfter = await mobile.evaluate(
      () => sheepGame.getState().player,
    );
    assert(
      Math.hypot(
        mobileAfter[0] - mobileBefore[0],
        mobileAfter[2] - mobileBefore[2],
      ) > 1,
    );
    await mobile.screenshot({ path: "/tmp/rratedsheepgame-mobile.png" });
    await mobile.close();
    const stats = await page.evaluate(() => sheepGame.getState().stats);
    assert(stats.chunks <= 49);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: browser rendering, movement, jump, map, saved progress, shop purchases, launch, credits, restart, mobile layout; no console errors.",
      stats,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
