import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'faceoff-outcomes');
const baseUrl = process.env.FACEOFF_QA_URL ?? 'http://127.0.0.1:55601/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const journeys = [
  { id: '2d-desktop', mode: '2d', viewport: { width: 1440, height: 900 } },
  { id: '2d-mobile', mode: '2d', viewport: { width: 390, height: 844 } },
  { id: '3d-desktop', mode: '3d', viewport: { width: 1440, height: 900 } },
  { id: '3d-mobile', mode: '3d', viewport: { width: 390, height: 844 } },
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
  throw new Error('Chrome or Edge was not found for hidden faceoff review.');
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll('\\', '/');
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
      for (let index = 0; index < pixels.length; index += 64) {
        const luma = Math.round(
          pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722,
        );
        minimumLuma = Math.min(minimumLuma, luma);
        maximumLuma = Math.max(maximumLuma, luma);
      }
      resolve({ lumaRange: maximumLuma - minimumLuma });
    };
    image.src = dataUrl;
  }), `data:image/png;base64,${pngBuffer.toString('base64')}`);
}

async function seekToSecuredDraw(page) {
  const namedPhaseButton = page.getByTestId('playback-phase-2').first();
  if (await namedPhaseButton.count()) {
    await namedPhaseButton.click();
    return;
  }
  await page.getByRole('button', { name: /^Go to phase 3:/ }).first().click();
}

async function waitForJourney(page, journey) {
  await page.getByTestId('faceoff-outcome-control').waitFor({ state: 'visible', timeout: 60_000 });
  if (journey.mode === '3d') {
    const preview = page.getByTestId('vnext-3d-production-preview');
    await preview.waitFor({ state: 'visible', timeout: 120_000 });
    await page.waitForFunction(() => (
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-player-count') === '12'
      && document.querySelectorAll('.vnext3d-preview-stage canvas').length === 1
    ), undefined, { timeout: 120_000 });
    await page.waitForTimeout(2_000);
    await page.locator('.vnext3d-loading-state').waitFor({ state: 'hidden', timeout: 120_000 });
  } else {
    await page.locator('.play-workspace').waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('.play-rink-frame svg').waitFor({ state: 'visible', timeout: 60_000 });
  }
  await page.evaluate(() => document.fonts.ready);
}

async function waitForOutcome(page, mode, outcome) {
  const expectedOwner = mode === '3d'
    ? (outcome === 'won' ? 'US_LD' : 'OP_RD')
    : (outcome === 'won' ? 'US_LD' : 'OP_RD');
  await page.waitForFunction(({ requestedMode, requestedOutcome, owner }) => {
    const control = document.querySelector('[data-testid="faceoff-outcome-control"]');
    const activeButton = control?.querySelector(`button[data-outcome="${requestedOutcome}"]`);
    const stateMatches = control?.getAttribute('data-faceoff-outcome') === requestedOutcome
      && activeButton?.getAttribute('aria-pressed') === 'true';
    if (!stateMatches) return false;
    if (requestedMode === '3d') {
      const preview = document.querySelector('[data-testid="vnext-3d-production-preview"]');
      return preview?.getAttribute('data-faceoff-outcome') === requestedOutcome
        && preview?.getAttribute('data-ball-owner') === owner;
    }
    return document.querySelector('.play-rink-frame svg')?.getAttribute('data-ball-owner') === owner;
  }, { requestedMode: mode, requestedOutcome: outcome, owner: expectedOwner }, { timeout: 60_000 });
}

async function inspectPage(page, journey, outcome) {
  return page.evaluate(({ requestedMode, requestedOutcome }) => {
    const control = document.querySelector('[data-testid="faceoff-outcome-control"]');
    const rect = control?.getBoundingClientRect();
    const replay = requestedMode === '3d'
      ? document.querySelector('[data-testid="vnext-3d-production-preview"]')
      : document.querySelector('.play-rink-frame svg');
    return {
      mode: requestedMode,
      outcome: requestedOutcome,
      activeOutcome: control?.getAttribute('data-faceoff-outcome'),
      ballOwner: replay?.getAttribute('data-ball-owner'),
      sceneOutcome: replay?.getAttribute('data-faceoff-outcome') ?? requestedOutcome,
      playerCount: requestedMode === '3d' ? Number(replay?.getAttribute('data-player-count')) : 12,
      canvasCount: requestedMode === '3d'
        ? document.querySelectorAll('.vnext3d-preview-stage canvas').length
        : 0,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      controlInsideViewport: Boolean(rect)
        && rect.left >= -1
        && rect.right <= window.innerWidth + 1
        && rect.top >= -1
        && rect.bottom <= window.innerHeight + 1,
      urlOutcome: new URL(window.location.href).searchParams.get('faceoff') ?? 'won',
    };
  }, { requestedMode: journey.mode, requestedOutcome: outcome });
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
  for (const [key, value] of Object.entries({
    content: 'plays',
    mode: journey.mode,
    playId: 'dzfl',
    phase: '0',
    time: '0',
    speed: '1',
    role: 'C',
    playing: 'false',
    camera: 'broadcast',
  })) url.searchParams.set(key, value);

  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForJourney(page, journey);
  await seekToSecuredDraw(page);
  await waitForOutcome(page, journey.mode, 'won');

  const wonImage = path.join(outputDir, `${journey.id}-won.png`);
  await page.screenshot({ path: wonImage, fullPage: false });
  const won = await inspectPage(page, journey, 'won');
  if (journey.mode === '3d') {
    const pixels = await analyzePngPixels(page, await page.locator('.vnext3d-preview-stage canvas').screenshot());
    won.canvasLumaRange = pixels.lumaRange;
  }

  await page.getByRole('button', { name: 'Lost' }).click();
  await seekToSecuredDraw(page);
  await waitForOutcome(page, journey.mode, 'lost');

  const lostImage = path.join(outputDir, `${journey.id}-lost.png`);
  await page.screenshot({ path: lostImage, fullPage: false });
  const lost = await inspectPage(page, journey, 'lost');
  if (journey.mode === '3d') {
    const pixels = await analyzePngPixels(page, await page.locator('.vnext3d-preview-stage canvas').screenshot());
    lost.canvasLumaRange = pixels.lumaRange;
  }

  await page.getByRole('button', { name: 'Won' }).click();
  await seekToSecuredDraw(page);
  await waitForOutcome(page, journey.mode, 'won');

  const failures = [won, lost].flatMap((state) => [
    state.playerCount !== 12 ? `${state.outcome}: expected 12 players` : null,
    journey.mode === '3d' && state.canvasCount !== 1 ? `${state.outcome}: expected one 3D canvas` : null,
    journey.mode === '3d' && state.canvasLumaRange < 35
      ? `${state.outcome}: 3D canvas luma range ${state.canvasLumaRange}`
      : null,
    state.horizontalOverflow > 1 ? `${state.outcome}: horizontal overflow ${state.horizontalOverflow}px` : null,
    !state.controlInsideViewport ? `${state.outcome}: result control is outside the viewport` : null,
    state.activeOutcome !== state.outcome ? `${state.outcome}: control state mismatch` : null,
    state.sceneOutcome !== state.outcome ? `${state.outcome}: scene state mismatch` : null,
    state.urlOutcome !== state.outcome ? `${state.outcome}: URL state mismatch` : null,
  ]).filter(Boolean);
  failures.push(...problems);

  results[journey.id] = {
    viewport: [journey.viewport.width, journey.viewport.height],
    won: { ...won, screenshot: relative(wonImage) },
    lost: { ...lost, screenshot: relative(lostImage) },
    problems,
  };

  await context.close();
  await browser.close();
  if (failures.length) throw new Error(`${journey.id}: ${failures.join('; ')}`);
}

const reportPath = path.join(outputDir, 'report.json');
await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ report: relative(reportPath), journeys: Object.keys(results) }, null, 2));
