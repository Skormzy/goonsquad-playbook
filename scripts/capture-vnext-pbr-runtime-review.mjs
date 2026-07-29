import { createHash } from 'node:crypto';
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewId = process.env.VNEXT_REVIEW_ID ?? 'cmu-jog16-ik-pbr';
const reviewOutputName = process.env.VNEXT_REVIEW_OUTPUT_DIR ?? 'athlete-pbr-material-review';
const closeZoomSteps = Number(process.env.VNEXT_REVIEW_ZOOM_STEPS ?? 2);
const reviewCamera = process.env.VNEXT_REVIEW_CAMERA ?? 'player';
const reviewTime = process.env.VNEXT_REVIEW_TIME ?? '4.6';
if (!Number.isInteger(closeZoomSteps) || closeZoomSteps < 0 || closeZoomSteps > 8) {
  throw new Error(`Invalid close review zoom step count: ${closeZoomSteps}`);
}
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', reviewOutputName);
const baseUrl = process.env.VNEXT_REVIEW_URL ?? 'http://127.0.0.1:55601/';
const reviewUrl = new URL(baseUrl);

for (const [key, value] of Object.entries({
  content: 'plays',
  mode: '3d',
  playId: 'brk',
  phase: '1',
  time: reviewTime,
  speed: '1',
  role: 'C',
  playing: 'false',
  camera: reviewCamera,
  motionReview: reviewId,
})) {
  reviewUrl.searchParams.set(key, value);
}

const viewports = [
  { id: 'desktop', width: 1280, height: 720 },
  { id: 'mobile', width: 390, height: 844 },
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
  throw new Error('Chrome or Edge was not found for the headless runtime review.');
}

function numeric(value) {
  if (value === null || value === 'pending' || value === 'disabled') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

await mkdir(outputDir, { recursive: true });
const chromePath = await findChrome();
const results = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(chromePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const browserProblems = [];

  page.on('console', (message) => {
    if (message.type() === 'error') browserProblems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown';
    if (failure === 'net::ERR_ABORTED') return;
    browserProblems.push(`requestfailed: ${request.url()} (${failure})`);
  });

  await page.goto(reviewUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const preview = page.getByTestId('vnext-3d-production-preview');
  await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await page.getByText('4 ASSETS READY', { exact: true }).waitFor({ state: 'visible', timeout: 120_000 });
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="vnext-3d-production-preview"]');
    return Number(node?.getAttribute('data-frame-sample-count') ?? 0) >= 120;
  }, undefined, { timeout: 120_000 });

  const screenshotPath = path.join(
    outputDir,
    `runtime-${viewport.id}-${viewport.width}x${viewport.height}.png`,
  );
  const screenshot = await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshotInfo = await stat(screenshotPath);
  const attributes = await preview.evaluate((node) => Object.fromEntries(
    [...node.attributes]
      .filter((attribute) => attribute.name.startsWith('data-'))
      .map((attribute) => [attribute.name.slice(5), attribute.value]),
  ));
  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    canvasCount: document.querySelectorAll('canvas').length,
    assetsReady: document.body.textContent?.includes('4 ASSETS READY') ? 4 : 0,
  }));
  const canvas = page.locator('canvas').first();
  const canvasBox = await canvas.boundingBox();
  const canvasPng = await canvas.screenshot();

  results[viewport.id] = {
    viewport: [viewport.width, viewport.height],
    url: reviewUrl.href,
    screenshot: path.relative(outputDir, screenshotPath).replaceAll('\\', '/'),
    screenshotBytes: screenshotInfo.size,
    screenshotSha256: createHash('sha256').update(screenshot).digest('hex'),
    canvasScreenshotBytes: canvasPng.length,
    canvasBox: canvasBox
      ? [canvasBox.x, canvasBox.y, canvasBox.width, canvasBox.height].map((value) => Number(value.toFixed(2)))
      : null,
    canvasCount: layout.canvasCount,
    assetsReady: layout.assetsReady,
    playerCount: numeric(attributes['player-count']),
    motionReview: attributes['motion-review'],
    selectedAthleteAction: attributes['selected-athlete-action'],
    selectedAthleteActionTime: numeric(attributes['selected-athlete-action-time']),
    selectedAthleteAnimationWeight: numeric(attributes['selected-athlete-animation-weight']),
    selectedAthleteHandSpanMm: numeric(attributes['selected-athlete-hand-span-mm']),
    renderProfile: attributes['render-profile'],
    frameSampleCount: numeric(attributes['frame-sample-count']),
    frameP95Ms: numeric(attributes['frame-p95-ms']),
    groundSampleCount: numeric(attributes['ground-sample-count']),
    groundMinimumMm: numeric(attributes['ground-min-mm']),
    groundMaximumMm: numeric(attributes['ground-max-mm']),
    groundMaximumCorrectionMm: numeric(attributes['ground-max-correction-mm']),
    groundedPlayerCount: numeric(attributes['grounded-player-count']),
    horizontalOverflow: Math.max(layout.bodyWidth, layout.documentWidth) > layout.viewportWidth,
    browserProblems,
  };

  if (viewport.id === 'desktop' && closeZoomSteps > 0) {
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    for (let step = 0; step < closeZoomSteps; step += 1) {
      await zoomIn.click();
    }
    await page.waitForTimeout(800);
    const closePath = path.join(outputDir, 'runtime-desktop-close-1280x720.png');
    const closeScreenshot = await page.screenshot({ path: closePath, fullPage: true });
    const closeAttributes = await preview.evaluate((node) => Object.fromEntries(
      [...node.attributes]
        .filter((attribute) => attribute.name.startsWith('data-'))
        .map((attribute) => [attribute.name.slice(5), attribute.value]),
    ));
    results[viewport.id].closeReview = {
      screenshot: path.relative(outputDir, closePath).replaceAll('\\', '/'),
      screenshotBytes: closeScreenshot.length,
      screenshotSha256: createHash('sha256').update(closeScreenshot).digest('hex'),
      cameraControl: closeAttributes['camera-control'],
      cameraInteractionCount: numeric(closeAttributes['camera-interaction-count']),
      playerCount: numeric(closeAttributes['player-count']),
    };
  }

  await context.close();
  await browser.close();
}

const outputPath = path.join(outputDir, 'runtime-capture.json');
await writeFile(outputPath, `${JSON.stringify({
  capturedAt: new Date().toISOString(),
  headless: true,
  visibleBrowserWindowOpened: false,
  results,
}, null, 2)}\n`);

console.log(outputPath);
console.log(JSON.stringify(results, null, 2));
