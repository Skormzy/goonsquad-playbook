import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'core-curriculum');
const baseUrl = process.env.GOONSQUAD_CORE_URL ?? 'http://127.0.0.1:55601/';
const corePlayIds = {
  defence: ['trap', 'dzfl', 'nfd', 'bck', 'pkb', 'pomr'],
  offence: ['brk', 'zent', 'slot-window', 'lcl', 'pts', 'ppum'],
};
const coreTacticIds = {
  defence: ['protect-the-middle', 'watch-your-man', 'gap-control', 'instant-backcheck'],
  offence: ['triangle-spacing', 'cycling-the-boards'],
};
const coreTacticLabels = {
  defence: [
    '1-2-2 Strong-Side Lock',
    'Watch Your Man, Not the Ball',
    'Gap Control',
    'Instant Backchecking on Turnovers',
  ],
  offence: [
    'Triangle Spacing & Support',
    'Cycling the Ball Along the Boards',
  ],
};
const archivedPlayIds = ['rev', 'dzfr', 'o32'];
const archivedTacticIds = ['breakout-patterns', 'communication-defense', 'never-stop-moving'];
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
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
  throw new Error('Chrome or Edge was not found for the hidden curriculum review.');
}

function route(parameters) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.href;
}

function playRoute(mode, playId = 'brk') {
  return route({
    content: 'plays',
    mode,
    playId,
    phase: '1',
    time: '4.6',
    speed: '1',
    role: 'C',
    playing: 'false',
    camera: 'broadcast',
  });
}

function strategyRoute(mode, tacticId = 'watch-your-man') {
  return route({
    content: 'strategy',
    mode,
    tacticId,
    scenario: 'correct',
    phase: '1',
    time: '4.6',
    speed: '1',
    role: 'C',
    playing: 'false',
    camera: 'broadcast',
  });
}

function exactSet(actual, expected) {
  return actual.length === expected.length
    && [...actual].sort().join(',') === [...expected].sort().join(',');
}

function noArchived(actual, archived) {
  return archived.every((id) => !actual.includes(id));
}

async function laneItems(container, lane) {
  await container.locator(`[data-lane="${lane}"]`).click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  return container.locator('[data-item-id], [data-play-id]').evaluateAll((nodes) => (
    nodes.map((node) => (
      node.getAttribute('data-item-id') ?? node.getAttribute('data-play-id')
    ))
  ));
}

async function screenshot(page, viewport, name) {
  const outputPath = path.join(outputDir, `${viewport.id}-${name}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: outputPath, fullPage: false });
  return path.relative(root, outputPath).replaceAll('\\', '/');
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const results = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  await goto(page, playRoute('2d', 'rev'));
  await page.getByTestId(`play-workspace-${viewport.id}`).waitFor({ state: 'visible', timeout: 60_000 });
  if (viewport.id === 'mobile') {
    await page.getByRole('button', { name: 'Open play library' }).click();
  }
  const library = page.getByTestId(viewport.id === 'desktop' ? 'desktop-play-library' : 'overlay-play-library');
  await library.waitFor({ state: 'visible' });
  await page.waitForTimeout(260);
  const defensivePlayIds2d = await laneItems(library, 'defence');
  const offensivePlayIds2d = await laneItems(library, 'offence');
  await library.locator('[data-lane="defence"]').click();
  await page.waitForTimeout(200);
  const selectedPlayId = await library.locator('[data-play-id][aria-current="true"]').getAttribute('data-play-id');
  const playScreenshot = await screenshot(page, viewport, 'core-plays');
  await library.getByRole('searchbox', { name: 'Search plays' }).fill('Reverse Breakout');
  const archivedSearchResults = await library.locator('[data-play-id]').count();

  await goto(page, strategyRoute('2d', 'breakout-patterns'));
  const principleSelect = page.getByRole('combobox', { name: 'Strategy principle' });
  await principleSelect.waitFor({ state: 'visible' });
  const defensiveTacticLabels2d = await principleSelect.locator('option').allTextContents();
  await page.locator('.tactics-selector [data-lane="offence"]').click();
  await page.waitForTimeout(200);
  const offensiveTacticLabels2d = await principleSelect.locator('option').allTextContents();
  const selectedTacticIndex = await principleSelect.inputValue();
  const strategyScreenshot = await screenshot(page, viewport, 'core-strategies');

  await goto(page, playRoute('3d'));
  const playPreview = page.getByTestId('vnext-3d-production-preview');
  await playPreview.waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')?.getAttribute('data-player-count') === '12'
  ), undefined, { timeout: 120_000 });
  await page.locator('.vnext3d-loading-state').waitFor({ state: 'hidden', timeout: 120_000 });
  await page.waitForFunction(() => Number(
    document.querySelector('[data-testid="vnext-3d-production-preview"]')?.getAttribute('data-frame-sample-count') ?? 0,
  ) >= 60, undefined, { timeout: 120_000 });
  await page.getByTestId('vnext3d-catalog-toggle').click();
  const playCatalog3d = page.getByTestId('vnext3d-catalog-drawer');
  await playCatalog3d.waitFor({ state: 'visible' });
  const offensivePlayIds3d = await laneItems(playCatalog3d, 'offence');
  const defensivePlayIds3d = await laneItems(playCatalog3d, 'defence');
  const playerCount3d = Number(await playPreview.getAttribute('data-player-count'));

  await goto(page, strategyRoute('3d'));
  const strategyPreview = page.getByTestId('vnext-3d-production-preview');
  await strategyPreview.waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')?.getAttribute('data-player-count') === '12'
  ), undefined, { timeout: 120_000 });
  await page.locator('.vnext3d-loading-state').waitFor({ state: 'hidden', timeout: 120_000 });
  await page.waitForFunction(() => Number(
    document.querySelector('[data-testid="vnext-3d-production-preview"]')?.getAttribute('data-frame-sample-count') ?? 0,
  ) >= 60, undefined, { timeout: 120_000 });
  await page.getByTestId('vnext3d-catalog-toggle').click();
  const tacticCatalog3d = page.getByTestId('vnext3d-catalog-drawer');
  await tacticCatalog3d.waitFor({ state: 'visible' });
  const defensiveTacticIds3d = await laneItems(tacticCatalog3d, 'defence');
  const offensiveTacticIds3d = await laneItems(tacticCatalog3d, 'offence');
  const strategyPlayerCount3d = Number(await strategyPreview.getAttribute('data-player-count'));

  await goto(page, route({ content: 'playmaker', mode: '2d' }));
  await page.locator('.playmaker-workspace').waitFor({ state: 'visible', timeout: 60_000 });
  const createLoaded = await page.locator('.playmaker-workspace').isVisible();
  const layout = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  const passed = problems.length === 0
    && exactSet(defensivePlayIds2d, corePlayIds.defence)
    && exactSet(offensivePlayIds2d, corePlayIds.offence)
    && noArchived([...defensivePlayIds2d, ...offensivePlayIds2d], archivedPlayIds)
    && selectedPlayId === 'trap'
    && archivedSearchResults === 0
    && exactSet(defensiveTacticLabels2d, coreTacticLabels.defence)
    && exactSet(offensiveTacticLabels2d, coreTacticLabels.offence)
    && selectedTacticIndex === '0'
    && exactSet(defensivePlayIds3d, corePlayIds.defence)
    && exactSet(offensivePlayIds3d, corePlayIds.offence)
    && noArchived([...defensivePlayIds3d, ...offensivePlayIds3d], archivedPlayIds)
    && playerCount3d === 12
    && exactSet(defensiveTacticIds3d, coreTacticIds.defence)
    && exactSet(offensiveTacticIds3d, coreTacticIds.offence)
    && noArchived([...defensiveTacticIds3d, ...offensiveTacticIds3d], archivedTacticIds)
    && strategyPlayerCount3d === 12
    && createLoaded
    && layout.bodyWidth <= layout.viewportWidth
    && layout.documentWidth <= layout.viewportWidth;

  results[viewport.id] = {
    viewport: [viewport.width, viewport.height],
    screenshots: { plays: playScreenshot, strategies: strategyScreenshot },
    playIds2d: {
      defence: defensivePlayIds2d,
      offence: offensivePlayIds2d,
    },
    selectedPlayIdAfterArchivedDeepLink: selectedPlayId,
    archivedSearchResults,
    tacticOptionLabels2d: {
      defence: defensiveTacticLabels2d,
      offence: offensiveTacticLabels2d,
    },
    selectedTacticIndexAfterArchivedDeepLink: selectedTacticIndex,
    playIds3d: {
      defence: defensivePlayIds3d,
      offence: offensivePlayIds3d,
    },
    playerCount3d,
    tacticIds3d: {
      defence: defensiveTacticIds3d,
      offence: offensiveTacticIds3d,
    },
    strategyPlayerCount3d,
    createLoaded,
    layout,
    problems,
    passed,
  };

  await context.close();
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  headless: true,
  visibleBrowserWindowOpened: false,
  contract: { corePlayIds, coreTacticIds },
  passed: Object.values(results).every((result) => result.passed),
  results,
};
await writeFile(
  path.join(outputDir, 'core-curriculum.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
