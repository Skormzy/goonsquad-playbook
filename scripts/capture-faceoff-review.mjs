import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'faceoff-rebuild');
const baseUrl = process.env.GOONSQUAD_FACEOFF_URL ?? 'http://127.0.0.1:55601/';
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];
const moments = [
  { id: 'set', time: 0, segment: 'loose', owner: 'none' },
  { id: 'draw', time: 1.45, segment: 'faceoff', owner: 'none' },
  { id: 'secured', time: 1.9, segment: 'carry', owner: 'US_LD' },
];
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
  throw new Error('Chrome or Edge was not found for the hidden faceoff review.');
}

function route(mode, time) {
  const url = new URL(baseUrl);
  Object.entries({
    content: 'plays',
    mode,
    playId: 'dzfl',
    phase: '0',
    time: String(time),
    speed: '1',
    role: 'C',
    playing: 'false',
    camera: 'broadcast',
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.href;
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
}

async function analyzePngPixels(page, pngBuffer) {
  return page.evaluate((dataUrl) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minimumLuma = 255;
      let maximumLuma = 0;
      let sampledPixels = 0;
      for (let index = 0; index < pixels.length; index += 64) {
        const luma = Math.round(
          pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722,
        );
        minimumLuma = Math.min(minimumLuma, luma);
        maximumLuma = Math.max(maximumLuma, luma);
        sampledPixels += 1;
      }
      resolve({ sampledPixels, lumaRange: maximumLuma - minimumLuma });
    };
    image.src = dataUrl;
  }), `data:image/png;base64,${pngBuffer.toString('base64')}`);
}

async function capture(page, viewport, mode, moment) {
  await goto(page, route(mode, moment.time));
  const selector = mode === '3d'
    ? '[data-testid="vnext-3d-production-preview"]'
    : '[aria-label="Rink view"] svg';
  const surface = page.locator(selector);
  await surface.waitFor({ state: 'visible', timeout: 60_000 });

  if (mode === '3d') {
    await page.waitForFunction(({ expectedSegment, expectedOwner }) => {
      const node = document.querySelector('[data-testid="vnext-3d-production-preview"]');
      return node?.getAttribute('data-player-count') === '12'
        && node?.getAttribute('data-ball-segment') === expectedSegment
        && node?.getAttribute('data-ball-owner') === expectedOwner;
    }, { expectedSegment: moment.segment, expectedOwner: moment.owner }, { timeout: 120_000 });
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    await page.waitForTimeout(300);
  } else {
    await page.waitForFunction(({ expectedSegment, expectedOwner }) => {
      const node = document.querySelector('[aria-label="Rink view"] svg');
      return node?.getAttribute('data-ball-segment') === expectedSegment
        && node?.getAttribute('data-ball-owner') === expectedOwner;
    }, { expectedSegment: moment.segment, expectedOwner: moment.owner }, { timeout: 60_000 });
  }

  const screenshotPath = path.join(
    outputDir,
    `${viewport.id}-${mode}-${moment.id}-${viewport.width}x${viewport.height}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: false });
  let canvasPixels = null;
  let canvasScreenshot = null;
  if (mode === '3d') {
    const canvasPath = path.join(
      outputDir,
      `${viewport.id}-${mode}-${moment.id}-canvas-${viewport.width}x${viewport.height}.png`,
    );
    const canvasBuffer = await page.locator('.vnext3d-preview-stage canvas').screenshot({
      path: canvasPath,
    });
    canvasPixels = await analyzePngPixels(page, canvasBuffer);
    canvasScreenshot = path.relative(root, canvasPath).replaceAll('\\', '/');
  }
  const attributes = await surface.evaluate((node) => ({
    ballSegment: node.getAttribute('data-ball-segment'),
    ballOwner: node.getAttribute('data-ball-owner'),
    playerCount: node.getAttribute('data-player-count'),
  }));
  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));

  return {
    mode,
    moment: moment.id,
    time: moment.time,
    screenshot: path.relative(root, screenshotPath).replaceAll('\\', '/'),
    canvasScreenshot,
    attributes,
    canvasPixels,
    layout,
    passed: attributes.ballSegment === moment.segment
      && attributes.ballOwner === moment.owner
      && (mode !== '3d' || (attributes.playerCount === '12' && canvasPixels.lumaRange >= 35))
      && layout.bodyWidth <= layout.viewportWidth
      && layout.documentWidth <= layout.viewportWidth,
  };
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const results = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  const captures = [];
  for (const mode of ['2d', '3d']) {
    for (const moment of moments) captures.push(await capture(page, viewport, mode, moment));
  }
  results[viewport.id] = {
    viewport: [viewport.width, viewport.height],
    captures,
    problems,
    passed: problems.length === 0 && captures.every((item) => item.passed),
  };

  await context.close();
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  headless: true,
  visibleBrowserWindowOpened: false,
  playId: 'dzfl',
  camera: 'broadcast',
  allAuthoredFaceoffsCoveredByContract: ['dzfl', 'dzfr', 'nzfc', 'ozfl', 'ppfo', 'pkfo'],
  passed: Object.values(results).every((result) => result.passed),
  results,
};

await writeFile(
  path.join(outputDir, 'faceoff-review.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
