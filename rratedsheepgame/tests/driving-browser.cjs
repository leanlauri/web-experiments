const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 720 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem(
        "little-pastures-moon-v1",
        JSON.stringify({
          version: 1,
          phase: "heist",
          money: 25,
          delivered: 0,
          heists: 0,
          parts: 0,
          revives: 3,
          maxHp: 3,
          owned: [0],
        }),
      ),
    );
    await page.goto("http://localhost/web-experiments/rratedsheepgame/");
    await page.waitForFunction(() => window.sheepGame);
    assert(
      (await page.locator("script[type=module]").getAttribute("src")).includes(
        "?v=",
      ),
    );
    assert(
      (
        await page.locator("link[rel=stylesheet]").getAttribute("href")
      ).includes("?v="),
    );
    assert(
      !(await page.locator("#mission").isVisible()),
      "compact HUD is deployed",
    );
    await page.keyboard.down("KeyA");
    await page.keyboard.down("KeyW");
    await page.waitForFunction(() => sheepGame.getState().player[0] < -5);
    await page.keyboard.up("KeyA");
    await page.keyboard.up("KeyW");
    await page.locator(".touch-actions [data-action=interact]").tap();
    await page.waitForFunction(() => sheepGame.getState().vehicle?.id === 24);
    await page.getByRole("button", { name: "Brake", exact: true }).waitFor();
    const heading = await page.evaluate(
      () => sheepGame.getState().vehicle.heading,
    );
    const stick = await page.locator("#thumbstick").boundingBox();
    await page.mouse.move(stick.x + stick.width / 2, stick.y + 10);
    await page.mouse.down();
    await page.waitForFunction(() => sheepGame.getState().vehicle.speed > 3);
    await page.mouse.up();
    const moving = await page.evaluate(() => sheepGame.getState().vehicle);
    assert(moving.speed > 0 && moving.speed < 15, "accelerates progressively");
    assert(
      Math.abs(moving.heading - heading) < 0.01,
      "pedal preserves heading",
    );
    const brake = await page
      .getByRole("button", { name: "Brake", exact: true })
      .boundingBox();
    await page.mouse.move(
      brake.x + brake.width / 2,
      brake.y + brake.height / 2,
    );
    await page.mouse.down();
    await page.waitForFunction(() => sheepGame.getState().vehicle.speed === 0);
    await page.mouse.up();
    await page.keyboard.down("KeyS");
    await page.waitForFunction(() => sheepGame.getState().vehicle.speed < -2);
    await page.keyboard.up("KeyS");
    await page.locator(".touch-actions [data-action=interact]").tap();
    await page.waitForFunction(() => sheepGame.getState().vehicle === null);
    await page.getByRole("button", { name: "Jump", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: deployed compact HUD, versioned assets, boarding, touch throttle, hold-to-brake, keyboard reverse and exit.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
