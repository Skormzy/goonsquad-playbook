import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'competition-scopes');
const baseUrl = process.env.GOONSQUAD_STATS_URL ?? 'http://127.0.0.1:55601/';
const playerId = 'ycbhl-player-26095';
const scopeLabels = ['Regular season', 'Playoffs', 'Tournaments', 'Combined'];
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
  throw new Error('Chrome or Edge was not found for the hidden statistics review.');
}

async function capture(page, viewport, label) {
  const file = path.join(outputDir, `${viewport.id}-${label}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return path.relative(root, file).replaceAll('\\', '/');
}

function statsUrl(params = {}) {
  const url = new URL(baseUrl);
  url.search = '';
  url.searchParams.set('content', 'stats');
  url.searchParams.set('qaTeamAccess', '1');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
}

async function clippedControls(page, selector) {
  return page.locator(selector).evaluateAll((elements) => elements
    .filter((element) => (
      element.scrollWidth > element.clientWidth + 1
      || element.scrollHeight > element.clientHeight + 1
    ))
    .map((element) => element.textContent?.replace(/\s+/gu, ' ').trim()));
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const report = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.id === 'mobile' ? 2 : 1,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

  await page.goto(statsUrl(), { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.stats-workspace').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('tab', { name: 'All-time', exact: true }).click();
  await page.locator('.all-time-records').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);

  const recordScopes = {};
  const screenshots = [];
  for (const label of scopeLabels) {
    const button = page.locator('.all-time-scope-switcher button').filter({ hasText: label });
    if (await button.isDisabled()) {
      recordScopes[label] = { available: false, rows: 0 };
      continue;
    }
    await button.click();
    await button.evaluate((element) => element.getAttribute('aria-selected') === 'true');
    recordScopes[label] = {
      available: true,
      rows: await page.locator('.all-time-table tbody tr').count(),
      summary: (await page.locator('.all-time-scope-summary').innerText()).replace(/\s+/gu, ' ').trim(),
    };
  }
  screenshots.push(await capture(page, viewport, 'all-time-combined'));
  const recordScopeLabels = await page.locator('.all-time-scope-switcher strong').allTextContents();
  const recordClippedControls = await clippedControls(page, '.all-time-scope-switcher button, .all-time-mode button');

  await page.goto(statsUrl({ player: playerId }), { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.public-player-page').waitFor({ state: 'visible', timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);

  const profileScopes = {};
  for (const label of scopeLabels) {
    const button = page.locator('.public-player-competition-tabs button').filter({ hasText: label });
    if (await button.isDisabled()) {
      profileScopes[label] = { available: false, metrics: 0 };
      continue;
    }
    await button.click();
    profileScopes[label] = {
      available: true,
      metrics: await page.locator('.public-player-metric').count(),
      historyRows: await page.locator('.public-player-season-list article').count(),
      summary: (await page.locator('.public-player-competition-readout').innerText()).replace(/\s+/gu, ' ').trim(),
    };
  }
  screenshots.push(await capture(page, viewport, 'player-combined'));
  const profileScopeLabels = await page.locator('.public-player-competition-tabs strong').allTextContents();
  const profileClippedControls = await clippedControls(page, '.public-player-competition-tabs button');
  const playerName = (await page.locator('.public-player-identity h1').innerText()).trim();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const bottomNavigationVisible = viewport.id !== 'mobile'
    || await page.getByTestId('mobile-bottom-nav').isVisible();

  report[viewport.id] = {
    viewport,
    recordScopeLabels,
    recordScopes,
    recordClippedControls,
    profileScopeLabels,
    profileScopes,
    profileClippedControls,
    playerName,
    horizontalOverflow,
    bottomNavigationVisible,
    browserErrors,
    screenshots,
  };

  if (recordScopeLabels.join('|') !== scopeLabels.join('|')) {
    throw new Error(`${viewport.id}: all-time competition navigation is incomplete.`);
  }
  if (Object.values(recordScopes).some((scope) => !scope.available || scope.rows < 1)) {
    throw new Error(`${viewport.id}: an all-time competition scope is empty or unavailable.`);
  }
  if (profileScopeLabels.join('|') !== scopeLabels.join('|')) {
    throw new Error(`${viewport.id}: player competition navigation is incomplete.`);
  }
  if (Object.values(profileScopes).some((scope) => !scope.available || scope.metrics < 4)) {
    throw new Error(`${viewport.id}: an available player competition scope has incomplete metrics.`);
  }
  if (playerName !== 'Alex Grezlovski') {
    throw new Error(`${viewport.id}: the audited cross-competition player profile did not resolve.`);
  }
  if (recordClippedControls.length || profileClippedControls.length) {
    throw new Error(`${viewport.id}: competition controls clip text: ${[...recordClippedControls, ...profileClippedControls].join(', ')}`);
  }
  if (horizontalOverflow > 1) {
    throw new Error(`${viewport.id}: statistics page has ${horizontalOverflow}px horizontal overflow.`);
  }
  if (!bottomNavigationVisible) throw new Error(`${viewport.id}: mobile navigation is not visible.`);
  if (browserErrors.length) throw new Error(`${viewport.id}: ${browserErrors.join('; ')}`);

  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
