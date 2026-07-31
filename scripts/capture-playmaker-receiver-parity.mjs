import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';
import { createPlaymakerDraft, PLAYMAKER_ROSTER } from '../src/playmaker/playmakerModel.js';

const PLAYMAKER_STORAGE_KEY = 'gs_playmaker_drafts_v1';
const PLAYMAKER_ACTIVE_KEY = 'gs_playmaker_active_v1';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'playmaker-receiver-parity');
const baseUrl = process.env.PLAYMAKER_PARITY_URL ?? 'http://127.0.0.1:55601/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
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
  throw new Error('Chrome or Edge was not found for the hidden Playmaker parity review.');
}

function authoredRightWingerPass() {
  const draft = createPlaymakerDraft('breakout');
  draft.id = 'qa-right-winger-pass';
  draft.title = 'Right winger receiver parity';
  draft.description = 'Center moves the ball to the right winger without changing receiver identity.';
  draft.frames[0].label = 'Center reads pressure';
  draft.frames[1].label = 'Right winger receives';
  draft.frames[1].ball.transition = 'carry';
  draft.frames[1].ball.receiverId = 'US_C';
  draft.frames[1].ball.ownerId = 'US_C';
  PLAYMAKER_ROSTER.forEach((player, index) => {
    const destination = draft.frames[1].players[player.id];
    destination.x = Math.min(98, destination.x + (index % 2 === 0 ? 1.4 : -1.4));
    destination.y = Math.min(98, destination.y + (player.team === 'us' ? 2.4 : -1.8));
    destination.action = player.id === 'US_RW' ? 'receive' : player.id === 'US_C' ? 'pass' : 'support';
  });
  return draft;
}

async function analyzeCanvas(page) {
  const pngBuffer = await page.locator('.playmaker-3d-stage canvas').screenshot();
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

async function screenshot(page, viewport, name) {
  const outputPath = path.join(outputDir, `${viewport.id}-${name}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: outputPath, fullPage: false });
  return path.relative(root, outputPath).replaceAll('\\', '/');
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const draft = authoredRightWingerPass();
const results = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  await context.addInitScript(({ activeKey, draftValue, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify([draftValue]));
    localStorage.setItem(activeKey, draftValue.id);
  }, {
    activeKey: PLAYMAKER_ACTIVE_KEY,
    draftValue: draft,
    storageKey: PLAYMAKER_STORAGE_KEY,
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  url.searchParams.set('qaTeamAccess', '1');
  url.searchParams.set('content', 'playmaker');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.playmaker-workspace').waitFor({ state: 'visible', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);

  await page.getByLabel('Decision into next moment').selectOption('pass');
  await page.getByLabel('Receiver').selectOption('US_RW');

  const decision = page.getByTestId('playmaker-ball-decision');
  await decision.waitFor({ state: 'visible' });
  const twoDimensionalState = await decision.evaluate((node) => ({
    from: node.getAttribute('data-from-player-id'),
    receiver: node.getAttribute('data-receiver-id'),
    label: node.textContent.trim(),
  }));
  await page.locator('.playmaker-moments button').filter({ hasText: 'Right winger receives' }).click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="playmaker-ball-decision"]')
      ?.getAttribute('data-receiver-id') === 'US_RW'
  ));
  twoDimensionalState.destinationMomentReceiver = await decision.getAttribute('data-receiver-id');
  const twoDimensionalScreenshot = await screenshot(page, viewport, '2d-right-winger-pass');

  await page.getByLabel('Carrier at this moment').selectOption('');
  const looseBall = page.getByTestId('playmaker-loose-ball');
  await looseBall.waitFor({ state: 'visible' });
  const looseBallStart = await looseBall.boundingBox();
  const looseBallTarget = await looseBall.evaluate((node, rinkPosition) => {
    const svg = node.ownerSVGElement;
    const point = svg.createSVGPoint();
    point.x = rinkPosition.x;
    point.y = 200 - rinkPosition.y * 2;
    const screenPoint = point.matrixTransform(svg.getScreenCTM());
    return { x: screenPoint.x, y: screenPoint.y };
  }, { x: 73, y: 41 });
  await page.mouse.move(
    looseBallStart.x + looseBallStart.width / 2,
    looseBallStart.y + looseBallStart.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(looseBallTarget.x, looseBallTarget.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="playmaker-loose-ball"]');
    return Math.abs(Number(node?.getAttribute('data-rink-x')) - 73) < 0.25
      && Math.abs(Number(node?.getAttribute('data-rink-y')) - 41) < 0.25;
  });
  const looseBallDrag = await looseBall.evaluate((node) => ({
    x: Number(node.getAttribute('data-rink-x')),
    y: Number(node.getAttribute('data-rink-y')),
  }));
  looseBallDrag.widthInput = Number(await page.getByLabel('Ball width').inputValue());
  looseBallDrag.depthInput = Number(await page.getByLabel('Ball depth').inputValue());
  looseBallDrag.screenshot = await screenshot(page, viewport, '2d-loose-ball-drag');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="playmaker-ball-decision"]')
      ?.getAttribute('data-receiver-id') === 'US_RW'
  ));

  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const stage = page.locator('.playmaker-3d-stage');
  await stage.waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction(() => (
    document.querySelector('.playmaker-3d-stage')?.getAttribute('data-player-count') === '12'
    && document.querySelector('.playmaker-3d-stage')?.getAttribute('data-ball-to') === 'US_RW'
  ), undefined, { timeout: 120_000 });
  await page.locator('.playmaker-3d-cameras button[aria-pressed="true"]').waitFor();

  const cameraParity = {};
  for (const camera of ['Overhead', 'Broadcast', 'Bench', 'Role']) {
    await page.getByRole('button', { name: camera, exact: true }).click();
    await page.waitForTimeout(120);
    cameraParity[camera] = await stage.evaluate((node) => ({
      from: node.getAttribute('data-ball-from'),
      receiver: node.getAttribute('data-ball-to'),
      segment: node.getAttribute('data-ball-segment'),
    }));
  }
  await page.getByRole('button', { name: 'Overhead', exact: true }).click();
  await page.locator('input[aria-label="Play timeline"]').evaluate((node) => {
    node.value = '1.45';
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(800);

  const threeDimensionalState = await stage.evaluate((node) => ({
    from: node.getAttribute('data-ball-from'),
    owner: node.getAttribute('data-ball-owner'),
    playerCount: Number(node.getAttribute('data-player-count')),
    receiver: node.getAttribute('data-ball-to'),
    segment: node.getAttribute('data-ball-segment'),
  }));
  const activeCamera = await page.locator('.playmaker-3d-cameras button[aria-pressed="true"]').textContent();
  const ballRead = (await page.getByTestId('playmaker-3d-ball-read').textContent()).replace(/\s+/gu, ' ').trim();
  const canvas = await analyzeCanvas(page);
  const layout = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  const threeDimensionalScreenshot = await screenshot(page, viewport, '3d-right-winger-pass');
  const cameraChecksPassed = Object.values(cameraParity).every((state) => (
    state.from === 'US_C' && state.receiver === 'US_RW' && state.segment === 'pass'
  ));
  const passed = problems.length === 0
    && twoDimensionalState.from === 'US_C'
    && twoDimensionalState.receiver === 'US_RW'
    && twoDimensionalState.destinationMomentReceiver === 'US_RW'
    && twoDimensionalState.label.includes('C to RW')
    && Math.abs(looseBallDrag.x - 73) < 0.25
    && Math.abs(looseBallDrag.y - 41) < 0.25
    && looseBallDrag.widthInput === 73
    && looseBallDrag.depthInput === 41
    && threeDimensionalState.from === 'US_C'
    && threeDimensionalState.receiver === 'US_RW'
    && threeDimensionalState.segment === 'pass'
    && threeDimensionalState.playerCount === 12
    && activeCamera.trim() === 'Overhead'
    && ballRead.includes('PASS')
    && ballRead.includes('C')
    && ballRead.includes('RW')
    && cameraChecksPassed
    && canvas.sampledPixels > 1000
    && canvas.lumaRange >= 40
    && layout.bodyWidth <= layout.viewportWidth;

  results[viewport.id] = {
    viewport: [viewport.width, viewport.height],
    screenshots: {
      twoDimensional: twoDimensionalScreenshot,
      looseBall: looseBallDrag.screenshot,
      threeDimensional: threeDimensionalScreenshot,
    },
    looseBallDrag,
    twoDimensionalState,
    threeDimensionalState,
    activeCamera: activeCamera.trim(),
    ballRead,
    cameraParity,
    canvas,
    layout,
    problems,
    authoredThroughControls: true,
    passed,
  };

  await context.close();
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  headless: true,
  visibleBrowserWindowOpened: false,
  receiverContract: { from: 'US_C', to: 'US_RW' },
  passed: Object.values(results).every((result) => result.passed),
  results,
};
await writeFile(
  path.join(outputDir, 'playmaker-receiver-parity.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
