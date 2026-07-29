import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'brand-system');
const baseUrl = process.env.VNEXT_BRAND_URL ?? 'http://127.0.0.1:55601/';
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
  throw new Error('Chrome or Edge was not found for the hidden brand review.');
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

const reviews = [
  {
    id: 'strategy-3d',
    params: {
      content: 'strategy',
      mode: '3d',
      phase: '3',
      time: '13',
      speed: '1',
      playing: 'false',
      camera: 'broadcast',
      tacticId: 'instant-backcheck',
      scenario: 'mistake',
    },
    readySelector: '[data-testid="vnext-3d-production-preview"]',
    requiresCanvas: true,
  },
  {
    id: 'plays-2d',
    params: {
      content: 'plays',
      mode: '2d',
      playId: 'brk',
      phase: '1',
      time: '4.6',
      speed: '1',
      playing: 'false',
    },
    readySelector: '.play-workspace',
    requiresCanvas: false,
  },
];
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const results = {};

for (const review of reviews) {
  for (const viewport of viewports) {
    const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    const problems = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

    const reviewUrl = new URL(baseUrl);
    for (const [key, value] of Object.entries(review.params)) {
      reviewUrl.searchParams.set(key, value);
    }
    await page.goto(reviewUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator(review.readySelector).waitFor({ state: 'visible', timeout: 120_000 });
    await page.evaluate(() => document.fonts.ready);

    let canvasPixels = null;
    if (review.requiresCanvas) {
      await page.waitForFunction(() => (
        document.querySelectorAll('.vnext3d-preview-stage canvas').length === 1
        && document.querySelector('[data-testid="vnext-3d-production-preview"]')
          ?.getAttribute('data-player-count') === '12'
      ), undefined, { timeout: 120_000 });
      try {
        await page.waitForFunction(() => Number(
          document.querySelector('[data-testid="vnext-3d-production-preview"]')
            ?.getAttribute('data-frame-sample-count') ?? 0,
        ) >= 60, undefined, { timeout: 20_000 });
      } catch {
        problems.push('runtime: frame telemetry did not reach 60 samples');
      }
      canvasPixels = await analyzePngPixels(
        page,
        await page.locator('.vnext3d-preview-stage canvas').screenshot(),
      );
    }

    const key = `${review.id}-${viewport.id}`;
    const screenshotPath = path.join(
      outputDir,
      `${review.id}-${viewport.id}-${viewport.width}x${viewport.height}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box ? {
          left: Math.round(box.left),
          top: Math.round(box.top),
          right: Math.round(box.right),
          bottom: Math.round(box.bottom),
          width: Math.round(box.width),
          height: Math.round(box.height),
        } : null;
      };
      const brand = document.querySelector('.app-brand-name');
      const body = document.body;
      return {
        bodyWidth: body.scrollWidth,
        viewportWidth: window.innerWidth,
        bodyFont: getComputedStyle(body).fontFamily,
        brandFont: brand ? getComputedStyle(brand).fontFamily : '',
        brand: rect('.app-brand-lockup'),
        actions: rect('.app-header-actions'),
        header: rect('.app-header'),
        workspace: rect('.workspace-switcher'),
        content: rect('.app-content'),
        crestLoaded: Boolean(document.querySelector('.app-brand-crest img')?.complete),
      };
    });
    const passed = problems.length === 0
      && metrics.bodyWidth <= metrics.viewportWidth
      && metrics.crestLoaded
      && metrics.bodyFont.includes('Manrope')
      && metrics.brandFont.includes('Barlow Condensed')
      && metrics.brand?.width > 100
      && metrics.actions?.right <= metrics.viewportWidth
      && metrics.workspace?.right <= metrics.viewportWidth
      && metrics.header?.bottom <= (metrics.content?.top ?? 0) + 1
      && (!review.requiresCanvas || (
        canvasPixels?.sampledPixels > 1000
        && canvasPixels?.lumaRange >= 40
      ));

    results[key] = {
      url: reviewUrl.href,
      viewport: [viewport.width, viewport.height],
      screenshotPath,
      problems,
      canvasPixels,
      metrics,
      passed,
    };

    await context.close();
    await browser.close();
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  passed: Object.values(results).every((result) => result.passed),
  results,
};
await writeFile(
  path.join(outputDir, 'brand-review.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
