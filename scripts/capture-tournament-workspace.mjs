import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'tournaments');
const baseUrl = process.env.GOONSQUAD_TOURNAMENT_URL ?? 'http://127.0.0.1:55601/';
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
  throw new Error('Chrome or Edge was not found for the hidden tournament review.');
}

async function capture(page, viewport, label) {
  const file = path.join(outputDir, `${viewport.id}-${label}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return path.relative(root, file).replaceAll('\\', '/');
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
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  url.search = '';
  url.searchParams.set('content', 'stats');
  url.searchParams.set('competition', 'tournaments');
  url.searchParams.set('tournament', '2026-oshawa-provincials');
  url.searchParams.set('qaTeamAccess', '1');
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.tournament-workspace').waitFor({ state: 'visible', timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);

  const screenshots = [];
  screenshots.push(await capture(page, viewport, 'overview-top'));

  const overviewText = (await page.locator('.tournament-workspace').innerText()).replace(/\s+/gu, ' ').trim();
  const gameCards = await page.locator('.tournament-game-card').count();
  const leaderCards = await page.locator('.tournament-leader-cards article').count();
  const scorerRows = await page.locator('.tournament-scorer-board > div').count();
  const goalieRows = await page.locator('.tournament-goalie-board article').count();
  const metricLayout = await page.locator('.tournament-metric-strip').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      cards: element.children.length,
      width: Math.round(bounds.width),
      viewportWidth: document.documentElement.clientWidth,
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
    };
  });
  const selectorLabels = (await page.locator('.stats-tournament-selector button').allTextContents())
    .map((value) => value.replace(/\s+/gu, ' ').trim());
  const tabs = (await page.locator('.tournament-tabs button').allTextContents()).map((value) => value.trim());

  await page.getByRole('tab', { name: 'Pool D', exact: true }).click();
  await page.locator('.tournament-standings').scrollIntoViewIfNeeded();
  screenshots.push(await capture(page, viewport, 'standings'));
  const standingsRows = await page.locator('.tournament-standings-table [role="row"]').count();
  const standingsText = (await page.locator('.tournament-standings').innerText()).replace(/\s+/gu, ' ').trim();

  await page.getByRole('tab', { name: 'Road to Final', exact: true }).click();
  await page.locator('.tournament-bracket-shell').scrollIntoViewIfNeeded();
  screenshots.push(await capture(page, viewport, 'road-to-final'));
  const bracketRounds = await page.locator('.tournament-bracket-round').count();
  const bracketText = (await page.locator('.tournament-bracket-shell').innerText()).replace(/\s+/gu, ' ').trim();

  await page.getByRole('tab', { name: 'Gamebook', exact: true }).click();
  await page.locator('.tournament-games').scrollIntoViewIfNeeded();
  screenshots.push(await capture(page, viewport, 'gamebook'));
  const gameRows = await page.locator('.tournament-game-row').count();
  const officialGameLinks = await page.locator('.tournament-official-game').count();
  const videoLinks = await page.locator('.tournament-video').count();
  const gamebookText = (await page.locator('.tournament-games').innerText()).replace(/\s+/gu, ' ').trim();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const bottomNavigationVisible = viewport.id !== 'mobile'
    || await page.getByTestId('mobile-bottom-nav').isVisible();

  report[viewport.id] = {
    viewport,
    selectorLabels,
    tabs,
    gameCards,
    leaderCards,
    scorerRows,
    goalieRows,
    metricLayout,
    standingsRows,
    bracketRounds,
    gameRows,
    officialGameLinks,
    videoLinks,
    horizontalOverflow,
    bottomNavigationVisible,
    browserErrors,
    screenshots,
  };

  if (!overviewText.includes('Championship finalist') || !overviewText.includes('4-1-0')) {
    throw new Error(`${viewport.id}: verified tournament finish and record are missing.`);
  }
  if (gameCards !== 5 || leaderCards !== 4 || scorerRows !== 5 || goalieRows !== 2) {
    throw new Error(`${viewport.id}: tournament overview is incomplete.`);
  }
  if (metricLayout.cards !== 4 || metricLayout.width > metricLayout.viewportWidth) {
    throw new Error(`${viewport.id}: tournament snapshot metrics are clipped or incomplete.`);
  }
  if (viewport.id === 'mobile' && metricLayout.columns !== 2) {
    throw new Error(`${viewport.id}: tournament snapshot metrics must use two readable columns.`);
  }
  if (selectorLabels.length !== 2 || tabs.join('|') !== 'Weekend|Pool D|Road to Final|Gamebook') {
    throw new Error(`${viewport.id}: tournament navigation is incomplete.`);
  }
  if (standingsRows !== 4 || !standingsText.includes('Goonsquad') || !standingsText.includes('Brampton All Blacks')) {
    throw new Error(`${viewport.id}: official standings are incomplete.`);
  }
  if (bracketRounds !== 3 || !bracketText.includes('Quarterfinal') || !bracketText.includes('Championship')) {
    throw new Error(`${viewport.id}: tournament path is incomplete.`);
  }
  if (gameRows !== 5 || officialGameLinks !== 5 || videoLinks !== 6 || !gamebookText.includes('New Tecumseth Outlaws')) {
    throw new Error(`${viewport.id}: official gamebook is incomplete.`);
  }
  if (horizontalOverflow > 1) throw new Error(`${viewport.id}: tournament page has ${horizontalOverflow}px horizontal overflow.`);
  if (!bottomNavigationVisible) throw new Error(`${viewport.id}: mobile navigation is not visible.`);
  if (browserErrors.length) throw new Error(`${viewport.id}: ${browserErrors.join('; ')}`);

  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
