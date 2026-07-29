import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'team-platform');
const baseUrl = process.env.GOONSQUAD_TEAM_PLATFORM_URL ?? 'http://127.0.0.1:55601/';
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
  throw new Error('Chrome or Edge was not found for the hidden team-platform review.');
}

function insideViewport(rect, viewport) {
  return rect
    && rect.x >= -1
    && rect.y >= -1
    && rect.x + rect.width <= viewport.width + 1
    && rect.y + rect.height <= viewport.height + 1;
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const report = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  url.search = '';
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60_000 });
  try {
    await page.locator('.stats-workspace').waitFor({ state: 'visible', timeout: 30_000 });
  } catch (error) {
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/gu, ' ').slice(0, 500);
    throw new Error(`${viewport.id}: statistics workspace did not mount. ${browserErrors.join('; ') || bodyText || error.message}`);
  }
  await page.evaluate(() => document.fonts.ready);

  const statsPath = path.join(outputDir, `${viewport.id}-statistics-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: statsPath, fullPage: false });
  const navigation = await page.locator('.workspace-primary-nav').getByRole('button').allTextContents();
  const summary = await page.locator('.stats-metric-strip').innerText();
  const matchday = await page.locator('.stats-matchday-card').allTextContents();
  const teamLabels = await page.locator('.stats-team-switcher button').allTextContents();
  const scheduleRows = await page.locator('.stats-schedule-row').allTextContents();
  const seasonOptions = await page.locator('.stats-season-controls select option').allTextContents();
  const leaderCount = await page.locator('.stats-leaders li').count();
  const sourceHref = await page.getByRole('link', { name: /Official source/u }).getAttribute('href');
  const documentOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.getByRole('tab', { name: 'Games', exact: true }).click();
  const detailButtons = page.locator('.stats-game-detail-button');
  const detailButtonCount = await detailButtons.count();
  if (detailButtonCount !== 24) throw new Error(`${viewport.id}: expected all 24 current-season games to have pages, received ${detailButtonCount}.`);
  const finalGameRow = page.locator('.stats-table tbody tr').filter({ has: page.locator('.stats-result.is-w, .stats-result.is-l, .stats-result.is-t') }).first();
  await finalGameRow.locator('.stats-game-detail-button').click();
  const gamePage = page.locator('.stats-game-page');
  await gamePage.waitFor({ state: 'visible' });
  const gamePageHref = page.url();
  const gameDetail = page.locator('.stats-game-detail');
  const gameDetailText = (await gameDetail.innerText()).replace(/\s+/gu, ' ').trim();
  const gameDetailSource = await gamePage.getByRole('link', { name: /Official game sheet/u }).getAttribute('href');
  await page.evaluate(() => window.scrollTo(0, 0));
  const gameToolbarRect = await page.locator('.stats-game-page-toolbar').boundingBox();
  const gameDetailPath = path.join(outputDir, `${viewport.id}-game-detail-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: gameDetailPath, fullPage: false });
  await gameDetail.evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -96);
  });
  const gameBoxScorePath = path.join(outputDir, `${viewport.id}-game-box-score-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: gameBoxScorePath, fullPage: false });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.stats-game-page').waitFor({ state: 'visible' });
  const deepLinkRestored = page.url() === gamePageHref && (await page.locator('.stats-game-detail').innerText()).includes('PLAYER BOX SCORE');
  await page.getByRole('button', { name: 'All games', exact: true }).click();
  await page.locator('.stats-game-page').waitFor({ state: 'hidden' });
  const gameListHref = page.url();

  const scheduledGameRow = page.locator('.stats-table tbody tr').filter({ has: page.locator('.stats-result.is-scheduled') }).first();
  await scheduledGameRow.locator('.stats-game-detail-button').click();
  const scheduledPageText = (await page.locator('.stats-game-page').innerText()).replace(/\s+/gu, ' ').trim();
  await page.getByRole('button', { name: 'All games', exact: true }).click();

  await page.locator('.stats-season-controls select').selectOption('spring-2026');
  await page.getByRole('button', { name: 'Sunday League', exact: true }).click();
  const stageLabels = await page.locator('.stats-stage-switcher button').allTextContents();

  await page.getByRole('button', { name: 'Open team account' }).click();
  const accountDialog = page.getByRole('dialog', { name: /Join the squad workspace|Your team account/u });
  await accountDialog.waitFor({ state: 'visible' });
  const accountRect = await accountDialog.boundingBox();
  const accountText = await accountDialog.innerText();
  const accountPath = path.join(outputDir, `${viewport.id}-account-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: accountPath, fullPage: false });

  report[viewport.id] = {
    viewport,
    navigation,
    homeFromBareUrl: new URL(page.url()).searchParams.get('content') === 'stats',
    summary: summary.replace(/\s+/gu, ' ').trim(),
    matchday: matchday.map((value) => value.replace(/\s+/gu, ' ').trim()),
    teamLabels,
    scheduleRows: scheduleRows.map((value) => value.replace(/\s+/gu, ' ').trim()),
    seasonOptions,
    stageLabels,
    leaderCount,
    sourceHref,
    gameDetailText,
    gameDetailSource,
    gamePageHref,
    gameListHref,
    deepLinkRestored,
    scheduledPageText,
    gameToolbarInsideViewport: insideViewport(gameToolbarRect, viewport),
    accountText: accountText.replace(/\s+/gu, ' ').trim(),
    accountInsideViewport: insideViewport(accountRect, viewport),
    documentOverflow,
    browserErrors,
    screenshots: [
      path.relative(root, statsPath).replaceAll('\\', '/'),
      path.relative(root, gameDetailPath).replaceAll('\\', '/'),
      path.relative(root, gameBoxScorePath).replaceAll('\\', '/'),
      path.relative(root, accountPath).replaceAll('\\', '/'),
    ],
  };

  if (navigation.join('|') !== 'HOME|PLAYS|STRATEGY|CREATE') throw new Error(`${viewport.id}: workspace navigation is incomplete.`);
  if (!report[viewport.id].homeFromBareUrl) throw new Error(`${viewport.id}: bare product URL did not resolve to Team Home.`);
  if (matchday.length !== 2 || !matchday[0].includes('NEXT GAME') || !matchday[1].includes('LATEST RESULT')) throw new Error(`${viewport.id}: matchday summary is incomplete.`);
  if (!summary.includes('3–16–2') || !summary.includes('21 games · 2 leagues')) throw new Error(`${viewport.id}: combined current-season record is missing.`);
  if (teamLabels.join('|') !== 'All teams|Monday / Thursday League|Sunday League') throw new Error(`${viewport.id}: current league schedules are incorrect.`);
  if (scheduleRows.length !== 2 || !scheduleRows.some((row) => row.includes('MON/THU TIER 5')) || !scheduleRows.some((row) => row.includes('SUNDAY TIER 5'))) throw new Error(`${viewport.id}: current league coverage is incomplete.`);
  if (seasonOptions.length !== 16) throw new Error(`${viewport.id}: expected 16 official seasons, received ${seasonOptions.length}.`);
  if (leaderCount < 1) throw new Error(`${viewport.id}: official player leaders are missing.`);
  if (sourceHref !== 'https://www.yorkcentralbhl.com/team/7250-goonsquad') throw new Error(`${viewport.id}: official source provenance is incorrect.`);
  if (!new URL(gamePageHref).searchParams.get('game')) throw new Error(`${viewport.id}: finalized game page is not deep-linked.`);
  if (new URL(gameListHref).searchParams.has('game')) throw new Error(`${viewport.id}: game-list return kept a stale game deep link.`);
  if (!deepLinkRestored) throw new Error(`${viewport.id}: game deep link did not survive reload.`);
  if (!insideViewport(gameToolbarRect, viewport)) throw new Error(`${viewport.id}: game-page navigation leaves the viewport.`);
  if (!gameDetailText.includes('GAME EVENTS') || !gameDetailText.includes('PLAYER BOX SCORE') || !gameDetailText.includes('GOALTENDING') || !gameDetailText.includes('PPG') || !gameDetailText.includes('SV%')) throw new Error(`${viewport.id}: verified game page is incomplete.`);
  if (!scheduledPageText.includes('Detailed statistics will appear after the game')) throw new Error(`${viewport.id}: scheduled game page does not preserve an honest pending state.`);
  if (!gameDetailSource?.startsWith('https://www.yorkcentralbhl.com/game/')) throw new Error(`${viewport.id}: game-sheet provenance is missing.`);
  if (stageLabels.join('|') !== 'Regular season|Playoffs|All games') throw new Error(`${viewport.id}: stage filtering is incomplete.`);
  if (!accountText.includes('Continue with Google') || !accountText.includes('Team statistics remain source-verified')) {
    throw new Error(`${viewport.id}: connected account launch state is unclear.`);
  }
  if (!insideViewport(accountRect, viewport)) throw new Error(`${viewport.id}: account dialog leaves the viewport.`);
  if (documentOverflow > 1) throw new Error(`${viewport.id}: page has ${documentOverflow}px horizontal overflow.`);
  if (browserErrors.length) throw new Error(`${viewport.id}: ${browserErrors.join('; ')}`);

  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
