const { test, expect } = require('@playwright/test');

test('starts the flyer scene and paints a canvas', async ({ page }) => {
  await page.goto('/?e2e=1');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('#speed')).toContainText('Speed', { timeout: 10_000 });

  const pixels = await page.evaluate(() => {
    const canvasEl = document.querySelector('canvas');
    const gl = canvasEl?.getContext('webgl2') || canvasEl?.getContext('webgl');
    if (!canvasEl || !gl) return null;
    const data = new Uint8Array(4);
    gl.readPixels(Math.floor(canvasEl.width / 2), Math.floor(canvasEl.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return Array.from(data);
  });

  expect(pixels).not.toBeNull();
  expect(pixels.some((channel) => channel > 0)).toBe(true);
});
