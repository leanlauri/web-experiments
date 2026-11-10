const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const sourceMode = process.argv.includes("--source");
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
    function checkPage(target) {
      target.on("pageerror", (e) => errors.push(e.message));
      target.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      target.on("response", (response) => {
        // A 304 reuses the previously validated cached module and may omit MIME headers.
        if (response.status() === 304) return;
        if (/\.(?:m?js)(?:\?|$)/.test(response.url())) {
          const mime = response.headers()["content-type"] || "";
          if (!response.ok() || !/(?:java|ecma)script/.test(mime))
            errors.push(
              `Module failed: ${response.status()} ${mime} ${response.url()}`,
            );
        }
      });
    }
    checkPage(page);
    if (sourceMode)
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
    const jumpCameraHeight = await page.evaluate(
      () => sheepGame.getState().stats.cameraHeight,
    );
    await page.keyboard.down("Space");
    await page.waitForTimeout(100);
    assert((await page.evaluate(() => sheepGame.getState())).player[1] > 0);
    assert.equal(
      await page.evaluate(() => sheepGame.getState().stats.cameraHeight),
      jumpCameraHeight,
      "camera stays at ground height during a jump",
    );
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
    assert.equal(
      await page
        .locator(".shop-item")
        .filter({ hasText: "Foam bat" })
        .locator(".shop-price")
        .textContent(),
      "$35",
    );
    assert.equal(
      await page
        .locator(".shop-item")
        .filter({ hasText: "Wake-up snack pack" })
        .locator(".shop-price")
        .textContent(),
      "$15",
    );
    assert.equal(
      await page
        .locator(".shop-item")
        .first()
        .locator(".shop-price")
        .textContent(),
      "12 animal credit",
    );
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
    checkPage(mobile);
    if (sourceMode)
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
    // The main play surface must stay clear; full details are available on demand.
    for (const selector of [
      "header",
      "#mission",
      "#navigation",
      "#loadout",
      "#wanted",
      ".touch-actions [data-action=revive]",
    ])
      assert(
        !(await mobile.locator(selector).isVisible()),
        `${selector} should be collapsed on mobile`,
      );
    assert.equal(
      await mobile.locator(".touch-actions button:visible").count(),
      3,
    );
    await mobile.locator("#mobile-map-button").tap();
    assert(await mobile.locator("#atlas").isVisible());
    await mobile.locator("#atlas-close").tap();
    await mobile.locator("#menu-button").tap();
    assert(await mobile.locator("#menu").isVisible());
    assert(
      (await mobile.locator("#menu-description").textContent()).includes(
        "sheep",
      ),
    );
    assert(await mobile.locator("#menu [data-action=revive]").isVisible());
    const pausedAt = await mobile.evaluate(() => sheepGame.getState().player);
    await mobile.keyboard.down("KeyW");
    await mobile.waitForTimeout(250);
    assert.deepEqual(
      await mobile.evaluate(() => sheepGame.getState().player),
      pausedAt,
      "menu pauses gameplay",
    );
    await mobile.keyboard.up("KeyW");
    await mobile.screenshot({ path: "/tmp/rratedsheepgame-mobile-menu.png" });
    await mobile.locator("#menu-help").tap();
    assert(await mobile.locator("#help").isVisible());
    await mobile.locator("#help-close").tap();
    await mobile.locator("#menu-button").tap();
    await mobile.locator("#menu [data-action=cycle]").tap();
    assert(!(await mobile.locator("#menu").isVisible()));
    // Compact HUD also applies in landscape, keeping the player at screen center exposed.
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 390, height: 720 },
    ]) {
      await mobile.setViewportSize(viewport);
      assert(await mobile.locator("#menu-button").isVisible());
      assert(!(await mobile.locator("#mission").isVisible()));
      const center = await mobile.evaluate(
        () => document.elementFromPoint(innerWidth / 2, innerHeight / 2).id,
      );
      assert.equal(
        center,
        "world",
        "player must remain visible in the center of the screen",
      );
    }
    await mobile.screenshot({ path: "/tmp/rratedsheepgame-mobile.png" });
    await mobile.close();
    const stats = await page.evaluate(() => sheepGame.getState().stats);
    assert(stats.chunks <= 49);
    assert.deepEqual(errors, []);
    console.log(
      (sourceMode ? "SOURCE" : "DEPLOYED") +
        " PASS: browser rendering, movement, jump, map, saved progress, shop purchases, launch, credits, restart, mobile layout; no console errors.",
      stats,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
