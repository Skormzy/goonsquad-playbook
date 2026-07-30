import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'team-system-audit');
const baseUrl = process.env.GOONSQUAD_SYSTEM_URL ?? 'http://127.0.0.1:55601/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];
const reviews = [
  {
    id: 'f3-secure',
    playId: 'pomr',
    phase: 0,
    time: 0.2,
    expectedTitle: 'Secure Ball - Build Three Layers',
  },
  {
    id: 'f3-recovery',
    playId: 'pomr',
    phase: 2,
    time: 7.784,
    expectedTitle: 'Loose Ball - Recover Above It',
  },
  {
    id: 'backcheck-shape',
    playId: 'bck',
    phase: 2,
    time: 5.8,
    expectedTitle: 'Three Layers Remove the Rush',
  },
  {
    id: 'house-exchange',
    playId: 'nfd',
    phase: 2,
    time: 6,
    expectedTitle: 'Reverse - Exchange Jobs',
  },
];

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('Chrome or Edge was not found for the hidden team-system review.');
}

function reviewUrl(review, mode) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries({
    content: 'plays',
    mode,
    playId: review.playId,
    phase: String(review.phase),
    time: String(review.time),
    speed: '1',
    role: 'C',
    playing: 'false',
    camera: 'overhead',
  })) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

async function analyzePng(context, imageBuffer) {
  const pixelPage = await context.newPage();
  const source = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  await pixelPage.setContent(`<img id="capture" src="${source}" alt="">`);
  const result = await pixelPage.evaluate(async () => {
    const image = document.querySelector('#capture');
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context2d = canvas.getContext('2d', { willReadFrequently: true });
    context2d.drawImage(image, 0, 0);
    const pixels = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
    const lumaBuckets = new Set();
    let minimumLuma = 255;
    let maximumLuma = 0;
    let sampledPixels = 0;

    for (let offset = 0; offset < pixels.length; offset += 4 * 16) {
      const luma = Math.round(
        pixels[offset] * 0.2126
        + pixels[offset + 1] * 0.7152
        + pixels[offset + 2] * 0.0722,
      );
      minimumLuma = Math.min(minimumLuma, luma);
      maximumLuma = Math.max(maximumLuma, luma);
      lumaBuckets.add(Math.floor(luma / 4));
      sampledPixels += 1;
    }

    return {
      width: canvas.width,
      height: canvas.height,
      sampledPixels,
      lumaRange: maximumLuma - minimumLuma,
      lumaBuckets: lumaBuckets.size,
    };
  });
  await pixelPage.close();
  return result;
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
const results = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });

  for (const review of reviews) {
    for (const mode of ['2d', '3d']) {
      const page = await context.newPage();
      const problems = [];
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

      await page.goto(reviewUrl(review, mode), {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await page.evaluate(() => document.fonts.ready);
      await page.getByText(review.expectedTitle, { exact: true }).first()
        .waitFor({ state: 'visible', timeout: 60_000 });

      let playerCount = 12;
      let canvasPixels = null;
      if (mode === '3d') {
        const preview = page.getByTestId('vnext-3d-production-preview');
        await preview.waitFor({ state: 'visible', timeout: 60_000 });
        await page.waitForFunction(() => (
          document.querySelector('[data-testid="vnext-3d-production-preview"]')
            ?.getAttribute('data-player-count') === '12'
        ), undefined, { timeout: 120_000 });
        await page.waitForFunction(() => Number(
          document.querySelector('[data-testid="vnext-3d-production-preview"]')
            ?.getAttribute('data-frame-sample-count') ?? 0,
        ) >= 30, undefined, { timeout: 120_000 });
        playerCount = Number(await preview.getAttribute('data-player-count'));
        const canvasCapture = await preview.locator('canvas').screenshot();
        canvasPixels = await analyzePng(context, canvasCapture);
      } else {
        await page.getByTestId(`play-workspace-${viewport.id}`)
          .waitFor({ state: 'visible', timeout: 60_000 });
      }

      const screenshotName = `${viewport.id}-${review.id}-${mode}-${viewport.width}x${viewport.height}.png`;
      const screenshotPath = path.join(outputDir, screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const layout = await page.evaluate(() => ({
        bodyWidth: document.body.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      const passed = problems.length === 0
        && playerCount === 12
        && layout.bodyWidth <= layout.viewportWidth
        && layout.documentWidth <= layout.viewportWidth
        && (
          canvasPixels === null
          || (canvasPixels.lumaRange >= 40 && canvasPixels.lumaBuckets >= 12)
        );

      results.push({
        viewport: viewport.id,
        review: review.id,
        playId: review.playId,
        phase: review.phase,
        expectedTitle: review.expectedTitle,
        mode,
        screenshot: path.relative(root, screenshotPath).replaceAll('\\', '/'),
        playerCount,
        canvasPixels,
        layout,
        problems,
        passed,
      });
      await page.close();
    }
  }
  await context.close();
}

await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  headless: true,
  visibleBrowserWindowOpened: false,
  passed: results.every((result) => result.passed),
  results,
};
await writeFile(
  path.join(outputDir, 'team-system-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
