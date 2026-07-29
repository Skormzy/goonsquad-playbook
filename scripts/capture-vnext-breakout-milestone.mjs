import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'strategy-first-standard-breakout');
const baseUrl = process.env.VNEXT_MILESTONE_URL ?? 'http://127.0.0.1:55601/';
const viewports = [
  { id: 'laptop', width: 1366, height: 768 },
  { id: 'tablet', width: 768, height: 1024 },
];
const cameras = ['broadcast', 'overhead', 'bench', 'player'];
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('Chrome or Edge was not found for the hidden milestone review.');
}

async function analyzePngPixels(page, pngBuffer) {
  return page.evaluate((dataUrl) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      let sampledPixels = 0;
      let visiblePixels = 0;
      let minimumLuma = 255;
      let maximumLuma = 0;
      for (let index = 0; index < pixels.length; index += 64) {
        const alpha = pixels[index + 3];
        const luma = Math.round(
          pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722,
        );
        sampledPixels += 1;
        if (alpha > 0) visiblePixels += 1;
        minimumLuma = Math.min(minimumLuma, luma);
        maximumLuma = Math.max(maximumLuma, luma);
      }
      resolve({
        width,
        height,
        sampledPixels,
        visiblePixels,
        lumaRange: maximumLuma - minimumLuma,
      });
    };
    image.src = dataUrl;
  }), `data:image/png;base64,${pngBuffer.toString('base64')}`);
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const results = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const browserProblems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserProblems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`));
  results[viewport.id] = { viewport: [viewport.width, viewport.height], cameras: {} };

  for (const camera of cameras) {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries({
      content: 'plays',
      mode: '3d',
      playId: 'brk',
      phase: '1',
      time: '8.65',
      speed: '1',
      role: 'LW',
      playing: 'false',
      camera,
    })) url.searchParams.set(key, value);

    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const preview = page.getByTestId('vnext-3d-production-preview');
    await preview.waitFor({ state: 'visible', timeout: 60_000 });
    await page.getByText('4 ASSETS READY', { exact: true }).waitFor({ state: 'visible', timeout: 120_000 });
    await page.waitForFunction(() => Number(
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-frame-sample-count') ?? 0,
    ) >= 60, undefined, { timeout: 120_000 });
    await page.waitForTimeout(150);

    const attributes = await preview.evaluate((node) => Object.fromEntries(
      [...node.attributes]
        .filter((attribute) => attribute.name.startsWith('data-'))
        .map((attribute) => [attribute.name.slice(5), attribute.value]),
    ));
    const layout = await page.evaluate(() => {
      const stage = document.querySelector('.vnext3d-preview-stage')?.getBoundingClientRect();
      const canvas = document.querySelector('.vnext3d-preview-stage canvas')?.getBoundingClientRect();
      const consolePanel = document.querySelector('.vnext3d-preview-console')?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        bodyWidth: document.body.scrollWidth,
        stage: stage ? { top: stage.top, bottom: stage.bottom, width: stage.width, height: stage.height } : null,
        canvas: canvas ? { top: canvas.top, bottom: canvas.bottom, width: canvas.width, height: canvas.height } : null,
        consoleTop: consolePanel?.top ?? null,
      };
    });
    const canvasBuffer = await page.locator('.vnext3d-preview-stage canvas').screenshot();
    const canvasPixels = await analyzePngPixels(page, canvasBuffer);
    const screenshot = path.join(
      outputDir,
      `entry-settle-${camera}-${viewport.id}-${viewport.width}x${viewport.height}.png`,
    );
    await page.screenshot({ path: screenshot });
    results[viewport.id].cameras[camera] = {
      screenshot: path.relative(root, screenshot).replaceAll('\\', '/'),
      replayTime: Number(attributes['replay-time']),
      playerCount: Number(attributes['player-count']),
      ballOwner: attributes['ball-owner'],
      possession: attributes.possession,
      nextRead: attributes['next-read'],
      spacingPhase: attributes['spacing-phase'],
      spacingStatus: attributes['spacing-status'],
      renderProfile: attributes['render-profile'],
      layout,
      canvasPixels,
    };
  }

  results[viewport.id].browserProblems = browserProblems;
  results[viewport.id].passes = (
    browserProblems.length === 0
    && Object.values(results[viewport.id].cameras).every((camera) => (
      camera.replayTime === 8.65
      && camera.playerCount === 12
      && camera.ballOwner === 'US_LW'
      && camera.possession === 'LW'
      && camera.nextRead === 'Hold the wall; let both support lanes arrive'
      && camera.spacingPhase === 'entry-settle'
      && camera.spacingStatus === 'pass'
      && camera.layout.bodyWidth <= camera.layout.viewportWidth
      && camera.layout.canvas.bottom <= camera.layout.consoleTop
      && camera.canvasPixels.sampledPixels > 1000
      && camera.canvasPixels.visiblePixels > 1000
      && camera.canvasPixels.lumaRange >= 40
    ))
  );

  await context.close();
  await browser.close();
}

const outputPath = path.join(outputDir, 'breakout-milestone-laptop-tablet.json');
await writeFile(outputPath, `${JSON.stringify({
  capturedAt: new Date().toISOString(),
  headless: true,
  visibleBrowserWindowOpened: false,
  results,
}, null, 2)}\n`);

const failures = Object.entries(results).filter(([, result]) => !result.passes).map(([id]) => id);
if (failures.length > 0) throw new Error(`Laptop/tablet milestone gate failed for: ${failures.join(', ')}`);

console.log(outputPath);
console.log(JSON.stringify(results, null, 2));
