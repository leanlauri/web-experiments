const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 780 },
      hasTouch: true,
      isMobile: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript(() =>
      localStorage.setItem(
        "little-pastures-moon-v1",
        JSON.stringify({
          version: 1,
          phase: "heist",
          money: 60,
          delivered: 0,
          heists: 0,
          parts: 0,
          revives: 3,
          maxHp: 3,
          owned: [0, 1, 2, 3, 4, 5],
        }),
      ),
    );
    await page.goto("http://localhost/web-experiments/rratedsheepgame/");
    await page.waitForFunction(() => window.sheepGame);
    assert.equal(
      (await page.evaluate(() => sheepGame.getState())).stats.townBuildings,
      65,
    );
    await page.keyboard.down("KeyQ");
    await page.locator("#wheel").waitFor({ state: "visible" });
    assert.equal(await page.locator(".wheel-item").count(), 7);
    const paused = await page.evaluate(() => sheepGame.getState().player);
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(200);
    assert.deepEqual(
      await page.evaluate(() => sheepGame.getState().player),
      paused,
    );
    await page.keyboard.up("KeyW");
    await page.locator('#wheel [data-item="5"]').hover();
    await page.screenshot({ path: "/tmp/rratedsheepgame-equipment-wheel.png" });
    await page.keyboard.up("KeyQ");
    await page.waitForFunction(() => sheepGame.getState().equippedWeapon === 5);
    assert(!(await page.locator("#wheel").isVisible()));
    await page.keyboard.down("KeyF");
    await page.waitForFunction(
      () => sheepGame.getState().stats.equipment.muzzle,
    );
    await page.keyboard.up("KeyF");
    assert.equal(
      (await page.evaluate(() => sheepGame.getState())).stats.equipment.weapon,
      5,
    );
    await page.locator("#equipment-button").tap();
    await page.locator('#wheel [data-item="revive"]').tap();
    await page.waitForFunction(
      () => sheepGame.getState().selectedItem === "revive",
    );
    await page.getByRole("button", { name: "Revive", exact: true }).waitFor();
    await page.locator("#equipment-button").tap();
    await page.locator('#wheel [data-item="0"]').tap();
    await page.keyboard.down("KeyF");
    await page.waitForFunction(
      () => sheepGame.getState().stats.equipment.swing,
    );
    await page.keyboard.up("KeyF");
    await page.locator("#mobile-map-button").tap();
    await page.locator("#atlas-town").tap();
    assert.equal(
      await page.locator("#atlas-town").getAttribute("aria-pressed"),
      "true",
    );
    await page.screenshot({ path: "/tmp/rratedsheepgame-town-map.png" });
    await page.locator("#atlas-close").tap();
    await page.locator("#menu-button").tap();
    await page.locator("#sound-button").tap();
    assert.equal(
      (await page.evaluate(() => sheepGame.getState())).audio.enabled,
      false,
    );
    await page.locator("#sound-button").tap();
    await page.waitForFunction(
      () => sheepGame.getState().audio.state === "running",
    );
    assert.equal(
      (await page.evaluate(() => sheepGame.getState())).audio.voices,
      3,
    );
    await page.locator("#menu-close").tap();
    await page.setViewportSize({ width: 780, height: 390 });
    await page.locator("#equipment-button").tap();
    const bounds = await page.locator(".wheel-panel").boundingBox();
    assert(bounds.y >= 0 && bounds.y + bounds.height <= 390);
    await page.locator(".wheel-close").tap();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: deployed town/map, mobile radial wheel, hold/release and touch selection, paused selection, visible equipment, muzzle flash, melee swing, WebAudio graph/mute, and landscape fit.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
