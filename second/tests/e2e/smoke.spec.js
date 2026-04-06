/* eslint-env node */
/* global document, window */
const { test, expect } = require('@playwright/test');

const parseDistanceMeters = async (page) => {
  const text = await page.locator('#distance').textContent();
  const match = text?.match(/(\d+)\s*m/);
  return match ? Number(match[1]) : NaN;
};

const detectWebGLSupport = async (page) => page.evaluate(() => {
  const fatalOverlay = document.getElementById('fatalOverlay');
  const fatalVisible = fatalOverlay && window.getComputedStyle(fatalOverlay).display !== 'none';
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  return {
    available: !!gl && !fatalVisible,
    fatalVisible,
  };
});

test('loads the skier scene and starts without runtime errors', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/?e2e=1');

  const webgl = await detectWebGLSupport(page);
  test.skip(!webgl.available, 'Skipping WebGL-dependent test because this browser context cannot create a usable WebGL context.');

  await expect(page.locator('#startTitle')).toHaveText('Downhill Skier');
  await expect(page.locator('#hud')).toContainText('Winter Physics');
  await expect(page.locator('body > canvas').first()).toBeVisible();

  await page.locator('#startOverlay').click();
  await expect(page.locator('#startOverlay')).toBeHidden();

  await page.waitForTimeout(2500);
  await expect(page.locator('#fps')).not.toHaveText(/FPS:\s*--/);
  await expect(page.locator('#distance')).toContainText('m');

  expect(pageErrors, `Unhandled page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});

test('shows the title screen, then starts the skier moving after tap', async ({ page }) => {
  await page.goto('/?e2e=1');

  const webgl = await detectWebGLSupport(page);
  test.skip(!webgl.available, 'Skipping movement test because this browser context cannot create a usable WebGL context.');

  await expect(page.locator('#startOverlay')).toBeVisible();
  await expect(page.locator('#startTitle')).toHaveText('Downhill Skier');
  await expect(page.locator('#distance')).toHaveText('0 m');

  await page.locator('#startOverlay').click();
  await expect(page.locator('#startOverlay')).toBeHidden();

  await expect.poll(async () => parseDistanceMeters(page), {
    message: 'Expected the skier to start moving after tapping the title screen',
    timeout: 20_000,
    intervals: [250, 500, 1000],
  }).toBeGreaterThan(0);
});
