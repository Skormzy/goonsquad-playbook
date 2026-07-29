import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'replay-product-audit');
const baseUrl = process.env.REPLAY_PRODUCT_URL ?? 'http://127.0.0.1:55601/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const journeys = [
  { id: 'desktop-play', width: 1440, height: 900, content: 'plays', itemId: 'brk' },
  { id: 'laptop-faceoff-lost', width: 1280, height: 800, content: 'plays', itemId: 'dzfl', faceoff: 'lost' },
  { id: 'tablet-strategy', width: 820, height: 1180, content: 'strategy', itemId: 'instant-backcheck' },
  { id: 'mobile-play', width: 390, height: 844, content: 'plays', itemId: 'dzfl', touch: true },
  { id: 'compact-strategy', width: 360, height: 800, content: 'strategy', itemId: 'watch-your-man', touch: true },
  { id: 'landscape-play', width: 844, height: 390, content: 'plays', itemId: 'brk', touch: true },
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
  throw new Error('Chrome or Edge was not found for the hidden replay product audit.');
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll('\\', '/');
}

function buildUrl(journey) {
  const url = new URL(baseUrl);
  const params = {
    content: journey.content,
    mode: '3d',
    phase: '0',
    time: '0',
    speed: '1',
    role: 'C',
    playing: 'false',
    camera: 'broadcast',
  };
  if (journey.content === 'strategy') {
    params.tacticId = journey.itemId;
    params.scenario = 'correct';
  } else {
    params.playId = journey.itemId;
    if (journey.faceoff === 'lost') params.faceoff = 'lost';
  }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function waitForReplay(page) {
  const preview = page.getByTestId('vnext-3d-production-preview');
  await preview.waitFor({ state: 'visible', timeout: 120_000 });
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-player-count') === '12'
    && document.querySelectorAll('.vnext3d-preview-stage canvas').length === 1
  ), undefined, { timeout: 120_000 });
  await page.locator('.vnext3d-loading-state').waitFor({ state: 'detached', timeout: 120_000 });
  await page.waitForFunction(() => Number(
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-frame-sample-count') ?? 0,
  ) >= 60, undefined, { timeout: 120_000 });
  return preview;
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box ? {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        centerX: box.left + box.width / 2,
        centerY: box.top + box.height / 2,
      } : null;
    };
    const rowNode = document.querySelector('.vnext3d-preview-transport .playback-transport-row');
    const clusterNode = rowNode?.querySelector('.playback-transport-buttons');
    const speedNode = rowNode?.querySelector('.playback-speed-control select');
    const row = rect(rowNode);
    const cluster = rect(clusterNode);
    const speed = rect(speedNode);
    const buttons = [...(clusterNode?.querySelectorAll('button') ?? [])].map(rect);
    const centers = [...buttons, speed].filter(Boolean).map(({ centerY }) => centerY);
    const browse = document.querySelector('[data-testid="vnext3d-browse-cue"]');
    const browseBox = rect(browse);
    const stage = rect(document.querySelector('.vnext3d-preview-stage'));
    const timeline = rect(document.querySelector(
      '.vnext3d-preview-transport [data-testid="playback-timeline"]',
    ));
    const overlap = (first, second) => Boolean(
      first && second
      && first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      row,
      cluster,
      speed,
      buttons,
      timeline,
      stage,
      centeredDelta: row && cluster ? Math.abs(row.centerX - cluster.centerX) : 999,
      controlCenterSpread: centers.length > 0 ? Math.max(...centers) - Math.min(...centers) : 999,
      minimumControlHeight: Math.min(...[...buttons, speed].filter(Boolean).map(({ height }) => height)),
      clusterOverlapsSpeed: overlap(cluster, speed),
      browseText: browse?.textContent?.trim() ?? '',
      browseVisible: Boolean(browseBox && browseBox.width > 0 && browseBox.height > 0),
      browseClipped: Boolean(browse && browse.scrollWidth > browse.clientWidth + 1),
    };
  });
}

async function samplePlayback(page) {
  const preview = page.getByTestId('vnext-3d-production-preview');
  const startTime = Number(await preview.getAttribute('data-replay-time'));
  await page.getByTestId('playback-play-toggle').click();
  const samples = await page.evaluate(() => new Promise((resolve) => {
    const values = [];
    const startedAt = performance.now();
    const sample = (now) => {
      const node = document.querySelector('[data-testid="vnext-3d-production-preview"]');
      values.push({
        wallTime: now - startedAt,
        replayTime: Number(node?.getAttribute('data-replay-time') ?? 0),
        playerCount: Number(node?.getAttribute('data-player-count') ?? 0),
        ballState: node?.getAttribute('data-ball-state') ?? 'missing',
      });
      if (now - startedAt >= 2_200) resolve(values);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  await page.getByTestId('playback-play-toggle').click();
  const changed = samples.filter((sample, index) => (
    index === 0 || sample.replayTime !== samples[index - 1].replayTime
  ));
  const steps = changed.slice(1).map((sample, index) => sample.replayTime - changed[index].replayTime);
  const finalTime = samples.at(-1)?.replayTime ?? startTime;
  return {
    renderedSamples: samples.length,
    uniqueReplaySamples: changed.length,
    startTime,
    finalTime,
    advance: Number((finalTime - startTime).toFixed(3)),
    maximumStepMs: Number((Math.max(0, ...steps) * 1000).toFixed(2)),
    p95StepMs: Number((percentile(steps, 0.95) * 1000).toFixed(2)),
    monotonic: steps.every((step) => step >= 0),
    allTwelvePlayers: samples.every(({ playerCount }) => playerCount === 12),
    observedBallStates: [...new Set(samples.map(({ ballState }) => ballState))],
    frameP95Ms: Number(await preview.getAttribute('data-frame-p95-ms')),
  };
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const results = {};

for (const journey of journeys) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: journey.width, height: journey.height },
    deviceScaleFactor: 1,
    hasTouch: Boolean(journey.touch),
  });
  const page = await context.newPage();
  const browserProblems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserProblems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`));

  const url = buildUrl(journey);
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const preview = await waitForReplay(page);
  await page.evaluate(() => document.fonts.ready);
  const layout = await measureLayout(page);
  const playback = await samplePlayback(page);

  const cameraResults = {};
  for (const camera of ['Broadcast', 'Overhead', 'Bench', 'Role']) {
    await page.getByRole('button', { name: camera, exact: true }).click();
    const expected = camera === 'Role' ? 'player' : camera.toLowerCase();
    await page.waitForFunction((cameraId) => (
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-camera-id') === cameraId
    ), expected);
    cameraResults[expected] = await preview.getAttribute('data-camera-id');
  }
  await page.getByRole('button', { name: 'Broadcast', exact: true }).click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-camera-id') === 'broadcast'
  ));

  const toggle = page.getByTestId('vnext3d-catalog-toggle');
  const toggleLabel = await toggle.getAttribute('aria-label');
  await toggle.click();
  const drawer = page.getByTestId('vnext3d-catalog-drawer');
  await drawer.waitFor({ state: 'visible' });
  await page.waitForFunction(() => Math.abs(
    document.querySelector('.vnext3d-catalog-drawer')?.getBoundingClientRect().left ?? -999,
  ) <= 0.5);
  const drawerMetrics = await drawer.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      itemCount: node.querySelectorAll('[data-item-id]').length,
      insideViewport: box.left >= -1
        && box.top >= -1
        && box.right <= window.innerWidth + 1
        && box.bottom <= window.innerHeight + 1,
    };
  });
  await drawer.getByRole('button', { name: /Close .* library/ }).click();
  await page.waitForFunction(() => (
    (document.querySelector('.vnext3d-catalog-drawer')?.getBoundingClientRect().right ?? 999) <= 0.5
  ));

  const screenshotPath = path.join(outputDir, `${journey.id}-${journey.width}x${journey.height}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const minimumExpectedHeight = journey.touch ? 40 : 32;
  const expectedItems = journey.content === 'strategy' ? 6 : 12;
  const passed = browserProblems.length === 0
    && Number(await preview.getAttribute('data-player-count')) === 12
    && layout.bodyWidth <= layout.viewportWidth + 1
    && (journey.height > 520 || layout.stage?.height >= 240)
    && layout.centeredDelta <= 1
    && layout.controlCenterSpread <= 1
    && layout.minimumControlHeight >= minimumExpectedHeight
    && !layout.clusterOverlapsSpeed
    && layout.browseVisible
    && !layout.browseClipped
    && /^BROWSE/.test(layout.browseText)
    && /Browse all/.test(toggleLabel ?? '')
    && drawerMetrics.itemCount === expectedItems
    && drawerMetrics.insideViewport
    && playback.advance >= 1.7
    && playback.uniqueReplaySamples >= 20
    && playback.maximumStepMs <= 180
    && playback.monotonic
    && playback.allTwelvePlayers
    && playback.frameP95Ms <= 50
    && Object.entries(cameraResults).every(([expected, actual]) => expected === actual);

  results[journey.id] = {
    viewport: [journey.width, journey.height],
    url: url.href,
    playerCount: Number(await preview.getAttribute('data-player-count')),
    layout,
    playback,
    cameraResults,
    toggleLabel,
    drawerMetrics,
    browserProblems,
    screenshot: relative(screenshotPath),
    passed,
  };

  await context.close();
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  passed: Object.values(results).every(({ passed }) => passed),
  results,
};

await writeFile(
  path.join(outputDir, 'replay-product-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify({
  generatedAt: report.generatedAt,
  passed: report.passed,
  results: Object.fromEntries(Object.entries(results).map(([id, result]) => [id, {
    passed: result.passed,
    viewport: result.viewport,
    centeredDelta: result.layout.centeredDelta,
    minimumControlHeight: result.layout.minimumControlHeight,
    replayStepMaximumMs: result.playback.maximumStepMs,
    frameP95Ms: result.playback.frameP95Ms,
    browserProblems: result.browserProblems,
  }])),
}, null, 2));
if (!report.passed) process.exitCode = 1;
