const { chromium } = require("/home/lauri/node_modules/playwright-core");
const assert = require("node:assert/strict");
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
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript(() => {
      window.testPad = null;
      Object.defineProperty(navigator, "getGamepads", {
        value: () => (window.testPad ? [window.testPad] : []),
      });
    });
    const state = () => page.evaluate(() => sheepGame.getState());
    const screen = (id) =>
      page.waitForFunction((id) => sheepGame.getState().menu === id, id);
    const focus = (id) =>
      page.waitForFunction((id) => document.activeElement.id === id, id);
    const press = async (i) => {
      await page.evaluate((i) => {
        testPad.buttons[i] = { pressed: true, value: 1 };
      }, i);
      await page.waitForTimeout(110);
      await page.evaluate((i) => {
        testPad.buttons[i] = { pressed: false, value: 0 };
      }, i);
      await page.waitForTimeout(110);
    };
    await page.goto("http://localhost/web-experiments/rratedsheepgame/");
    await page.waitForFunction(() => window.sheepGame);
    await page.keyboard.press("Escape");
    await screen("menu");
    await focus("menu-resume");
    const frozen = (await state()).time;
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(350);
    await page.keyboard.up("KeyW");
    assert.equal(
      (await state()).time,
      frozen,
      "all simulation time stays frozen",
    );
    // W moved menu selection; reset to Resume through Escape so the following route is deterministic.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await focus("menu-resume");
    await page.keyboard.press("ArrowDown");
    await focus("menu-map");
    await page.keyboard.press("Enter");
    await screen("atlas");
    await focus("atlas-region");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator("#atlas-town").getAttribute("aria-pressed"),
      "true",
    );
    await page.keyboard.press("Escape");
    await screen("menu");
    await focus("menu-map");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await screen("wheel");
    await page.keyboard.press("Enter");
    await screen("menu");
    await focus("menu-items");
    await page.keyboard.press("Escape");
    await screen(null);
    await page.locator("#pause-button").click();
    await screen("menu");
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert(
        await page.evaluate(() => !!document.activeElement.closest("#menu")),
        "focus stays inside pause screen",
      );
    }
    await page.keyboard.press("Escape");
    // Switch to a standard controller. All following navigation uses the polled Gamepad API.
    await page.evaluate(() => {
      window.testPad = {
        index: 0,
        connected: true,
        mapping: "standard",
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({
          pressed: false,
          value: 0,
        })),
      };
    });
    await press(9);
    await screen("menu");
    await focus("menu-resume");
    assert.equal((await state()).input, "gamepad");
    await page.screenshot({ path: "/tmp/rratedsheepgame-console-pause.png" });
    await press(13);
    await focus("menu-map");
    await press(0);
    await screen("atlas");
    await press(15);
    await press(0);
    await press(1);
    await screen("menu");
    await focus("menu-map");
    await press(13);
    await press(0);
    await screen("wheel");
    await press(1);
    await screen("menu");
    await focus("menu-items");
    // Disabled home-shop option is skipped while away from home.
    await press(13);
    await focus("menu-revive");
    await press(13);
    await focus("quality-button");
    await press(0);
    assert.equal((await state()).stats.quality.mode, "low");
    await press(13);
    await focus("sound-button");
    await press(13);
    await focus("menu-help");
    await press(0);
    await screen("help");
    await page
      .locator("#help .panel")
      .evaluate((el) => (el.style.maxHeight = "200px"));
    await page.evaluate(() => {
      testPad.axes[3] = 1;
    });
    await page.waitForTimeout(450);
    await page.evaluate(() => {
      testPad.axes[3] = 0;
    });
    assert(
      (await page.locator("#help .panel").evaluate((el) => el.scrollTop)) > 0,
      "right stick scrolls guide",
    );
    await page
      .locator("#help .panel")
      .evaluate((el) => (el.style.maxHeight = ""));
    await press(1);
    await screen("menu");
    await focus("menu-help");
    await press(13);
    await focus("menu-reset");
    await press(0);
    await screen("confirm");
    await focus("confirm-cancel");
    await press(1);
    await screen("menu");
    await focus("menu-reset");
    await press(9);
    await screen(null);
    // Hold LB, point at the club, then release; the wheel must commit and resume.
    await page.evaluate(() => {
      testPad.buttons[4] = { pressed: true, value: 1 };
    });
    await screen("wheel");
    await page.evaluate(() => {
      testPad.axes[1] = -1;
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      testPad.axes[1] = 0;
      testPad.buttons[4] = { pressed: false, value: 0 };
    });
    await screen(null);
    assert.equal((await state()).equippedWeapon, 0);
    const before = (await state()).player;
    await page.evaluate(() => {
      testPad.axes[0] = 1;
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      testPad.axes[0] = 0;
    });
    const after = (await state()).player;
    assert(
      Math.hypot(after[0] - before[0], after[2] - before[2]) > 1,
      "gamepad moves the player",
    );
    await page.evaluate(() => {
      window.testPad = null;
    });
    await screen("menu");
    await page.keyboard.press("Escape");
    // Home checkpoint: navigate and buy without pointer input, including a rebuilt shop list.
    await page.evaluate(() =>
      localStorage.setItem(
        "little-pastures-moon-v1",
        JSON.stringify({
          version: 1,
          phase: "heist",
          money: 100,
          delivered: 12,
          heists: 0,
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
    await screen("shop");
    const shopTime = (await state()).time;
    await page.waitForTimeout(300);
    assert.equal(
      (await state()).time,
      shopTime,
      "workshop also freezes the world",
    );
    await page.keyboard.press("ArrowDown"); // Shop buy buttons use stable data keys, not IDs.
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.menuKey),
      "shop-revive",
    );
    await page.keyboard.press("Enter");
    assert.equal((await state()).money, 85);
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.menuKey),
      "shop-revive",
      "selection survives shop rebuild",
    );
    await page.screenshot({ path: "/tmp/rratedsheepgame-console-shop.png" });
    await page.keyboard.press("Escape");
    await screen(null);
    // Controller-style confirmation also replaces the native browser restart dialog.
    await page.keyboard.press("Escape");
    for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowDown");
    await focus("menu-reset");
    await page.keyboard.press("Enter");
    await screen("confirm");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await screen(null);
    assert.equal((await state()).phase, "intro");
    // The same menu remains usable on portrait and landscape touch screens.
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    mobile.on("pageerror", (e) => errors.push(e.message));
    await mobile.goto("http://localhost/web-experiments/rratedsheepgame/");
    await mobile.waitForFunction(() => window.sheepGame);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await mobile.setViewportSize(viewport);
      await mobile.locator("#menu-button").tap();
      await mobile.waitForFunction(() => sheepGame.getState().menu === "menu");
      const hints = await mobile.locator("#menu .menu-hints").boundingBox();
      assert(
        hints.y >= 0 && hints.y + hints.height <= viewport.height,
        "button legend fits viewport",
      );
      await mobile.screenshot({
        path: "/tmp/rratedsheepgame-console-menu-" + viewport.width + ".png",
      });
      await mobile.locator("#menu-resume").tap();
      await mobile.waitForFunction(() => sheepGame.getState().menu === null);
    }
    await mobile.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: Escape/icon/Start pause, frozen simulation/shop, keyboard and gamepad navigation, back/selection restoration, focus trap, atlas, wheel, shop purchase, guide scrolling, restart confirmation, gamepad movement/disconnect and mobile layouts.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
