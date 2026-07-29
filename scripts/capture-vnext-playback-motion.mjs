import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'strategy-first-standard-breakout');
const baseUrl = process.env.VNEXT_MOTION_URL ?? 'http://127.0.0.1:55601/';
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
  throw new Error('Chrome or Edge was not found for the headless motion review.');
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function waitForReplayReady(page) {
  await page.waitForFunction(() => (
    document.querySelectorAll('.vnext3d-preview-stage canvas').length === 1
    && document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-player-count') === '12'
  ), undefined, { timeout: 120_000 });
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const viewports = [
  { id: 'desktop', width: 1280, height: 720 },
  { id: 'mobile', width: 390, height: 844 },
];
const tacticalCameras = ['broadcast', 'overhead', 'bench', 'player'];
const cameraLabels = {
  broadcast: 'Broadcast',
  overhead: 'Overhead',
  bench: 'Bench',
  player: 'Role',
};
const results = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries({
    content: 'plays',
    mode: '3d',
    playId: 'brk',
    phase: '0',
    time: '0',
    speed: '2',
    role: 'LW',
    playing: 'false',
    camera: 'broadcast',
  })) url.searchParams.set(key, value);

  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const preview = page.getByTestId('vnext-3d-production-preview');
  await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await waitForReplayReady(page);
  await page.waitForFunction(() => Number(
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-frame-sample-count') ?? 0,
  ) >= 60, undefined, { timeout: 120_000 });
  await page.getByRole('button', { name: 'Play replay' }).click();

  const samples = await page.evaluate(() => new Promise((resolve) => {
    const values = [];
    const startedAt = performance.now();
    const sample = (now) => {
      const node = document.querySelector('[data-testid="vnext-3d-production-preview"]');
      values.push({
        wallTime: now - startedAt,
        replayTime: Number(node?.getAttribute('data-replay-time') ?? 0),
        ballX: Number(node?.getAttribute('data-ball-x') ?? 0),
        ballY: Number(node?.getAttribute('data-ball-y') ?? 0),
        ballOwner: node?.getAttribute('data-ball-owner'),
        ballSegment: node?.getAttribute('data-ball-segment'),
        ballBoardPhase: node?.getAttribute('data-ball-board-phase'),
        ballWorldHeight: Number(node?.getAttribute('data-ball-world-height') ?? 0),
        ballMotionStreakWidth: Number(node?.getAttribute('data-ball-motion-streak-width') ?? 0),
      });
      if (now - startedAt >= 4_900) resolve(values);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));

  const changed = samples.filter((sample, index) => (
    index === 0 || sample.replayTime !== samples[index - 1].replayTime
  ));
  const replaySteps = changed.slice(1).map((sample, index) => (
    sample.replayTime - changed[index].replayTime
  ));
  const finalAttributes = await preview.evaluate((node) => Object.fromEntries(
    [...node.attributes]
      .filter((attribute) => attribute.name.startsWith('data-'))
      .map((attribute) => [attribute.name.slice(5), attribute.value]),
  ));

  results[viewport.id] = {
    viewport: [viewport.width, viewport.height],
    renderedFrameSamples: samples.length,
    uniqueReplaySamples: changed.length,
    replayStepP95Ms: Number((percentile(replaySteps, 0.95) * 1000).toFixed(2)),
    replayStepMaximumMs: Number((Math.max(...replaySteps) * 1000).toFixed(2)),
    renderFrameP95Ms: Number(finalAttributes['frame-p95-ms']),
    finalReplayTime: Number(finalAttributes['replay-time']),
    finalBallOwner: finalAttributes['ball-owner'],
    ballRenderMode: finalAttributes['ball-render-mode'],
    observedBallSegments: [...new Set(samples.map(({ ballSegment }) => ballSegment))],
    observedBoardPhases: [...new Set(samples.map(({ ballBoardPhase }) => ballBoardPhase))],
    maximumBallWorldHeightMeters: Number(Math.max(
      ...samples.map(({ ballWorldHeight }) => ballWorldHeight),
    ).toFixed(4)),
    maximumBallMotionStreakWidth: Math.max(
      ...samples.map(({ ballMotionStreakWidth }) => ballMotionStreakWidth),
    ),
    carryMotionStreakObserved: samples.some((sample) => (
      sample.ballSegment === 'carry' && sample.ballMotionStreakWidth > 0
    )),
    crossCourtPassObserved: samples.some(({ ballSegment }) => ballSegment === 'pass'),
    playerCount: Number(finalAttributes['player-count']),
    browserProblems: problems,
  };
  results[viewport.id].passesSmoothPlayback = (
    results[viewport.id].finalReplayTime === 8.8
    && results[viewport.id].renderFrameP95Ms <= 34
    && results[viewport.id].replayStepMaximumMs <= 180
    && results[viewport.id].playerCount === 12
    && results[viewport.id].crossCourtPassObserved === false
    && results[viewport.id].observedBoardPhases.includes('inbound')
    && results[viewport.id].observedBoardPhases.includes('outbound')
    && results[viewport.id].maximumBallWorldHeightMeters >= 0.055
    && results[viewport.id].maximumBallMotionStreakWidth >= 1
    && results[viewport.id].carryMotionStreakObserved === false
    && results[viewport.id].ballRenderMode === 'single-authority-flight-streak'
    && results[viewport.id].finalBallOwner === 'US_LW'
    && results[viewport.id].browserProblems.length === 0
  );

  const flightUrl = new URL(url);
  flightUrl.searchParams.set('time', '3.82');
  flightUrl.searchParams.set('speed', '1');
  flightUrl.searchParams.set('playing', 'false');
  flightUrl.searchParams.set('camera', 'broadcast');
  await page.goto(flightUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await waitForReplayReady(page);
  await page.waitForFunction(() => Number(
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-frame-sample-count') ?? 0,
  ) >= 60, undefined, { timeout: 120_000 });
  const flightScreenshot = path.join(
    outputDir,
    `ball-flight-streak-broadcast-${viewport.id}-${viewport.width}x${viewport.height}.png`,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: flightScreenshot });
  results[viewport.id].flightStreak = {
    screenshot: path.relative(root, flightScreenshot).replaceAll('\\', '/'),
    replayTime: Number(await preview.getAttribute('data-replay-time')),
    ballSegment: await preview.getAttribute('data-ball-segment'),
    contactWeight: Number(await preview.getAttribute('data-ball-contact-weight')),
    motionStreakWidth: Number(await preview.getAttribute('data-ball-motion-streak-width')),
    renderMode: await preview.getAttribute('data-ball-render-mode'),
    playerCount: Number(await preview.getAttribute('data-player-count')),
  };
  results[viewport.id].passesMotionStreakReadability = (
    results[viewport.id].flightStreak.replayTime >= 3.72
    && results[viewport.id].flightStreak.replayTime <= 3.9
    && results[viewport.id].flightStreak.ballSegment === 'board-pass'
    && results[viewport.id].flightStreak.contactWeight === 0
    && results[viewport.id].flightStreak.motionStreakWidth >= 1
    && results[viewport.id].flightStreak.renderMode === 'single-authority-flight-streak'
    && results[viewport.id].flightStreak.playerCount === 12
  );

  results[viewport.id].impactCameras = {};
  for (const camera of tacticalCameras) {
    const impactUrl = new URL(url);
    impactUrl.searchParams.set('time', '3.72');
    impactUrl.searchParams.set('playing', 'false');
    impactUrl.searchParams.set('camera', camera);
    await page.goto(impactUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await waitForReplayReady(page);
    await page.waitForFunction(() => Number(
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-frame-sample-count') ?? 0,
    ) >= 60, undefined, { timeout: 120_000 });
    const impactScreenshot = path.join(
      outputDir,
      `board-impact-${camera}-${viewport.id}-${viewport.width}x${viewport.height}.png`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: impactScreenshot });
    results[viewport.id].impactCameras[camera] = {
      screenshot: path.relative(root, impactScreenshot).replaceAll('\\', '/'),
      replayTime: Number(await preview.getAttribute('data-replay-time')),
      possession: await preview.getAttribute('data-possession'),
      nextRead: await preview.getAttribute('data-next-read'),
      playerCount: Number(await preview.getAttribute('data-player-count')),
      ballSegment: await preview.getAttribute('data-ball-segment'),
      boardPhase: await preview.getAttribute('data-ball-board-phase'),
      ballWorldHeightMeters: Number(await preview.getAttribute('data-ball-world-height')),
      ballMotionStreakWidth: Number(await preview.getAttribute('data-ball-motion-streak-width')),
      spacingPhase: await preview.getAttribute('data-spacing-phase'),
      spacingStatus: await preview.getAttribute('data-spacing-status'),
    };
  }
  const impact = results[viewport.id].impactCameras.broadcast;
  results[viewport.id].impactScreenshot = impact.screenshot;
  results[viewport.id].impactReplayTime = impact.replayTime;
  results[viewport.id].impactBallWorldHeightMeters = impact.ballWorldHeightMeters;
  results[viewport.id].passesImpactReadability = (
    Object.values(results[viewport.id].impactCameras).every((camera) => (
      camera.replayTime === 3.72
      && camera.possession === 'IN FLIGHT'
      && camera.nextRead === 'Winger times the boards receive'
      && camera.playerCount === 12
      && camera.ballSegment === 'board-pass'
      && camera.boardPhase !== 'none'
      && camera.ballWorldHeightMeters >= 0.05
      && camera.ballMotionStreakWidth >= 1
      && camera.spacingPhase === 'board-release'
      && camera.spacingStatus === 'pass'
    ))
  );

  results[viewport.id].retrievalCameras = {};
  for (const camera of tacticalCameras) {
    const retrievalUrl = new URL(url);
    retrievalUrl.searchParams.set('time', '1.2');
    retrievalUrl.searchParams.set('playing', 'false');
    retrievalUrl.searchParams.set('camera', camera);
    retrievalUrl.searchParams.set('role', 'LD');
    await page.goto(retrievalUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await waitForReplayReady(page);
    await page.waitForFunction(() => Number(
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-frame-sample-count') ?? 0,
    ) >= 60, undefined, { timeout: 120_000 });
    const retrievalScreenshot = path.join(
      outputDir,
      `retrieval-${camera}-${viewport.id}-${viewport.width}x${viewport.height}.png`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: retrievalScreenshot });
    results[viewport.id].retrievalCameras[camera] = {
      screenshot: path.relative(root, retrievalScreenshot).replaceAll('\\', '/'),
      replayTime: Number(await preview.getAttribute('data-replay-time')),
      possession: await preview.getAttribute('data-possession'),
      nextRead: await preview.getAttribute('data-next-read'),
      playerCount: Number(await preview.getAttribute('data-player-count')),
      ballSegment: await preview.getAttribute('data-ball-segment'),
      ballMotionStreakWidth: Number(await preview.getAttribute('data-ball-motion-streak-width')),
      spacingPhase: await preview.getAttribute('data-spacing-phase'),
      spacingStatus: await preview.getAttribute('data-spacing-status'),
    };
  }
  results[viewport.id].passesRetrievalReadability = (
    Object.values(results[viewport.id].retrievalCameras).every((camera) => (
      camera.replayTime === 1.2
      && camera.possession === 'LD'
      && camera.nextRead === 'Draw F1; release off the left boards'
      && camera.playerCount === 12
      && camera.ballSegment === 'carry'
      && camera.ballMotionStreakWidth === 0
      && camera.spacingPhase === 'retrieval'
      && camera.spacingStatus === 'pass'
    ))
  );

  results[viewport.id].advanceCameras = {};
  for (const camera of tacticalCameras) {
    const advanceUrl = new URL(url);
    advanceUrl.searchParams.set('time', '5.8');
    advanceUrl.searchParams.set('playing', 'false');
    advanceUrl.searchParams.set('camera', camera);
    await page.goto(advanceUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await waitForReplayReady(page);
    await page.waitForFunction(() => Number(
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-frame-sample-count') ?? 0,
    ) >= 60, undefined, { timeout: 120_000 });
    const advanceScreenshot = path.join(
      outputDir,
      `wall-advance-${camera}-${viewport.id}-${viewport.width}x${viewport.height}.png`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: advanceScreenshot });
    results[viewport.id].advanceCameras[camera] = {
      screenshot: path.relative(root, advanceScreenshot).replaceAll('\\', '/'),
      replayTime: Number(await preview.getAttribute('data-replay-time')),
      possession: await preview.getAttribute('data-possession'),
      nextRead: await preview.getAttribute('data-next-read'),
      ballOwner: await preview.getAttribute('data-ball-owner'),
      playerCount: Number(await preview.getAttribute('data-player-count')),
      ballSegment: await preview.getAttribute('data-ball-segment'),
      spacingPhase: await preview.getAttribute('data-spacing-phase'),
      spacingStatus: await preview.getAttribute('data-spacing-status'),
    };
  }
  results[viewport.id].passesWallAdvanceReadability = (
    Object.values(results[viewport.id].advanceCameras).every((camera) => (
      camera.replayTime === 5.8
      && camera.possession === 'LW'
      && camera.nextRead === 'Gain the line before moving inside'
      && camera.ballOwner === 'US_LW'
      && camera.playerCount === 12
      && camera.ballSegment === 'carry'
      && camera.spacingPhase === 'wall-advance'
      && camera.spacingStatus === 'pass'
    ))
  );

  results[viewport.id].decisionCameras = {};
  for (const camera of tacticalCameras) {
    const decisionUrl = new URL(url);
    decisionUrl.searchParams.set('time', '7.8');
    decisionUrl.searchParams.set('playing', 'false');
    decisionUrl.searchParams.set('camera', camera);
    await page.goto(decisionUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await waitForReplayReady(page);
    await page.waitForFunction(() => Number(
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-frame-sample-count') ?? 0,
    ) >= 60, undefined, { timeout: 120_000 });
    const decisionScreenshot = path.join(
      outputDir,
      `controlled-entry-${camera}-${viewport.id}-${viewport.width}x${viewport.height}.png`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: decisionScreenshot });
    results[viewport.id].decisionCameras[camera] = {
      screenshot: path.relative(root, decisionScreenshot).replaceAll('\\', '/'),
      replayTime: Number(await preview.getAttribute('data-replay-time')),
      possession: await preview.getAttribute('data-possession'),
      nextRead: await preview.getAttribute('data-next-read'),
      playerCount: Number(await preview.getAttribute('data-player-count')),
      spacingPhase: await preview.getAttribute('data-spacing-phase'),
      spacingStatus: await preview.getAttribute('data-spacing-status'),
    };
  }
  const decision = results[viewport.id].decisionCameras.broadcast;
  results[viewport.id].decisionScreenshot = decision.screenshot;
  results[viewport.id].decisionReplayTime = decision.replayTime;
  results[viewport.id].decisionPossession = decision.possession;
  results[viewport.id].decisionNextRead = decision.nextRead;
  results[viewport.id].passesTacticalRead = (
    Object.values(results[viewport.id].decisionCameras).every((camera) => (
      camera.replayTime === 7.8
      && camera.possession === 'LW'
      && camera.nextRead === 'Protect wide; scan C underneath'
      && camera.playerCount === 12
      && camera.spacingPhase === 'controlled-entry'
      && camera.spacingStatus === 'pass'
    ))
  );

  results[viewport.id].resolutionCameras = {};
  for (const camera of tacticalCameras) {
    const resolutionUrl = new URL(url);
    resolutionUrl.searchParams.set('time', '8.65');
    resolutionUrl.searchParams.set('playing', 'false');
    resolutionUrl.searchParams.set('camera', camera);
    await page.goto(resolutionUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await waitForReplayReady(page);
    await page.waitForFunction(() => Number(
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-frame-sample-count') ?? 0,
    ) >= 60, undefined, { timeout: 120_000 });
    const resolutionScreenshot = path.join(
      outputDir,
      `entry-settle-${camera}-${viewport.id}-${viewport.width}x${viewport.height}.png`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolutionScreenshot });
    results[viewport.id].resolutionCameras[camera] = {
      screenshot: path.relative(root, resolutionScreenshot).replaceAll('\\', '/'),
      replayTime: Number(await preview.getAttribute('data-replay-time')),
      possession: await preview.getAttribute('data-possession'),
      nextRead: await preview.getAttribute('data-next-read'),
      ballOwner: await preview.getAttribute('data-ball-owner'),
      playerCount: Number(await preview.getAttribute('data-player-count')),
      spacingPhase: await preview.getAttribute('data-spacing-phase'),
      spacingStatus: await preview.getAttribute('data-spacing-status'),
    };
  }
  results[viewport.id].passesEntryResolution = (
    Object.values(results[viewport.id].resolutionCameras).every((camera) => (
      camera.replayTime === 8.65
      && camera.possession === 'LW'
      && camera.nextRead === 'Hold the wall; let both support lanes arrive'
      && camera.ballOwner === 'US_LW'
      && camera.playerCount === 12
      && camera.spacingPhase === 'entry-settle'
      && camera.spacingStatus === 'pass'
    ))
  );

  const interactionUrl = new URL(url);
  interactionUrl.searchParams.set('time', '0');
  interactionUrl.searchParams.set('playing', 'false');
  interactionUrl.searchParams.set('camera', 'broadcast');
  interactionUrl.searchParams.set('role', 'LD');
  await page.goto(interactionUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await waitForReplayReady(page);
  await page.waitForFunction(() => Number(
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-frame-sample-count') ?? 0,
  ) >= 60, undefined, { timeout: 120_000 });

  const interactionSequence = [
    {
      action: 'seek',
      time: 1.2,
      camera: 'broadcast',
      phase: 0,
      possession: 'LD',
      nextRead: 'Draw F1; release off the left boards',
      ballOwner: 'US_LD',
      ballSegment: 'carry',
    },
    {
      action: 'camera',
      time: 1.2,
      camera: 'bench',
      phase: 0,
      possession: 'LD',
      nextRead: 'Draw F1; release off the left boards',
      ballOwner: 'US_LD',
      ballSegment: 'carry',
    },
    {
      action: 'seek',
      time: 3.7,
      camera: 'bench',
      phase: 1,
      possession: 'IN FLIGHT',
      nextRead: 'Winger times the boards receive',
      ballOwner: 'none',
      ballSegment: 'board-pass',
    },
    {
      action: 'camera',
      time: 3.7,
      camera: 'overhead',
      phase: 1,
      possession: 'IN FLIGHT',
      nextRead: 'Winger times the boards receive',
      ballOwner: 'none',
      ballSegment: 'board-pass',
    },
    {
      action: 'seek',
      time: 7.8,
      camera: 'overhead',
      phase: 1,
      possession: 'LW',
      nextRead: 'Protect wide; scan C underneath',
      ballOwner: 'US_LW',
      ballSegment: 'carry',
    },
    {
      action: 'camera',
      time: 7.8,
      camera: 'player',
      phase: 1,
      possession: 'LW',
      nextRead: 'Protect wide; scan C underneath',
      ballOwner: 'US_LW',
      ballSegment: 'carry',
    },
    {
      action: 'seek',
      time: 1.2,
      camera: 'player',
      phase: 0,
      possession: 'LD',
      nextRead: 'Draw F1; release off the left boards',
      ballOwner: 'US_LD',
      ballSegment: 'carry',
    },
    {
      action: 'camera',
      time: 1.2,
      camera: 'broadcast',
      phase: 0,
      possession: 'LD',
      nextRead: 'Draw F1; release off the left boards',
      ballOwner: 'US_LD',
      ballSegment: 'carry',
    },
    {
      action: 'seek',
      time: 7.8,
      camera: 'broadcast',
      phase: 1,
      possession: 'LW',
      nextRead: 'Protect wide; scan C underneath',
      ballOwner: 'US_LW',
      ballSegment: 'carry',
    },
    {
      action: 'camera',
      time: 7.8,
      camera: 'bench',
      phase: 1,
      possession: 'LW',
      nextRead: 'Protect wide; scan C underneath',
      ballOwner: 'US_LW',
      ballSegment: 'carry',
    },
  ];
  const timeline = page.getByTestId('playback-timeline');
  results[viewport.id].interactionSequence = [];

  for (const expected of interactionSequence) {
    await timeline.evaluate((node, target) => {
      window.__vnextInteractionStartedAt = performance.now();
      if (target.action === 'seek') {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(node, String(target.time));
        node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      } else {
        const cameraButton = [...document.querySelectorAll('.vnext3d-stage-camera-presets button')]
          .find((button) => button.textContent?.trim() === target.cameraLabel);
        cameraButton?.click();
      }
    }, {
      action: expected.action,
      time: expected.time,
      cameraLabel: cameraLabels[expected.camera],
    });
    try {
      await page.waitForFunction((target) => {
        const node = document.querySelector('[data-testid="vnext-3d-production-preview"]');
        return Number(node?.getAttribute('data-replay-time')) === target.time
          && node?.getAttribute('data-camera-id') === target.camera
          && Number(node?.getAttribute('data-phase')) === target.phase
          && node?.getAttribute('data-playing') === 'false'
          && node?.getAttribute('data-possession') === target.possession
          && node?.getAttribute('data-next-read') === target.nextRead
          && node?.getAttribute('data-ball-owner') === target.ballOwner
          && node?.getAttribute('data-ball-segment') === target.ballSegment
          && Number(node?.getAttribute('data-player-count')) === 12;
      }, expected, { timeout: 1_000 });
    } catch (error) {
      const observed = await preview.evaluate((node) => Object.fromEntries(
        [...node.attributes]
          .filter((attribute) => [
            'data-replay-time',
            'data-camera-id',
            'data-phase',
            'data-playing',
            'data-possession',
            'data-next-read',
            'data-ball-owner',
            'data-ball-segment',
            'data-player-count',
          ].includes(attribute.name))
          .map((attribute) => [attribute.name, attribute.value]),
      ));
      throw new Error(
        `Interaction coherence failed: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(observed)}`,
        { cause: error },
      );
    }
    const stateLatencyMs = Number((await page.evaluate(() => (
      performance.now() - window.__vnextInteractionStartedAt
    ))).toFixed(1));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const actual = await preview.evaluate((node) => ({
      replayTime: Number(node.getAttribute('data-replay-time')),
      camera: node.getAttribute('data-camera-id'),
      phase: Number(node.getAttribute('data-phase')),
      playing: node.getAttribute('data-playing') === 'true',
      possession: node.getAttribute('data-possession'),
      nextRead: node.getAttribute('data-next-read'),
      ballOwner: node.getAttribute('data-ball-owner'),
      ballSegment: node.getAttribute('data-ball-segment'),
      playerCount: Number(node.getAttribute('data-player-count')),
    }));
    results[viewport.id].interactionSequence.push({
      action: expected.action,
      ...actual,
      stateLatencyMs,
      presentedLatencyMs: Number((await page.evaluate(() => (
        performance.now() - window.__vnextInteractionStartedAt
      ))).toFixed(1)),
    });
  }

  await page.waitForTimeout(220);
  const finalInteractionUrl = new URL(page.url());
  const interactionScreenshot = path.join(
    outputDir,
    `rapid-seek-bench-${viewport.id}-${viewport.width}x${viewport.height}.png`,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: interactionScreenshot });
  results[viewport.id].interactionScreenshot = path
    .relative(root, interactionScreenshot)
    .replaceAll('\\', '/');
  results[viewport.id].interactionMaximumLatencyMs = Math.max(
    ...results[viewport.id].interactionSequence.map(({ stateLatencyMs }) => stateLatencyMs),
  );
  results[viewport.id].interactionMaximumPresentedLatencyMs = Math.max(
    ...results[viewport.id].interactionSequence.map(({ presentedLatencyMs }) => presentedLatencyMs),
  );
  results[viewport.id].interactionFinalUrl = {
    time: Number(finalInteractionUrl.searchParams.get('time')),
    camera: finalInteractionUrl.searchParams.get('camera'),
    phase: Number(finalInteractionUrl.searchParams.get('phase')),
    playing: finalInteractionUrl.searchParams.get('playing'),
  };
  results[viewport.id].passesInteractionCoherence = (
    results[viewport.id].interactionMaximumLatencyMs <= 300
    && results[viewport.id].interactionMaximumPresentedLatencyMs <= 600
    && results[viewport.id].interactionSequence.every((actual, index) => {
      const expected = interactionSequence[index];
      return actual.replayTime === expected.time
        && actual.camera === expected.camera
        && actual.phase === expected.phase
        && actual.playing === false
        && actual.possession === expected.possession
        && actual.nextRead === expected.nextRead
        && actual.ballOwner === expected.ballOwner
        && actual.ballSegment === expected.ballSegment
        && actual.playerCount === 12;
    })
    && results[viewport.id].interactionFinalUrl.time === 7.8
    && results[viewport.id].interactionFinalUrl.camera === 'bench'
    && results[viewport.id].interactionFinalUrl.phase === 1
    && results[viewport.id].interactionFinalUrl.playing === 'false'
  );
  results[viewport.id].passesSmoothPlayback = (
    results[viewport.id].passesSmoothPlayback
    && results[viewport.id].passesMotionStreakReadability
    && results[viewport.id].passesImpactReadability
    && results[viewport.id].passesRetrievalReadability
    && results[viewport.id].passesWallAdvanceReadability
    && results[viewport.id].passesTacticalRead
    && results[viewport.id].passesEntryResolution
    && results[viewport.id].passesInteractionCoherence
  );

  await context.close();
  await browser.close();
}

const outputPath = path.join(outputDir, 'playback-motion.json');
await writeFile(outputPath, `${JSON.stringify({
  capturedAt: new Date().toISOString(),
  headless: true,
  visibleBrowserWindowOpened: false,
  results,
}, null, 2)}\n`);

const failures = Object.entries(results)
  .filter(([, result]) => !result.passesSmoothPlayback)
  .map(([id]) => id);
if (failures.length > 0) {
  throw new Error(`Smooth playback gate failed for: ${failures.join(', ')}`);
}

console.log(outputPath);
console.log(JSON.stringify(results, null, 2));
