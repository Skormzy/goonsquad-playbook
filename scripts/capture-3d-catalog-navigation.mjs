import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', '3d-catalog-navigation');
const baseUrl = process.env.THREE_D_NAVIGATION_URL ?? 'http://127.0.0.1:55601/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const journeys = [
  {
    id: 'play-desktop',
    content: 'plays',
    viewport: { width: 1440, height: 900 },
    currentId: 'dzfl',
    targetId: 'zent',
    browseLane: 'offence',
    expectedCount: 6,
    search: 'slot',
  },
  {
    id: 'play-mobile',
    content: 'plays',
    viewport: { width: 390, height: 844 },
    currentId: 'brk',
    targetId: 'nfd',
    browseLane: 'defence',
    expectedCount: 6,
    search: 'faceoff',
  },
  {
    id: 'strategy-desktop',
    content: 'strategy',
    viewport: { width: 1440, height: 900 },
    currentId: 'instant-backcheck',
    targetId: 'triangle-spacing',
    browseLane: 'offence',
    expectedCount: 2,
    search: 'boards',
  },
  {
    id: 'strategy-mobile',
    content: 'strategy',
    viewport: { width: 390, height: 844 },
    currentId: 'watch-your-man',
    targetId: 'gap-control',
    browseLane: 'defence',
    expectedCount: 4,
    search: 'control',
  },
];

const laneSequences = {
  play: {
    defence: ['trap', 'dzfl', 'nfd', 'bck', 'pkb', 'pomr'],
    offence: ['brk', 'zent', 'slot-window', 'lcl', 'pts', 'ppum'],
  },
  strategy: {
    defence: ['protect-the-middle', 'watch-your-man', 'gap-control', 'instant-backcheck'],
    offence: ['triangle-spacing', 'cycling-the-boards'],
  },
};

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('Chrome or Edge was not found for the hidden 3D navigation review.');
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
      let sampledPixels = 0;
      let minimumLuma = 255;
      let maximumLuma = 0;
      for (let index = 0; index < pixels.length; index += 64) {
        const luma = Math.round(
          pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722,
        );
        sampledPixels += 1;
        minimumLuma = Math.min(minimumLuma, luma);
        maximumLuma = Math.max(maximumLuma, luma);
      }
      resolve({ sampledPixels, lumaRange: maximumLuma - minimumLuma });
    };
    image.src = dataUrl;
  }), `data:image/png;base64,${pngBuffer.toString('base64')}`);
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll('\\', '/');
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const results = {};

for (const journey of journeys) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({ viewport: journey.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  const itemParam = journey.content === 'strategy' ? 'tacticId' : 'playId';
  const params = {
    content: journey.content,
    mode: '3d',
    [itemParam]: journey.currentId,
    phase: '0',
    time: '0',
    speed: '1',
    role: 'C',
    playing: 'false',
    camera: 'broadcast',
  };
  if (journey.content === 'strategy') params.scenario = 'correct';
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const preview = page.getByTestId('vnext-3d-production-preview');
  await preview.waitFor({ state: 'visible', timeout: 120_000 });
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-player-count') === '12'
    && document.querySelectorAll('.vnext3d-preview-stage canvas').length === 1
  ), undefined, { timeout: 120_000 });
  await page.locator('.vnext3d-loading-state').waitFor({ state: 'detached', timeout: 120_000 });
  await page.waitForTimeout(250);
  await page.evaluate(() => document.fonts.ready);

  const canvasPixels = await analyzePngPixels(
    page,
    await page.locator('.vnext3d-preview-stage canvas').screenshot(),
  );
  const navigator = page.getByTestId('vnext3d-catalog-navigator');
  const toggle = page.getByTestId('vnext3d-catalog-toggle');
  const initialDockText = await toggle.innerText();
  const collapsedScreenshotPath = path.join(outputDir, `${journey.id}-collapsed.png`);
  await page.screenshot({ path: collapsedScreenshotPath, fullPage: false });
  const initialMetrics = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      } : null;
    };
    const overlaps = (a, b) => Boolean(
      a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    );
    const dock = rect('.vnext3d-sequence-dock');
    const presets = rect('.vnext3d-stage-camera-presets');
    const operator = rect('.vnext3d-camera-operator');
    return {
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      dock,
      presets,
      operator,
      dockOverlapsPresets: overlaps(dock, presets),
      dockOverlapsOperator: overlaps(dock, operator),
    };
  });

  await toggle.click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext3d-catalog-toggle"]')
      ?.getAttribute('aria-expanded') === 'true'
  ));
  await page.waitForFunction(() => Math.abs(
    document.querySelector('.vnext3d-catalog-drawer')?.getBoundingClientRect().left ?? -999,
  ) <= 0.5);
  const drawer = page.getByTestId('vnext3d-catalog-drawer');
  await drawer.locator(`[data-lane="${journey.browseLane}"]`).click();
  await page.waitForFunction(({ lane, count }) => (
    document.querySelector('.vnext3d-catalog-drawer .curriculum-lane-switch')
      ?.getAttribute('data-curriculum-lane') === lane
    && document.querySelectorAll('.vnext3d-catalog-drawer [data-item-id]').length === count
  ), { lane: journey.browseLane, count: journey.expectedCount });
  await page.waitForTimeout(200);
  const itemCount = await drawer.locator('[data-item-id]').count();
  const expandedScreenshotPath = path.join(outputDir, `${journey.id}-library.png`);
  await page.screenshot({ path: expandedScreenshotPath, fullPage: false });

  const search = drawer.getByRole('searchbox');
  await search.fill(journey.search);
  const filteredCount = await drawer.locator('[data-item-id]').count();
  await drawer.getByRole('button', { name: /Clear .* search/ }).click();
  await drawer.locator(`[data-item-id="${journey.targetId}"]`).click();
  if (journey.viewport.width > 760) {
    await drawer.getByRole('button', { name: /Close .* library/ }).click();
  }
  await page.waitForFunction(({ parameter, value }) => (
    new URL(window.location.href).searchParams.get(parameter) === value
  ), { parameter: itemParam, value: journey.targetId }, { timeout: 10_000 });

  const kind = journey.content === 'strategy' ? 'strategy' : 'play';
  const targetSequence = laneSequences[kind][journey.browseLane];
  const targetIndex = targetSequence.indexOf(journey.targetId);
  const expectedNextId = targetSequence[targetIndex + 1];

  await navigator.locator('.vnext3d-sequence-step').last().click();
  await page.waitForFunction(({ parameter, value }) => (
    new URL(window.location.href).searchParams.get(parameter) === value
  ), { parameter: itemParam, value: expectedNextId }, { timeout: 10_000 });
  await page.keyboard.press('[');
  await page.waitForFunction(({ parameter, value }) => (
    new URL(window.location.href).searchParams.get(parameter) === value
  ), { parameter: itemParam, value: journey.targetId }, { timeout: 10_000 });

  await page.getByRole('button', { name: 'View 3D replay full screen' }).click();
  await page.waitForFunction(() => (
    document.querySelector('.vnext3d-preview-stage')?.classList.contains('is-immersive')
  ));
  const fullscreenNavigatorCount = await page.locator(
    '.vnext3d-preview-stage [data-testid="vnext3d-catalog-navigator"]',
  ).count();
  await toggle.click();
  await page.waitForFunction(() => Math.abs(
    document.querySelector('.vnext3d-catalog-drawer')?.getBoundingClientRect().left ?? -999,
  ) <= 0.5);
  await page.waitForTimeout(200);
  const fullscreenDrawerCount = await drawer.locator('[data-item-id]').count();
  const fullscreenScreenshotPath = path.join(outputDir, `${journey.id}-fullscreen-library.png`);
  await page.screenshot({ path: fullscreenScreenshotPath, fullPage: false });
  const fullscreenMetrics = await page.evaluate(() => {
    const stage = document.querySelector('.vnext3d-preview-stage')?.getBoundingClientRect();
    const drawerBox = document.querySelector('.vnext3d-catalog-drawer')?.getBoundingClientRect();
    const transport = document.querySelector('.vnext3d-stage-transport')?.getBoundingClientRect();
    return {
      stage: stage ? {
        left: stage.left,
        top: stage.top,
        right: stage.right,
        bottom: stage.bottom,
      } : null,
      drawer: drawerBox ? {
        left: drawerBox.left,
        top: drawerBox.top,
        right: drawerBox.right,
        bottom: drawerBox.bottom,
      } : null,
      stageCoversViewport: Boolean(
        stage
        && stage.left <= 1
        && stage.top <= 1
        && stage.right >= window.innerWidth - 1
        && stage.bottom >= window.innerHeight - 1
      ),
      drawerInsideViewport: Boolean(
        drawerBox
        && drawerBox.left >= -1
        && drawerBox.top >= -1
        && drawerBox.right <= window.innerWidth + 1
        && drawerBox.bottom <= window.innerHeight + 1
      ),
      transportInsideViewport: Boolean(
        transport
        && transport.left >= -1
        && transport.right <= window.innerWidth + 1
        && transport.bottom <= window.innerHeight + 1
      ),
    };
  });
  await drawer.getByRole('button', { name: /Close .* library/ }).click();
  await page.getByRole('button', { name: 'Exit full screen 3D replay' }).click();

  const finalUrl = new URL(page.url());
  const passed = problems.length === 0
    && initialDockText.length > 0
    && itemCount === journey.expectedCount
    && filteredCount > 0
    && filteredCount < itemCount
    && finalUrl.searchParams.get(itemParam) === journey.targetId
    && Number(await preview.getAttribute('data-player-count')) === 12
    && canvasPixels.sampledPixels > 1000
    && canvasPixels.lumaRange >= 40
    && initialMetrics.bodyWidth <= initialMetrics.viewportWidth
    && !initialMetrics.dockOverlapsPresets
    && !initialMetrics.dockOverlapsOperator
    && fullscreenNavigatorCount === 1
    && fullscreenDrawerCount === journey.expectedCount
    && fullscreenMetrics.stageCoversViewport
    && fullscreenMetrics.drawerInsideViewport
    && fullscreenMetrics.transportInsideViewport;

  results[journey.id] = {
    url: url.href,
    viewport: [journey.viewport.width, journey.viewport.height],
    initialDockText,
    itemCount,
    filteredCount,
    finalItemId: finalUrl.searchParams.get(itemParam),
    playerCount: Number(await preview.getAttribute('data-player-count')),
    canvasPixels,
    initialMetrics,
    fullscreenNavigatorCount,
    fullscreenDrawerCount,
    fullscreenMetrics,
    problems,
    screenshots: {
      collapsed: relative(collapsedScreenshotPath),
      expanded: relative(expandedScreenshotPath),
      fullscreen: relative(fullscreenScreenshotPath),
    },
    passed,
  };

  await context.close();
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  passed: Object.values(results).every((result) => result.passed),
  results,
};

await writeFile(
  path.join(outputDir, '3d-catalog-navigation.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
