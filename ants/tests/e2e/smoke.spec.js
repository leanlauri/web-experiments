/* eslint-env node */
/* global document, window */
const { test, expect } = require('@playwright/test');

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

test('renders the ants terrain prototype without runtime errors', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/');

  const webgl = await detectWebGLSupport(page);
  test.skip(!webgl.available, 'Skipping WebGL-dependent test because this browser context cannot create a usable WebGL context.');

  await expect(page.locator('#hudTitle')).toHaveText('Ants Terrain Prototype');
  await expect(page.locator('#axisInfo')).toContainText('Ground lies on the X/Z plane');
  await expect(page.locator('#cameraInfo')).toContainText('drag or touch to orbit');
  await expect(page.locator('#meshInfo')).toContainText('Triangles: 20000');
  await expect(page.locator('#meshInfo')).toContainText('x/z ∈ [-50, 50]');
  await expect(page.locator('#meshInfo')).toContainText('y ∈ [-5, 5]');
  await expect(page.locator('#antInfo')).toContainText('Ants: 50 total');
  await expect(page.locator('#antInfo')).toContainText('LOD tiers near/mid/far');
  await expect(page.locator('#antInfo')).toContainText('Render full/impostor');
  await expect(page.locator('#antInfo')).toContainText('Brains and steering run less often for distant ants');
  await expect(page.locator('body > canvas').first()).toBeVisible();
  await expect(page.locator('#fatalOverlay')).toBeHidden();

  expect(pageErrors, `Unhandled page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});
