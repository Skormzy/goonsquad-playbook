import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'unified-play-workspace');
const baseUrl = process.env.PLAY_WORKSPACE_URL ?? 'http://127.0.0.1:55601/';
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
  throw new Error('Chrome or Edge was not found for the hidden play workspace review.');
}

function reviewUrl(mode) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries({
    content: 'plays',
    mode,
    playId: 'brk',
    phase: '1',
    time: '4.6',
    speed: '1',
    role: 'C',
    playing: 'false',
    camera: 'broadcast',
  })) url.searchParams.set(key, value);
  return url.href;
}

async function screenshot(page, viewport, name) {
  const outputPath = path.join(
    outputDir,
    `${viewport.id}-${name}-${viewport.width}x${viewport.height}.png`,
  );
  await page.screenshot({ path: outputPath, fullPage: true });
  return path.relative(root, outputPath).replaceAll('\\', '/');
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
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

  await page.goto(reviewUrl('2d'), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByTestId(`play-workspace-${viewport.id}`).waitFor({ state: 'visible' });
  if (viewport.id === 'mobile') {
    await page.locator('.play-bottom-sheet-toggle').click();
  }
  const teamPanel = page.getByTestId('team-jobs-panel');
  await teamPanel.waitFor({ state: 'visible' });
  const teamScreenshot = await screenshot(page, viewport, '2d-team-plan');
  await page.getByTestId('role-lens-wingers').click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="team-jobs-panel"]')
      ?.getAttribute('data-active-lens') === 'wingers'
  ));
  const focused2dRoles = await page.locator('[data-team="us"][data-focused="true"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-role')).sort());
  const wingerScreenshot = await screenshot(page, viewport, '2d-winger-lens');
  const twoDimensionalState = await page.evaluate(() => ({
    headerRoleControls: document.querySelectorAll('[data-testid^="workspace-role-"]').length,
    homePlayers: document.querySelectorAll('[data-team="us"]').length,
    opponentPlayers: document.querySelectorAll('[data-team="opponent"]').length,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  await page.goto(reviewUrl('3d'), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const preview = page.getByTestId('vnext-3d-production-preview');
  await preview.waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-player-count') === '12'
  ), undefined, { timeout: 120_000 });
  await page.waitForFunction(() => Number(
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-frame-sample-count') ?? 0,
  ) >= 60, undefined, { timeout: 120_000 });
  if (viewport.id === 'mobile') {
    await page.locator('.vnext3d-mobile-coaching > summary').click();
  }
  const threeDimensionalWingerLens = page.getByTestId('role-lens-wingers');
  await threeDimensionalWingerLens.waitFor({ state: 'visible' });
  await threeDimensionalWingerLens.click();
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-role-lens') === 'wingers'
  ));
  const threeDimensionalScreenshot = await screenshot(page, viewport, '3d-winger-lens');
  const threeDimensionalState = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    playerCount: Number(
      document.querySelector('[data-testid="vnext-3d-production-preview"]')
        ?.getAttribute('data-player-count') ?? 0,
    ),
    focusedRoles: document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-focused-roles'),
    roleLens: document.querySelector('[data-testid="vnext-3d-production-preview"]')
      ?.getAttribute('data-role-lens'),
  }));

  const passed = problems.length === 0
    && focused2dRoles.join(',') === 'LW,RW'
    && twoDimensionalState.headerRoleControls === 0
    && twoDimensionalState.homePlayers === 6
    && twoDimensionalState.opponentPlayers === 6
    && twoDimensionalState.bodyWidth <= twoDimensionalState.viewportWidth
    && threeDimensionalState.playerCount === 12
    && threeDimensionalState.focusedRoles === 'LW,RW'
    && threeDimensionalState.roleLens === 'wingers'
    && threeDimensionalState.bodyWidth <= threeDimensionalState.viewportWidth;

  results[viewport.id] = {
    viewport: [viewport.width, viewport.height],
    screenshots: {
      team2d: teamScreenshot,
      wingers2d: wingerScreenshot,
      wingers3d: threeDimensionalScreenshot,
    },
    focused2dRoles,
    twoDimensionalState,
    threeDimensionalState,
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
  passed: Object.values(results).every((result) => result.passed),
  results,
};
await writeFile(
  path.join(outputDir, 'unified-play-workspace.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
