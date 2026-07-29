import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'tactical-runtime-reset');
const baseUrl = process.env.TACTICAL_3D_URL ?? 'http://127.0.0.1:55601/';
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
      // Try the next local browser.
    }
  }
  throw new Error('Chrome or Edge was not found for the hidden tactical runtime review.');
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function distanceBetween(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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
      resolve({
        sampledPixels,
        lumaRange: maximumLuma - minimumLuma,
      });
    };
    image.src = dataUrl;
  }), `data:image/png;base64,${pngBuffer.toString('base64')}`);
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];
const results = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    hasTouch: viewport.id === 'mobile',
    isMobile: viewport.id === 'mobile',
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  const reviewUrl = new URL(baseUrl);
  for (const [key, value] of Object.entries({
    content: 'plays',
    mode: '3d',
    playId: 'brk',
    phase: '1',
    time: '4.45',
    speed: '1',
    role: 'LW',
    playing: 'false',
    camera: 'broadcast',
  })) reviewUrl.searchParams.set(key, value);

  await page.goto(reviewUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const preview = page.getByTestId('vnext-3d-production-preview');
  await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction(() => (
    document.querySelectorAll('.vnext3d-preview-stage canvas').length === 1
    && document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-player-count') === '12'
  ), undefined, { timeout: 120_000 });
  try {
    await page.waitForFunction(() => Number(
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-frame-sample-count') ?? 0,
    ) >= 120, undefined, { timeout: 20_000 });
  } catch {
    problems.push('runtime: frame telemetry did not reach 120 samples');
  }

  const phaseButtons = page
    .getByTestId('playback-phase-selector')
    .first()
    .locator('button');
  const phaseNavigation = {
    initialPhase: Number(await preview.getAttribute('data-phase')),
    phaseCount: await phaseButtons.count(),
    labels: await phaseButtons.allTextContents(),
    speedOptions: await page
      .getByTestId('playback-speed')
      .first()
      .locator('option')
      .evaluateAll((options) => options.map((option) => ({
        label: option.textContent,
        value: option.value,
      }))),
    firstPhase: null,
    nextPhase: null,
  };
  await phaseButtons.first().click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-phase') === '0'
  ), undefined, { timeout: 10_000 });
  phaseNavigation.firstPhase = {
    phase: Number(await preview.getAttribute('data-phase')),
    time: Number(await preview.getAttribute('data-replay-time')),
  };
  await phaseButtons.nth(1).click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-phase') === '1'
  ), undefined, { timeout: 10_000 });
  phaseNavigation.nextPhase = {
    phase: Number(await preview.getAttribute('data-phase')),
    time: Number(await preview.getAttribute('data-replay-time')),
  };

  const screenshotPath = path.join(
    outputDir,
    `${viewport.id}-broadcast-receive-${viewport.width}x${viewport.height}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const canvasPixels = await analyzePngPixels(page, await page.locator(
    '.vnext3d-preview-stage canvas',
  ).screenshot());
  await page.locator('[data-testid="playback-timeline"]').evaluate((input) => {
    input.value = '3.1';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-ball-state') === 'flight'
  ), undefined, { timeout: 10_000 });
  const flightScreenshotPath = path.join(
    outputDir,
    `${viewport.id}-broadcast-flight-${viewport.width}x${viewport.height}.png`,
  );
  await page.screenshot({ path: flightScreenshotPath, fullPage: true });

  const cameras = {};
  for (const camera of ['Broadcast', 'Overhead', 'Bench', 'Role']) {
    await page.getByRole('button', { name: camera, exact: true }).click();
    await page.waitForTimeout(180);
    cameras[camera.toLowerCase()] = await preview.getAttribute('data-camera-id');
  }

  await page.getByRole('button', { name: 'Broadcast', exact: true }).click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-camera-position') !== 'pending'
  ), undefined, { timeout: 10_000 });
  const canvas = page.locator('.vnext3d-preview-stage canvas');
  const canvasBox = await canvas.boundingBox();
  const readCameraPose = () => preview.evaluate((node) => ({
    control: node.getAttribute('data-camera-control'),
    gestureMode: node.getAttribute('data-camera-gesture-mode'),
    position: node.getAttribute('data-camera-position').split(',').map(Number),
    target: node.getAttribute('data-camera-target').split(',').map(Number),
  }));
  const initialCameraPose = await readCameraPose();
  if (canvasBox && viewport.id === 'desktop') {
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.58, canvasBox.y + canvasBox.height * 0.52);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.68, canvasBox.y + canvasBox.height * 0.48, { steps: 8 });
    await page.mouse.up({ button: 'left' });
  } else if (canvasBox) {
    const session = await context.newCDPSession(page);
    const centerX = canvasBox.x + canvasBox.width * 0.5;
    const centerY = canvasBox.y + canvasBox.height * 0.52;
    const touch = (id, x, y) => ({
      id,
      x,
      y,
      radiusX: 4,
      radiusY: 4,
      force: 0.7,
      rotationAngle: 0,
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [touch(1, centerX, centerY)],
    });
    for (let step = 1; step <= 8; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [touch(1, centerX + step * 6, centerY - step * 3)],
      });
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  }
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-camera-control') === 'free-look'
  ), undefined, { timeout: 10_000 });
  await page.waitForTimeout(350);
  const orbitCameraPose = await readCameraPose();
  await page.getByRole('button', { name: 'Recenter selected camera angle' }).click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-camera-control') === 'follow'
  ), undefined, { timeout: 10_000 });
  await page.waitForTimeout(500);
  const panStartCameraPose = await readCameraPose();
  if (canvasBox && viewport.id === 'desktop') {
    await page.getByRole('button', { name: 'Pan camera' }).click();
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.52, canvasBox.y + canvasBox.height * 0.52);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.62, canvasBox.y + canvasBox.height * 0.59, { steps: 8 });
    await page.mouse.up({ button: 'left' });
  } else if (canvasBox) {
    const session = await context.newCDPSession(page);
    const centerX = canvasBox.x + canvasBox.width * 0.5;
    const centerY = canvasBox.y + canvasBox.height * 0.52;
    const touch = (id, x, y) => ({
      id,
      x,
      y,
      radiusX: 4,
      radiusY: 4,
      force: 0.7,
      rotationAngle: 0,
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        touch(1, centerX - 34, centerY),
        touch(2, centerX + 34, centerY),
      ],
    });
    for (let step = 1; step <= 8; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          touch(1, centerX - 34 + step * 5, centerY + step * 3),
          touch(2, centerX + 34 + step * 5, centerY + step * 3),
        ],
      });
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  }
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-camera-control') === 'free-look'
  ), undefined, { timeout: 10_000 });
  await page.waitForTimeout(350);
  const panCameraPose = await readCameraPose();
  const cameraGestures = {
    orbitPositionDelta: Number(distanceBetween(
      initialCameraPose.position,
      orbitCameraPose.position,
    ).toFixed(4)),
    orbitTargetDelta: Number(distanceBetween(
      initialCameraPose.target,
      orbitCameraPose.target,
    ).toFixed(4)),
    panPositionDelta: Number(distanceBetween(
      panStartCameraPose.position,
      panCameraPose.position,
    ).toFixed(4)),
    panTargetDelta: Number(distanceBetween(
      panStartCameraPose.target,
      panCameraPose.target,
    ).toFixed(4)),
    panGestureMode: panCameraPose.gestureMode,
  };
  await page.getByRole('button', { name: 'Recenter selected camera angle' }).click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-camera-control') === 'follow'
  ), undefined, { timeout: 10_000 });

  await page.getByRole('button', { name: 'View 3D replay full screen' }).click();
  await page.waitForFunction(() => (
    document.querySelector('.vnext3d-preview-stage')?.classList.contains('is-immersive')
  ), undefined, { timeout: 10_000 });
  const fullscreenState = await page.evaluate(() => {
    const stage = document.querySelector('.vnext3d-preview-stage');
    const transport = stage?.querySelector('.vnext3d-stage-transport');
    const stageRect = stage?.getBoundingClientRect();
    const transportRect = transport?.getBoundingClientRect();
    return {
      transportCount: stage?.querySelectorAll('[data-testid="playback-controls"]').length ?? 0,
      rewindCount: stage?.querySelectorAll('[data-testid="playback-rewind"]').length ?? 0,
      phaseSelectorCount: stage
        ?.querySelectorAll('[data-testid="playback-phase-selector"]').length ?? 0,
      stageCoversViewport: Boolean(
        stageRect
        && stageRect.left <= 1
        && stageRect.top <= 1
        && stageRect.right >= window.innerWidth - 1
        && stageRect.bottom >= window.innerHeight - 1
      ),
      transportInsideViewport: Boolean(
        transportRect
        && transportRect.left >= -1
        && transportRect.right <= window.innerWidth + 1
        && transportRect.bottom <= window.innerHeight + 1
      ),
    };
  });
  const fullscreenScreenshotPath = path.join(
    outputDir,
    `${viewport.id}-fullscreen-controls-${viewport.width}x${viewport.height}.png`,
  );
  await page.screenshot({ path: fullscreenScreenshotPath, fullPage: false });
  await page.getByRole('button', { name: 'Exit full screen 3D replay' }).click();
  await page.waitForFunction(() => (
    !document.querySelector('.vnext3d-preview-stage')?.classList.contains('is-immersive')
  ), undefined, { timeout: 10_000 });

  await page.getByRole('button', { name: 'Replay from start' }).click();
  const samples = await page.evaluate(() => new Promise((resolve) => {
    const frames = [];
    const startedAt = performance.now();
    const sample = (now) => {
      const frame = window.__GOONSQUAD_TACTICAL_FRAME__;
      if (frame) frames.push({ wallTime: now - startedAt, ...frame });
      if (now - startedAt >= 5_250) resolve(frames);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));

  const replaySteps = samples.slice(1).map((sample, index) => (
    sample.time - samples[index].time
  ));
  const ballSteps = samples.slice(1).map((sample, index) => (
    distanceBetween(sample.ballPosition, samples[index].ballPosition)
  ));
  const ballSpeeds = ballSteps.map((step, index) => (
    replaySteps[index] > 0 ? step / replaySteps[index] : 0
  ));
  const layout = await page.evaluate(() => {
    const stage = document.querySelector('.vnext3d-preview-stage')?.getBoundingClientRect();
    const consolePanel = document.querySelector('.vnext3d-preview-console')?.getBoundingClientRect();
    return {
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      stageBottom: stage?.bottom ?? 0,
      consoleTop: consolePanel?.top ?? 0,
    };
  });
  const attributes = await preview.evaluate((node) => Object.fromEntries(
    [...node.attributes]
      .filter((attribute) => attribute.name.startsWith('data-'))
      .map((attribute) => [attribute.name.slice(5), attribute.value]),
  ));

  const metrics = {
    frameCount: samples.length,
    replayStepP95Seconds: Number(percentile(replaySteps, 0.95).toFixed(4)),
    replayStepMaxSeconds: Number(Math.max(...replaySteps).toFixed(4)),
    ballStepP95Meters: Number(percentile(ballSteps, 0.95).toFixed(4)),
    ballStepMaxMeters: Number(Math.max(...ballSteps).toFixed(4)),
    ballSpeedP95Mps: Number(percentile(ballSpeeds, 0.95).toFixed(3)),
    ballSpeedMaxMps: Number(Math.max(...ballSpeeds).toFixed(3)),
    monotonicClock: replaySteps.every((step) => step >= 0),
    playerCountStable: samples.every((sample) => sample.playerCount === 12),
  };
  const passed = problems.length === 0
    && attributes.engine === 'strategy-runtime-v1'
    && Number(attributes['player-count']) === 12
    && attributes['ball-render-mode'] === 'single-authority-flight-streak'
    && Number(attributes['ball-motion-streak-width']) === 0
    && metrics.monotonicClock
    && metrics.playerCountStable
    && metrics.replayStepP95Seconds <= 0.04
    && metrics.replayStepMaxSeconds <= 0.1
    && metrics.ballStepMaxMeters < Math.max(
      0.25,
      metrics.replayStepMaxSeconds * 16,
    )
    && metrics.ballSpeedMaxMps < 16
    && canvasPixels.sampledPixels > 1000
    && canvasPixels.lumaRange >= 40
    && layout.bodyWidth <= layout.viewportWidth
    && layout.stageBottom <= layout.consoleTop + 1
    && fullscreenState.transportCount === 1
    && fullscreenState.rewindCount === 1
    && fullscreenState.phaseSelectorCount === 1
    && fullscreenState.stageCoversViewport
    && fullscreenState.transportInsideViewport
    && phaseNavigation.phaseCount >= 2
    && phaseNavigation.labels.every((label) => label.trim().length > 2)
    && phaseNavigation.firstPhase.phase === 0
    && phaseNavigation.firstPhase.time === 0
    && phaseNavigation.nextPhase.phase === 1
    && phaseNavigation.nextPhase.time > 0
    && phaseNavigation.speedOptions.map(({ value }) => value).join(',') === '0.25,0.5,1'
    && cameraGestures.orbitPositionDelta > 0.5
    && cameraGestures.orbitTargetDelta < 0.15
    && cameraGestures.panPositionDelta > 0.4
    && cameraGestures.panTargetDelta > 0.4
    && cameraGestures.panGestureMode === (viewport.id === 'mobile' ? 'orbit' : 'pan')
    && Object.values(cameras).join(',') === 'broadcast,overhead,bench,player';

  results[viewport.id] = {
    viewport: [viewport.width, viewport.height],
    screenshotPath,
    flightScreenshotPath,
    fullscreenScreenshotPath,
    problems,
    cameras,
    cameraGestures,
    phaseNavigation,
    canvasPixels,
    layout,
    fullscreenState,
    attributes,
    metrics,
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
  path.join(outputDir, 'tactical-runtime.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
