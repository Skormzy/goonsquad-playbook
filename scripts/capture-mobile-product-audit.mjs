import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = process.env.MOBILE_AUDIT_RUN ?? 'final';
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'mobile-product-audit', runId);
const baseUrl = process.env.GOONSQUAD_MOBILE_AUDIT_URL ?? 'http://127.0.0.1:55601/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const allDevices = [
  { id: 'compact', width: 360, height: 800, full: false },
  { id: 'mobile', width: 390, height: 844, full: true },
  { id: 'large', width: 430, height: 932, full: false },
  { id: 'landscape', width: 844, height: 390, full: false, landscape: true },
];
const requestedDevice = process.env.MOBILE_AUDIT_DEVICE;
const devices = requestedDevice
  ? allDevices.filter(({ id }) => id === requestedDevice)
  : allDevices;

if (!devices.length) throw new Error(`Unknown MOBILE_AUDIT_DEVICE: ${requestedDevice}`);

const routes = {
  home: {},
  play2d: { content: 'plays', mode: '2d', playId: 'brk', phase: '1', time: '4.6', speed: '1', role: 'C', playing: 'false', camera: 'broadcast' },
  faceoff2d: { content: 'plays', mode: '2d', playId: 'dzfl', faceoff: 'lost', phase: '3', time: '8', speed: '1', role: 'C', playing: 'false', camera: 'broadcast' },
  play3d: { content: 'plays', mode: '3d', playId: 'brk', phase: '1', time: '4.6', speed: '1', role: 'C', playing: 'false', camera: 'broadcast' },
  strategy2d: { content: 'strategy', mode: '2d', tacticId: 'watch-your-man', scenario: 'correct', phase: '1', time: '4.6', speed: '1', role: 'C', playing: 'false', camera: 'broadcast' },
  strategy3d: { content: 'strategy', mode: '3d', tacticId: 'instant-backcheck', scenario: 'mistake', phase: '3', time: '8', speed: '1', role: 'C', playing: 'false', camera: 'broadcast' },
  create: { content: 'playmaker', mode: '2d', phase: '0', time: '0', speed: '1', role: 'C', playing: 'false', camera: 'broadcast' },
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
  throw new Error('Chrome or Edge was not found for the hidden mobile product audit.');
}

function route(parameters) {
  const url = new URL(baseUrl);
  url.search = '';
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.href;
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll('\\', '/');
}

async function waitForSurface(page, type) {
  if (type === 'stats') {
    await page.locator('.stats-workspace').waitFor({ state: 'visible', timeout: 60_000 });
  } else if (type === 'play2d') {
    await page.locator('[data-testid^="play-workspace-"]').waitFor({ state: 'visible', timeout: 60_000 });
  } else if (type === 'strategy2d') {
    await page.getByRole('combobox', { name: 'Strategy principle' }).waitFor({ state: 'visible', timeout: 60_000 });
  } else if (type === 'create') {
    await page.locator('.playmaker-workspace').waitFor({ state: 'visible', timeout: 60_000 });
  } else if (type === '3d') {
    const preview = page.getByTestId('vnext-3d-production-preview');
    await preview.waitFor({ state: 'visible', timeout: 120_000 });
    await page.waitForFunction(() => (
      document.querySelector('[data-testid="vnext-3d-production-preview"]')?.getAttribute('data-player-count') === '12'
      && document.querySelectorAll('.vnext3d-preview-stage canvas').length === 1
    ), undefined, { timeout: 120_000 });
    await page.waitForFunction(() => Number(
      document.querySelector('[data-testid="vnext-3d-production-preview"]')?.getAttribute('data-frame-sample-count') ?? 0,
    ) >= 60, undefined, { timeout: 120_000 });
    await page.locator('.vnext3d-loading-state').waitFor({ state: 'hidden', timeout: 120_000 });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(180);
}

async function settleInteraction(page, duration = 280) {
  await page.waitForTimeout(duration);
}

async function auditLayout(page) {
  return page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const selector = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
    const nodes = [...document.querySelectorAll(selector)];
    const visible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0.01
        && rect.width > 0
        && rect.height > 0
        && rect.right > 0
        && rect.bottom > 0
        && rect.left < viewport.width
        && rect.top < viewport.height;
    };
    const labelFor = (node) => (
      node.getAttribute('aria-label')
      || node.getAttribute('title')
      || node.textContent
      || node.closest('label')?.textContent
      || node.getAttribute('value')
      || node.tagName
    ).replace(/\s+/gu, ' ').trim().slice(0, 90);
    const isInsideHorizontalScroller = (node) => {
      let parent = node.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (['auto', 'scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    const controls = nodes.filter((node) => (
      visible(node)
      && !node.classList.contains('sr-only')
      && !node.classList.contains('playmaker-visually-hidden')
    )).map((node) => {
      const inputType = node.getAttribute('type') || '';
      const labeledHitArea = ['checkbox', 'radio'].includes(inputType) ? node.closest('label') : null;
      const rect = (labeledHitArea || node).getBoundingClientRect();
      return {
        label: labelFor(node),
        tag: node.tagName.toLowerCase(),
        className: typeof node.className === 'string' ? node.className.slice(0, 120) : '',
        width: Number(rect.width.toFixed(1)),
        height: Number(rect.height.toFixed(1)),
        left: Number(rect.left.toFixed(1)),
        right: Number(rect.right.toFixed(1)),
        clipped: node.scrollWidth > node.clientWidth + 1,
        inHorizontalScroller: isInsideHorizontalScroller(node),
        inputType,
        spatial: node.classList.contains('playmaker-player'),
      };
    });
    const iconSelectors = [
      '.app-header-icon-button',
      '.playback-icon-button',
      '.playmaker-icon-button',
      '.guide-icon-button',
      '.account-icon-button',
      '.stats-game-detail-button',
      '.vnext3d-camera-operator button',
    ].join(',');
    const iconCenterFailures = [...document.querySelectorAll(iconSelectors)].filter(visible).flatMap((node) => {
      const icon = node.querySelector('svg');
      if (!icon) return [];
      const outer = node.getBoundingClientRect();
      const inner = icon.getBoundingClientRect();
      const dx = Math.abs((outer.left + outer.width / 2) - (inner.left + inner.width / 2));
      const dy = Math.abs((outer.top + outer.height / 2) - (inner.top + inner.height / 2));
      return dx > 1.5 || dy > 1.5 ? [{ label: labelFor(node), dx: Number(dx.toFixed(1)), dy: Number(dy.toFixed(1)) }] : [];
    });
    const smallTargets = controls.filter((item) => (
      item.inputType !== 'range'
      && !item.spatial
      && (item.width < 40 || item.height < 40)
    ));
    const spatialTargets = [...document.querySelectorAll('.playmaker-player')].filter(visible).map((node) => {
      const hitTarget = node.querySelector('.playmaker-player-hit-target');
      const rect = node.getBoundingClientRect();
      return {
        label: labelFor(node),
        width: Number(rect.width.toFixed(1)),
        height: Number(rect.height.toFixed(1)),
        hitRadius: Number(hitTarget?.getAttribute('r') ?? 0),
      };
    });
    const offscreenControls = controls.filter((item) => (
      !item.inHorizontalScroller && (item.left < -1 || item.right > viewport.width + 1)
    ));
    const clippedControls = controls.filter((item) => item.clipped && item.inputType !== 'range');
    const unnamedControls = controls.filter((item) => !item.label || item.label === item.tag.toUpperCase());
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        label: labelFor(node),
        left: Number(rect.left.toFixed(1)),
        top: Number(rect.top.toFixed(1)),
        right: Number(rect.right.toFixed(1)),
        bottom: Number(rect.bottom.toFixed(1)),
        contained: rect.left >= -1 && rect.top >= -1 && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1,
      };
    });
    const strategyRink = document.querySelector('.tactics-mobile-rink, [data-mobile-strategy-rink]');
    const strategyRinkRect = strategyRink?.getBoundingClientRect();
    return {
      viewport,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewport.width,
      visibleControlCount: controls.length,
      smallTargets,
      spatialTargets,
      offscreenControls,
      clippedControls,
      unnamedControls,
      iconCenterFailures,
      dialogs,
      strategyRink: strategyRinkRect ? {
        top: Number(strategyRinkRect.top.toFixed(1)),
        bottom: Number(strategyRinkRect.bottom.toFixed(1)),
        height: Number(strategyRinkRect.height.toFixed(1)),
        fullyVisible: strategyRinkRect.top >= -1 && strategyRinkRect.bottom <= viewport.height + 1,
      } : null,
    };
  });
}

async function canvasPixelAudit(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const canvas = document.querySelector('.playmaker-3d-stage canvas, .vnext3d-preview-stage canvas');
    if (!canvas) {
      resolve(null);
      return;
    }
    requestAnimationFrame(() => {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl || !canvas.width || !canvas.height) {
        resolve({ available: false, nonBlackRatio: 0, channelRange: 0 });
        return;
      }
      const width = canvas.width;
      const height = canvas.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let nonBlack = 0;
      let minimum = 255;
      let maximum = 0;
      for (let index = 0; index < pixels.length; index += 16) {
        const luminance = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
        if (luminance > 18) nonBlack += 1;
        minimum = Math.min(minimum, luminance);
        maximum = Math.max(maximum, luminance);
      }
      const samples = Math.ceil(pixels.length / 16);
      resolve({
        available: true,
        width,
        height,
        nonBlackRatio: Number((nonBlack / samples).toFixed(4)),
        channelRange: maximum - minimum,
      });
    });
  }));
}

async function capture(page, device, stateId, notes = {}) {
  const screenshotPath = path.join(outputDir, `${device.id}-${stateId}-${device.width}x${device.height}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return {
    stateId,
    url: page.url(),
    screenshot: relative(screenshotPath),
    layout: await auditLayout(page),
    canvasPixels: await canvasPixelAudit(page),
    ...notes,
  };
}

function stateFailures(state) {
  const failures = [];
  if (state.layout.smallTargets.length) failures.push(`${state.stateId}: ${state.layout.smallTargets.length} conventional controls are smaller than 40px`);
  if (state.layout.horizontalOverflow > 1) failures.push(`${state.stateId}: ${state.layout.horizontalOverflow}px horizontal overflow`);
  if (state.layout.offscreenControls.length) failures.push(`${state.stateId}: ${state.layout.offscreenControls.length} controls leave the viewport`);
  if (state.layout.clippedControls.length) failures.push(`${state.stateId}: ${state.layout.clippedControls.length} controls clip their content`);
  if (state.layout.unnamedControls.length) failures.push(`${state.stateId}: ${state.layout.unnamedControls.length} visible controls are unnamed`);
  if (state.layout.iconCenterFailures.length) failures.push(`${state.stateId}: ${state.layout.iconCenterFailures.length} icon buttons are not centered`);
  if (state.layout.dialogs.some(({ contained }) => !contained)) failures.push(`${state.stateId}: a dialog leaves the viewport`);
  if (state.layout.strategyRink && !state.layout.strategyRink.fullyVisible) failures.push(`${state.stateId}: the strategy rink is not fully visible`);
  if (state.layout.spatialTargets.some(({ hitRadius }) => hitRadius < 8.5)) {
    failures.push(`${state.stateId}: a spatial player control is missing its enlarged drag target`);
  }
  if (state.canvasPixels && (!state.canvasPixels.available || state.canvasPixels.nonBlackRatio < 0.02 || state.canvasPixels.channelRange < 20)) {
    failures.push(`${state.stateId}: the 3D canvas is blank or has not rendered`);
  }
  return failures;
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const results = {};

for (const device of devices) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: !device.landscape,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    localStorage.setItem('gs_playmaker_tutorial_complete_v1', 'true');
  });
  const page = await context.newPage();
  const browserProblems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserProblems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`));
  const states = [];

  await page.goto(route(routes.home), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForSurface(page, 'stats');
  states.push(await capture(page, device, 'home-overview'));

  await page.getByRole('tab', { name: 'Games', exact: true }).click();
  states.push(await capture(page, device, 'home-games'));
  if (device.full) {
    const finalGameRow = page.locator('.stats-table tbody tr').filter({ has: page.locator('.stats-result.is-w, .stats-result.is-l, .stats-result.is-t') }).first();
    await finalGameRow.locator('.stats-game-detail-button').click();
    await page.locator('.stats-game-page').waitFor({ state: 'visible' });
    states.push(await capture(page, device, 'game-detail'));
    await page.getByRole('button', { name: 'All games', exact: true }).click();
  }
  await page.getByRole('tab', { name: 'Players', exact: true }).click();
  states.push(await capture(page, device, 'home-players'));

  await page.getByRole('button', { name: 'Open team account' }).click();
  await page.locator('.account-workspace').waitFor({ state: 'visible' });
  await settleInteraction(page);
  states.push(await capture(page, device, 'account-workspace'));
  await page.goto(route(routes.home), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForSurface(page, 'stats');

  await page.getByRole('button', { name: 'Open product guide' }).click();
  await page.getByRole('dialog', { name: 'Goonsquad product guide' }).waitFor({ state: 'visible' });
  await settleInteraction(page);
  states.push(await capture(page, device, 'guide-home'));
  if (device.full) {
    const guideTopics = [
      ['Start here', 'start'],
      ['Plays', 'plays'],
      ['Strategy', 'strategy'],
      ['3D', '3d'],
      ['Create', 'create'],
      ['Controls', 'controls'],
      ['Terms', 'terms'],
    ];
    for (const [label, id] of guideTopics) {
      await page.getByRole('tab', { name: label, exact: true }).click();
      await settleInteraction(page, 90);
      states.push(await capture(page, device, `guide-${id}`));
    }
  }
  await page.getByRole('button', { name: 'Close product guide' }).click();

  await page.goto(route(routes.play2d), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForSurface(page, 'play2d');
  const rinkRect = await page.locator('.play-mobile-rink, .play-region-rink').boundingBox();
  states.push(await capture(page, device, 'plays-2d', { rinkRect }));
  if (!device.landscape) {
    const sheetToggle = page.locator('.play-bottom-sheet-toggle');
    if (await sheetToggle.count()) {
      await sheetToggle.click();
      await page.locator('.play-bottom-sheet.is-open').waitFor({ state: 'visible' });
      await settleInteraction(page, 220);
      const sheetRect = await page.locator('.play-bottom-sheet').boundingBox();
      const openRinkRect = await page.locator('.play-mobile-rink').boundingBox();
      const rinkBottom = openRinkRect.y + openRinkRect.height;
      const sheetBottom = sheetRect.y + sheetRect.height;
      const rinkSheetOverlap = Math.max(0, Math.min(rinkBottom, sheetBottom) - Math.max(openRinkRect.y, sheetRect.y));
      states.push(await capture(page, device, 'plays-2d-coaching', { rinkRect: openRinkRect, sheetRect, rinkSheetOverlap }));
      await sheetToggle.click();
    }
    const libraryButton = page.getByRole('button', { name: 'Open play library' });
    if (await libraryButton.count()) {
      await libraryButton.click();
      await page.getByTestId('overlay-play-library').waitFor({ state: 'visible' });
      await settleInteraction(page);
      states.push(await capture(page, device, 'plays-2d-library'));
      await page.getByRole('button', { name: 'Close play library' }).click();
    }
  }

  await page.goto(route(routes.faceoff2d), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForSurface(page, 'play2d');
  states.push(await capture(page, device, 'plays-faceoff-lost'));

  await page.goto(route(routes.strategy2d), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForSurface(page, 'strategy2d');
  states.push(await capture(page, device, 'strategy-2d'));
  if (!device.landscape) {
    const coachingNotes = page.locator('.tactics-mobile-coaching');
    if (await coachingNotes.count()) {
      await coachingNotes.locator('summary').click();
      await settleInteraction(page, 120);
      states.push(await capture(page, device, 'strategy-2d-coaching'));
      await coachingNotes.locator('summary').click();
    }
  }

  await page.goto(route(routes.create), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForSurface(page, 'create');
  states.push(await capture(page, device, 'create-2d'));
  if (device.full) {
    await page.locator('.playmaker-body').evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await settleInteraction(page, 120);
    states.push(await capture(page, device, 'create-inspector'));
    await page.locator('.playmaker-body').evaluate((node) => { node.scrollTop = 0; });
  }
  if (device.full) {
    await page.getByRole('button', { name: 'Open play library' }).click();
    await page.getByRole('dialog', { name: /Play library/u }).waitFor({ state: 'visible' });
    await settleInteraction(page);
    states.push(await capture(page, device, 'create-library'));
    await page.getByRole('button', { name: 'Close library' }).click();

    await page.getByRole('button', { name: 'Open Create tutorial' }).click();
    await page.getByRole('dialog', { name: 'Create tutorial' }).waitFor({ state: 'visible' });
    await settleInteraction(page);
    states.push(await capture(page, device, 'create-tutorial-step-1'));
    for (let step = 2; step <= 10; step += 1) {
      const nextButton = page.getByRole('button', { name: 'Next', exact: true });
      if (!await nextButton.count()) break;
      await nextButton.click();
      await settleInteraction(page, 100);
      states.push(await capture(page, device, `create-tutorial-step-${step}`));
    }
    await page.getByRole('button', { name: 'Exit Create tutorial' }).click();
  }

  if (device.full || device.landscape) {
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.locator('.playmaker-3d-stage').waitFor({ state: 'visible', timeout: 120_000 });
    await page.locator('.playmaker-3d-stage canvas').waitFor({ state: 'visible', timeout: 120_000 });
    await page.waitForTimeout(1_800);
    states.push(await capture(page, device, 'create-3d'));
    const layerButton = page.getByRole('button', { name: 'Toggle coaching layers' });
    if (await layerButton.count()) {
      await layerButton.click();
      await page.locator('.playmaker-layer-panel').waitFor({ state: 'visible' });
      states.push(await capture(page, device, 'create-3d-layers'));
      await layerButton.click();
    }
    if (device.full) {
      const fullscreenButton = page.getByRole('button', { name: 'View preview full screen' });
      if (await fullscreenButton.count()) {
        await fullscreenButton.click();
        await page.getByRole('button', { name: 'Exit full screen preview' }).waitFor({ state: 'visible' });
        await settleInteraction(page, 160);
        states.push(await capture(page, device, 'create-3d-fullscreen'));
        await page.getByRole('button', { name: 'Exit full screen preview' }).click();
      }
    }

    await page.goto(route(routes.play3d), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForSurface(page, '3d');
    states.push(await capture(page, device, 'plays-3d'));
    if (device.full) {
      const fullscreenButton = page.getByRole('button', { name: 'View 3D replay full screen' });
      if (await fullscreenButton.count()) {
        await fullscreenButton.click();
        await page.getByRole('button', { name: 'Exit full screen 3D replay' }).waitFor({ state: 'visible' });
        await settleInteraction(page, 160);
        states.push(await capture(page, device, 'plays-3d-fullscreen'));
        await page.getByRole('button', { name: 'Exit full screen 3D replay' }).click();
      }
    }
    await page.getByTestId('vnext3d-catalog-toggle').click();
    await page.getByTestId('vnext3d-catalog-drawer').waitFor({ state: 'visible' });
    await settleInteraction(page);
    states.push(await capture(page, device, 'plays-3d-library'));
    await page.getByTestId('vnext3d-catalog-drawer').getByRole('button', { name: /Close .* library/u }).click();

    if (device.full) {
      await page.goto(route(routes.strategy3d), { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSurface(page, '3d');
      states.push(await capture(page, device, 'strategy-3d'));
    }
  }

  const failures = states.flatMap(stateFailures);
  for (const state of states) {
    if (state.rinkSheetOverlap > 1) failures.push(`${state.stateId}: coaching sheet covers ${state.rinkSheetOverlap.toFixed(1)}px of the rink`);
  }
  if (browserProblems.length) failures.push(...browserProblems);
  results[device.id] = {
    viewport: [device.width, device.height],
    stateCount: states.length,
    states,
    browserProblems,
    smallTargetCount: states.reduce((sum, state) => sum + state.layout.smallTargets.length, 0),
    failures,
    passed: failures.length === 0,
  };

  await context.close();
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  runId,
  baseUrl,
  headless: true,
  visibleBrowserWindowOpened: false,
  coverage: {
    devices: devices.map(({ id, width, height }) => ({ id, width, height })),
    publicDestinations: ['Home', 'Plays', 'Strategy', 'Create'],
    states: [...new Set(Object.values(results).flatMap((result) => result.states.map(({ stateId }) => stateId)))],
  },
  results,
  passed: Object.values(results).every(({ passed }) => passed),
};

await writeFile(path.join(outputDir, 'mobile-product-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  generatedAt: report.generatedAt,
  runId,
  passed: report.passed,
  results: Object.fromEntries(Object.entries(results).map(([id, result]) => [id, {
    viewport: result.viewport,
    stateCount: result.stateCount,
    smallTargetCount: result.smallTargetCount,
    failureCount: result.failures.length,
    failures: result.failures,
  }])),
}, null, 2));
if (!report.passed) process.exitCode = 1;
