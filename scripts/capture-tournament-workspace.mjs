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
    serviceWorkers: 'block',
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

  await page.getByRole('tab', { name: 'Round robin', exact: true }).click();
  await page.locator('.tournament-round-robin').scrollIntoViewIfNeeded();
  const poolTabs = await page.locator('.tournament-pool-switcher [role="tab"]').count();
  await page.locator('.tournament-pool-switcher').getByRole('tab', { name: /Pool D/u }).click();
  screenshots.push(await capture(page, viewport, 'round-robin'));
  const standingsRows = await page.locator('.tournament-standings-table [role="row"]').count();
  const standingsText = (await page.locator('.tournament-round-robin').innerText()).replace(/\s+/gu, ' ').trim();

  await page.getByRole('tab', { name: 'Full bracket', exact: true }).click();
  await page.locator('.tournament-bracket-shell').scrollIntoViewIfNeeded();
  screenshots.push(await capture(page, viewport, 'full-bracket'));
  const bracketRounds = await page.locator('.tournament-bracket-round-label').count();
  const bracketMatches = await page.locator('.tournament-bracket-match').count();
  const bracketConnectors = await page.locator('.tournament-bracket-connectors path').count();
  const bracketText = (await page.locator('.tournament-bracket-shell').innerText()).replace(/\s+/gu, ' ').trim();

  await page.getByRole('tab', { name: 'All games', exact: true }).click();
  await page.locator('.tournament-games').scrollIntoViewIfNeeded();
  screenshots.push(await capture(page, viewport, 'all-games'));
  const gameFilters = await page.locator('.tournament-game-filters button').count();
  const gameRows = await page.locator('.tournament-all-games .tournament-event-game').count();
  const gamebookText = (await page.locator('.tournament-games').innerText()).replace(/\s+/gu, ' ').trim();

  await page.locator('.tournament-event-game').filter({ hasText: '#54' }).click();
  await page.locator('.tournament-game-page').waitFor({ state: 'visible' });
  screenshots.push(await capture(page, viewport, 'championship-game'));
  const gamePageText = (await page.locator('.tournament-game-page').innerText()).replace(/\s+/gu, ' ').trim();
  const internalGameUrl = page.url();
  await page.getByRole('button', { name: 'Back to tournament' }).click();
  await page.getByRole('tab', { name: 'All games', exact: true }).click();
  await page.locator('.tournament-event-game').filter({ hasText: '#49' }).click();
  await page.locator('.tournament-official-detail').waitFor({ state: 'visible' });
  const quarterfinalDetailText = (await page.locator('.tournament-official-detail').innerText()).replace(/\s+/gu, ' ').trim();
  const quarterfinalGoals = await page.locator('.tournament-official-event.is-goal').count();
  const quarterfinalPenalties = await page.locator('.tournament-official-event.is-penalty').count();
  const quarterfinalBoxScores = await page.locator('.tournament-team-boxscore').count();
  const quarterfinalGameUrl = page.url();
  await page.locator('.tournament-official-detail').scrollIntoViewIfNeeded();
  screenshots.push(await capture(page, viewport, 'quarterfinal-49-detail'));

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  const mississaugaUrl = new URL(baseUrl);
  mississaugaUrl.search = '';
  mississaugaUrl.searchParams.set('content', 'stats');
  mississaugaUrl.searchParams.set('competition', 'tournaments');
  mississaugaUrl.searchParams.set('tournament', '2024-mississauga-provincials');
  mississaugaUrl.searchParams.set('qaTeamAccess', '1');
  await page.goto(mississaugaUrl.href, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.tournament-workspace').waitFor({ state: 'visible', timeout: 30_000 });
  screenshots.push(await capture(page, viewport, '2024-overview'));
  const mississaugaOverviewText = (await page.locator('.tournament-workspace').innerText()).replace(/\s+/gu, ' ').trim();
  const mississaugaTeamGames = await page.locator('.tournament-game-card').count();

  await page.getByRole('tab', { name: 'Round robin', exact: true }).click();
  const mississaugaPoolTabs = await page.locator('.tournament-pool-switcher [role="tab"]').count();
  const mississaugaStandingsRows = await page.locator('.tournament-standings-table [role="row"]').count();
  const mississaugaRoundRobinText = (await page.locator('.tournament-round-robin').innerText()).replace(/\s+/gu, ' ').trim();
  screenshots.push(await capture(page, viewport, '2024-round-robin'));

  await page.getByRole('tab', { name: 'Full bracket', exact: true }).click();
  const mississaugaBracketMatches = await page.locator('.tournament-bracket-match').count();
  const mississaugaBracketText = (await page.locator('.tournament-bracket-shell').innerText()).replace(/\s+/gu, ' ').trim();
  screenshots.push(await capture(page, viewport, '2024-bracket'));

  await page.getByRole('tab', { name: 'All games', exact: true }).click();
  const mississaugaGameRows = await page.locator('.tournament-all-games .tournament-event-game').count();
  await page.locator('.tournament-event-game').filter({ hasText: '#44' }).click();
  await page.locator('.tournament-game-page').waitFor({ state: 'visible' });
  const mississaugaGameText = (await page.locator('.tournament-game-page').innerText()).replace(/\s+/gu, ' ').trim();
  const mississaugaGameUrl = page.url();
  screenshots.push(await capture(page, viewport, '2024-championship-game'));
  await page.getByRole('button', { name: 'Back to tournament' }).click();
  await page.locator('.tournament-event-game').filter({ hasText: '#32' }).click();
  await page.locator('.tournament-game-page').waitFor({ state: 'visible' });
  const mississaugaGoonsquadGameText = (await page.locator('.tournament-game-page').innerText()).replace(/\s+/gu, ' ').trim();
  const mississaugaGoonsquadGameUrl = page.url();
  screenshots.push(await capture(page, viewport, '2024-goonsquad-game'));
  const mississaugaOverflow = await page.evaluate(
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
    poolTabs,
    standingsRows,
    bracketRounds,
    bracketMatches,
    bracketConnectors,
    gameFilters,
    gameRows,
    gamePageText,
    internalGameUrl,
    quarterfinalDetailText,
    quarterfinalGoals,
    quarterfinalPenalties,
    quarterfinalBoxScores,
    quarterfinalGameUrl,
    mississauga2024: {
      teamGames: mississaugaTeamGames,
      poolTabs: mississaugaPoolTabs,
      standingsRows: mississaugaStandingsRows,
      bracketMatches: mississaugaBracketMatches,
      gameRows: mississaugaGameRows,
      gameUrl: mississaugaGameUrl,
      goonsquadGameUrl: mississaugaGoonsquadGameUrl,
      horizontalOverflow: mississaugaOverflow,
    },
    horizontalOverflow,
    bottomNavigationVisible,
    browserErrors,
    screenshots,
  };

  if (!overviewText.includes('Semifinalist') || !overviewText.includes('4-1-0')) {
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
  if (!selectorLabels.some((label) => label.includes('Oshawa 2026'))
    || !selectorLabels.some((label) => label.includes('Mississauga 2024'))
    || tabs.join('|') !== 'Weekend|Round robin|Full bracket|All games') {
    throw new Error(`${viewport.id}: tournament navigation is incomplete.`);
  }
  if (poolTabs !== 4 || standingsRows !== 4 || !standingsText.includes('Goonsquad') || !standingsText.includes('Brampton All Blacks')) {
    throw new Error(`${viewport.id}: official standings are incomplete.`);
  }
  if (bracketRounds !== 3 || bracketMatches !== 7 || bracketConnectors !== 9 || !bracketText.includes('Quarterfinal') || !bracketText.includes('Championship')) {
    throw new Error(`${viewport.id}: tournament path is incomplete.`);
  }
  if (gameFilters !== 4 || gameRows !== 28 || !gamebookText.includes('New Tecumseth Outlaws')) {
    throw new Error(`${viewport.id}: official gamebook is incomplete.`);
  }
  if (!gamePageText.includes('New Tecumseth Outlaws') || !gamePageText.includes('Canadian Brew Crew') || !gamePageText.includes('6-4') || !internalGameUrl.includes('tournamentGame=2026-oshawa-official-54')) {
    throw new Error(`${viewport.id}: tournament scores do not open a complete in-app game page.`);
  }
  if (quarterfinalGoals !== 4 || quarterfinalPenalties !== 2 || quarterfinalBoxScores !== 2
    || !quarterfinalDetailText.includes('Alex Grezlovski')
    || !quarterfinalDetailText.includes('Cross Checking - 4 Minute')
    || !quarterfinalDetailText.includes('Body Contact')
    || !quarterfinalGameUrl.includes('tournamentGame=2026-oshawa-official-49')) {
    throw new Error(`${viewport.id}: official scoring, penalties, or player box scores are incomplete.`);
  }
  if (!mississaugaOverviewText.includes('2024 OBHF Summer Provincials') || mississaugaTeamGames !== 3) {
    throw new Error(`${viewport.id}: the 2024 tournament dossier is incomplete.`);
  }
  if (mississaugaPoolTabs !== 2 || mississaugaStandingsRows !== 5 || !mississaugaRoundRobinText.includes('Cambridge Thunder') || !mississaugaRoundRobinText.includes('Goonsquad') || mississaugaRoundRobinText.includes('Result unavailable')) {
    throw new Error(`${viewport.id}: the verified 2024 round-robin table is incomplete.`);
  }
  if (mississaugaBracketMatches !== 3 || !mississaugaBracketText.includes('Blades of Steel') || !mississaugaBracketText.includes('Cambridge Thunder') || !mississaugaBracketText.includes('Woodstock Toros') || !mississaugaBracketText.includes('Moosehead')) {
    throw new Error(`${viewport.id}: the 2024 elimination bracket is incomplete.`);
  }
  if (mississaugaGameRows !== 15 || !mississaugaGameText.includes('Blades of Steel') || !mississaugaGameText.includes('Cambridge Thunder') || !mississaugaGameText.includes('1-0') || mississaugaGameText.includes('GOONSQUAD GAME FILE') || !mississaugaGameUrl.includes('tournamentGame=2024-mississauga-final')) {
    throw new Error(`${viewport.id}: the verified 2024 championship does not open as an in-app game.`);
  }
  if (!mississaugaGoonsquadGameText.includes('Goonsquad') || !mississaugaGoonsquadGameText.includes('Blades of Steel') || !mississaugaGoonsquadGameText.includes('1-8') || !mississaugaGoonsquadGameText.includes('GOONSQUAD GAME FILE') || !mississaugaGoonsquadGameUrl.includes('tournamentGame=2024-mississauga-game-rr-3')) {
    throw new Error(`${viewport.id}: the recovered 2024 Goonsquad result does not open as a complete in-app game.`);
  }
  if (horizontalOverflow > 1) throw new Error(`${viewport.id}: tournament page has ${horizontalOverflow}px horizontal overflow.`);
  if (mississaugaOverflow > 1) throw new Error(`${viewport.id}: 2024 tournament page has ${mississaugaOverflow}px horizontal overflow.`);
  if (!bottomNavigationVisible) throw new Error(`${viewport.id}: mobile navigation is not visible.`);
  if (browserErrors.length) throw new Error(`${viewport.id}: ${browserErrors.join('; ')}`);

  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
