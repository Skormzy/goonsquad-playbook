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
    const text = message.text();
    const isYoutubePermissionNoise = text.includes('Permissions policy violation: compute-pressure');
    if (message.type() === 'error' && !isYoutubePermissionNoise) browserErrors.push(`console: ${text}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  url.search = '';
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60_000 });
  try {
    await page.locator('.team-home').waitFor({ state: 'visible', timeout: 30_000 });
  } catch (error) {
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/gu, ' ').slice(0, 500);
    throw new Error(`${viewport.id}: Squad Live home did not mount. ${browserErrors.join('; ') || bodyText || error.message}`);
  }
  await page.evaluate(() => document.fonts.ready);
  const homeFromBareUrl = new URL(page.url()).searchParams.get('content') === 'home';
  const navigationSurface = viewport.id === 'mobile'
    ? page.getByTestId('mobile-bottom-nav')
    : page.locator('.workspace-primary-nav');
  const navigationLabels = viewport.id === 'mobile'
    ? navigationSurface.locator(':scope > button > span:last-child')
    : navigationSurface.locator(':scope > button > span:not(.workspace-lock-tooltip)');
  const navigation = (await navigationLabels.allTextContents())
    .map((label) => label.trim().toUpperCase());
  const publicFeedLocked = await page.locator('.feed-locked').isVisible();
  const publicPulseText = (await page.locator('.team-pulse').innerText()).replace(/\s+/gu, ' ').trim();
  const homePath = path.join(outputDir, `${viewport.id}-squad-live-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: homePath, fullPage: false });

  const memberUrl = new URL(baseUrl);
  memberUrl.searchParams.set('content', 'home');
  memberUrl.searchParams.set('qaTeamAccess', '1');
  memberUrl.searchParams.set('qaFeed', '1');
  await page.goto(memberUrl.href, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.feed-post').first().waitFor({ state: 'visible', timeout: 30_000 });
  const memberPostCount = await page.locator('.feed-post').count();
  const composerVisible = await page.locator('.feed-compose-launcher').isVisible();
  const memberDocumentOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const memberHomePath = path.join(outputDir, `${viewport.id}-member-feed-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: memberHomePath, fullPage: false });

  await page.getByRole('tab', { name: 'Scores', exact: true }).click();
  const officialResultCard = page.locator('.feed-result-card').first();
  await officialResultCard.waitFor({ state: 'visible', timeout: 30_000 });
  const officialResultText = (await officialResultCard.innerText()).replace(/\s+/gu, ' ').trim();
  const officialResultPath = path.join(outputDir, `${viewport.id}-official-result-feed-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: officialResultPath, fullPage: false });

  await page.getByRole('tab', { name: 'Social', exact: true }).click();
  const youtubePost = page.locator('.feed-post.is-source.is-youtube').first();
  await youtubePost.waitFor({ state: 'visible', timeout: 30_000 });
  const youtubePostText = (await youtubePost.innerText()).replace(/\s+/gu, ' ').trim();
  const youtubePath = path.join(outputDir, `${viewport.id}-youtube-feed-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: youtubePath, fullPage: false });
  await youtubePost.getByRole('button', { name: /Play .* in the feed/u }).click();
  const youtubePlayer = youtubePost.locator('iframe');
  await youtubePlayer.waitFor({ state: 'visible', timeout: 30_000 });
  const youtubePlayerSource = await youtubePlayer.getAttribute('src');
  await page.waitForTimeout(3_000);
  const youtubePlayerFrame = page.frames().find((frame) => frame.url().startsWith('https://www.youtube-nocookie.com/embed/'));
  const youtubePlayerLoaded = Boolean(youtubePlayerFrame && (await youtubePlayerFrame.title()).trim());
  const youtubePlayerPath = path.join(outputDir, `${viewport.id}-youtube-player-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: youtubePlayerPath, fullPage: false });
  const tiktokPost = page.locator('.feed-post.is-source.is-tiktok').first();
  await tiktokPost.scrollIntoViewIfNeeded();
  const tiktokPostText = (await tiktokPost.innerText()).replace(/\s+/gu, ' ').trim();
  const tiktokPath = path.join(outputDir, `${viewport.id}-tiktok-feed-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: tiktokPath, fullPage: false });
  await page.getByRole('tab', { name: 'All', exact: true }).click();

  await page.getByTestId(viewport.id === 'mobile' ? 'mobile-nav-stats' : 'workspace-content-stats').click();
  await page.locator('.stats-workspace').waitFor({ state: 'visible', timeout: 30_000 });
  const statsPath = path.join(outputDir, `${viewport.id}-statistics-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: statsPath, fullPage: false });
  const summary = await page.locator('.stats-metric-strip').innerText();
  const matchday = await page.locator('.stats-matchday-card').allTextContents();
  const teamLabels = await page.locator('.stats-team-switcher button').allTextContents();
  const scheduleRows = await page.locator('.stats-schedule-row').allTextContents();
  const seasonOptions = await page.locator('.stats-season-controls select option').allTextContents();
  const leaderCount = await page.locator('.stats-leaders-table tbody tr').count();
  const sourceHref = await page.getByRole('link', { name: /Open official source for YCBHL · Monday Tier 5 League/u }).getAttribute('href');
  const documentOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
  await page.locator('.stats-schedule-dashboard').waitFor({ state: 'visible' });
  const scheduleSummary = (await page.locator('.stats-schedule-dashboard').innerText()).replace(/\s+/gu, ' ').trim();
  const upcomingFixtureCount = await page.locator('.stats-fixture-row[data-kind="upcoming"]').count();
  const awaitingFixtureCount = await page.locator('.stats-fixture-row[data-kind="awaiting"]').count();
  const completedFixtureCount = await page.locator('.stats-table tbody tr').count();
  if (upcomingFixtureCount + awaitingFixtureCount + completedFixtureCount === 0) {
    throw new Error(`${viewport.id}: league schedule mounted without any fixtures.`);
  }
  const schedulePath = path.join(outputDir, `${viewport.id}-league-schedule-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: schedulePath, fullPage: false });
  const scheduledGameRow = page.locator('.stats-fixture-row[data-kind="upcoming"]').first();
  const scheduledGameCount = await scheduledGameRow.count();
  let scheduledPageText = '';
  if (scheduledGameCount > 0) {
    await scheduledGameRow.getByRole('button').click();
    scheduledPageText = (await page.locator('.stats-game-page').innerText()).replace(/\s+/gu, ' ').trim();
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  }

  await page.locator('.stats-season-controls select').selectOption('summer-2026');
  await page.locator('.stats-table tbody tr').first().waitFor({ state: 'visible' });
  const finalGameRow = page.locator('.stats-table tbody tr').filter({ has: page.locator('.stats-result.is-w, .stats-result.is-l, .stats-result.is-t') }).first();
  const finalGameCount = await finalGameRow.count();
  let gameDetailText = '';
  let gameDetailSource = '';
  let gameToolbarRect = null;
  let deepLinkRestored = true;
  let gamePageHref = '';
  const gameDetailPath = path.join(outputDir, `${viewport.id}-game-detail-${viewport.width}x${viewport.height}.png`);
  const gameBoxScorePath = path.join(outputDir, `${viewport.id}-game-box-score-${viewport.width}x${viewport.height}.png`);
  if (finalGameCount > 0) {
    await finalGameRow.locator('.stats-game-detail-button').click();
    const gamePage = page.locator('.stats-game-page');
    await gamePage.waitFor({ state: 'visible' });
    gamePageHref = page.url();
    const gameDetail = page.locator('.stats-game-detail');
    gameDetailText = (await gameDetail.innerText()).replace(/\s+/gu, ' ').trim();
    gameDetailSource = await gamePage.getByRole('link', { name: /Official game sheet/u }).getAttribute('href');
    await page.evaluate(() => window.scrollTo(0, 0));
    gameToolbarRect = await page.locator('.stats-game-page-toolbar').boundingBox();
    await page.screenshot({ path: gameDetailPath, fullPage: false });
    await gameDetail.evaluate((element) => {
      element.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -96);
    });
    await page.screenshot({ path: gameBoxScorePath, fullPage: false });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.stats-game-page').waitFor({ state: 'visible' });
    deepLinkRestored = page.url() === gamePageHref && (await page.locator('.stats-game-detail').innerText()).includes('PLAYER BOX SCORE');
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await page.locator('.stats-game-page').waitFor({ state: 'hidden' });
  }
  const gameListHref = page.url();

  await page.locator('.stats-season-controls select').selectOption('spring-2026');
  await page.getByRole('button', { name: /Sunday Tier 5 League\s+YCBHL/u }).click();
  const stageLabels = await page.locator('.stats-stage-switcher button').allTextContents();

  await page.getByRole('button', { name: 'Tournaments', exact: true }).click();
  const tournamentWorkspace = page.locator('.tournament-workspace');
  await tournamentWorkspace.waitFor({ state: 'visible' });
  const tournamentUrl = new URL(page.url());
  const tournamentText = (await tournamentWorkspace.innerText()).replace(/\s+/gu, ' ').trim();
  const tournamentSelectorLabels = (await page.locator('.stats-tournament-selector button').allTextContents())
    .map((value) => value.replace(/\s+/gu, ' ').trim());
  const tournamentTabs = await page.locator('.tournament-tabs button').allTextContents();
  const tournamentOverviewPath = path.join(outputDir, `${viewport.id}-tournament-overview-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: tournamentOverviewPath, fullPage: false });

  await page.locator('.tournament-tabs button').nth(1).click();
  await page.locator('.tournament-pool-switcher').getByRole('tab', { name: /Pool D/u }).click();
  const tournamentStandingsText = (await page.locator('.tournament-panel').innerText()).replace(/\s+/gu, ' ').trim();
  const tournamentStandingsPath = path.join(outputDir, `${viewport.id}-tournament-standings-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: tournamentStandingsPath, fullPage: false });

  await page.locator('.tournament-tabs button').nth(2).click();
  const tournamentBracketText = (await page.locator('.tournament-panel').innerText()).replace(/\s+/gu, ' ').trim();
  const tournamentBracketPath = path.join(outputDir, `${viewport.id}-tournament-bracket-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: tournamentBracketPath, fullPage: false });

  await page.locator('.tournament-tabs button').nth(3).click();
  const tournamentGameCount = await page.locator('.tournament-all-games > .tournament-event-game').count();
  const tournamentGamesPath = path.join(outputDir, `${viewport.id}-tournament-games-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: tournamentGamesPath, fullPage: false });
  const tournamentDocumentOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.locator('.stats-tournament-selector button').filter({ hasText: 'Mississauga 2024' }).click();
  await page.locator('.tournament-hero h2').filter({ hasText: '2024 OBHF Summer Provincials' }).waitFor({ state: 'visible' });
  const tournament2024Url = new URL(page.url());
  const tournament2024Text = (await tournamentWorkspace.innerText()).replace(/\s+/gu, ' ').trim();
  const tournament2024Path = path.join(outputDir, `${viewport.id}-tournament-2024-overview-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: tournament2024Path, fullPage: false });
  await page.locator('.tournament-tabs button').nth(2).click();
  const tournament2024BracketText = (await page.locator('.tournament-panel').innerText()).replace(/\s+/gu, ' ').trim();
  const tournament2024BracketPath = path.join(outputDir, `${viewport.id}-tournament-2024-bracket-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: tournament2024BracketPath, fullPage: false });

  await page.getByRole('button', { name: 'Open team account' }).click();
  const accountDialog = page.getByRole('dialog', { name: /Join the squad workspace|Your team account/u });
  const accountWorkspace = page.locator('.account-workspace');
  const accountSurface = await accountDialog.isVisible().catch(() => false)
    ? accountDialog
    : accountWorkspace;
  await accountSurface.waitFor({ state: 'visible' });
  const accountRect = await accountSurface.boundingBox();
  const accountText = await accountSurface.innerText();
  const accountInsideViewport = Boolean(
    accountRect
    && accountRect.x >= -1
    && accountRect.y >= -1
    && accountRect.x + accountRect.width <= viewport.width + 1
  );
  const accountPath = path.join(outputDir, `${viewport.id}-account-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: accountPath, fullPage: false });

  report[viewport.id] = {
    viewport,
    navigation,
    homeFromBareUrl,
    publicFeedLocked,
    publicPulseText,
    memberPostCount,
    composerVisible,
    memberDocumentOverflow,
    officialResultText,
    youtubePostText,
    youtubePlayerSource,
    youtubePlayerLoaded,
    tiktokPostText,
    summary: summary.replace(/\s+/gu, ' ').trim(),
    matchday: matchday.map((value) => value.replace(/\s+/gu, ' ').trim()),
    teamLabels,
    scheduleRows: scheduleRows.map((value) => value.replace(/\s+/gu, ' ').trim()),
    seasonOptions,
    stageLabels,
    tournamentText,
    tournamentSelectorLabels,
    tournamentTabs,
    tournamentStandingsText,
    tournamentBracketText,
    tournamentGameCount,
    tournamentUrl: tournamentUrl.href,
    tournamentDocumentOverflow,
    tournament2024Text,
    tournament2024BracketText,
    tournament2024Url: tournament2024Url.href,
    leaderCount,
    sourceHref,
    scheduleSummary,
    upcomingFixtureCount,
    awaitingFixtureCount,
    completedFixtureCount,
    gameDetailText,
    gameDetailSource,
    gamePageHref,
    gameListHref,
    deepLinkRestored,
    scheduledGameCount,
    scheduledPageText,
    gameToolbarInsideViewport: insideViewport(gameToolbarRect, viewport),
    accountText: accountText.replace(/\s+/gu, ' ').trim(),
    accountInsideViewport,
    documentOverflow,
    browserErrors,
    screenshots: [
      path.relative(root, homePath).replaceAll('\\', '/'),
      path.relative(root, memberHomePath).replaceAll('\\', '/'),
      path.relative(root, officialResultPath).replaceAll('\\', '/'),
      path.relative(root, youtubePath).replaceAll('\\', '/'),
      path.relative(root, youtubePlayerPath).replaceAll('\\', '/'),
      path.relative(root, tiktokPath).replaceAll('\\', '/'),
      path.relative(root, statsPath).replaceAll('\\', '/'),
      path.relative(root, schedulePath).replaceAll('\\', '/'),
      path.relative(root, tournamentOverviewPath).replaceAll('\\', '/'),
      path.relative(root, tournamentStandingsPath).replaceAll('\\', '/'),
      path.relative(root, tournamentBracketPath).replaceAll('\\', '/'),
      path.relative(root, tournamentGamesPath).replaceAll('\\', '/'),
      path.relative(root, tournament2024Path).replaceAll('\\', '/'),
      path.relative(root, tournament2024BracketPath).replaceAll('\\', '/'),
      path.relative(root, gameDetailPath).replaceAll('\\', '/'),
      path.relative(root, gameBoxScorePath).replaceAll('\\', '/'),
      path.relative(root, accountPath).replaceAll('\\', '/'),
    ],
  };

  if (navigation.join('|') !== 'HOME|STATS|PLAYS|STRATEGY|CREATE') throw new Error(`${viewport.id}: workspace navigation is incomplete.`);
  if (!report[viewport.id].homeFromBareUrl) throw new Error(`${viewport.id}: bare product URL did not resolve to Team Home.`);
  if (!publicFeedLocked) throw new Error(`${viewport.id}: public visitors can see the private feed.`);
  if (!publicPulseText.includes('SEASON RECORD') || !publicPulseText.includes('LATEST RESULT')) throw new Error(`${viewport.id}: public game pulse is incomplete.`);
  if (memberPostCount < 2 || !composerVisible) throw new Error(`${viewport.id}: approved-member feed is incomplete.`);
  if (memberDocumentOverflow > 1) throw new Error(`${viewport.id}: member feed has ${memberDocumentOverflow}px horizontal overflow.`);
  if (
    !officialResultText.toUpperCase().includes('GOONSQUAD')
    || !/9\s*[–-]\s*4/u.test(officialResultText)
    || !officialResultText.toUpperCase().includes('FULL GAME SHEET')
  ) {
    throw new Error(`${viewport.id}: official result feed card is incomplete.`);
  }
  if (
    !youtubePostText.includes('Goonsquad vs Dew Lang Ducks')
    || !youtubePostText.includes('Open in YouTube')
  ) {
    throw new Error(`${viewport.id}: YouTube feed card is incomplete.`);
  }
  if (!youtubePlayerSource?.startsWith('https://www.youtube-nocookie.com/embed/6CS-I7In7bA?')) {
    throw new Error(`${viewport.id}: YouTube video did not open in the feed.`);
  }
  if (!youtubePlayerLoaded) throw new Error(`${viewport.id}: YouTube player document did not finish loading.`);
  if (
    !tiktokPostText.includes('New from Goonsquad on TikTok')
    || !tiktokPostText.includes('Open in TikTok')
  ) {
    throw new Error(`${viewport.id}: TikTok feed card is incomplete.`);
  }
  if (matchday.length !== 2 || !matchday[0].includes('NEXT GAME') || !matchday[1].includes('LATEST RESULT')) throw new Error(`${viewport.id}: matchday summary is incomplete.`);
  if (!/\d+–\d+–\d+/u.test(summary) || !/\d+ games · YCBHL/u.test(summary)) {
    throw new Error(`${viewport.id}: combined current-season record is missing.`);
  }
  const normalizedTeamLabels = teamLabels.map((label) => label.replace(/\s+/gu, ''));
  const expectedTeamLabels = [
    'Allteams',
    'MondayTier5LeagueYCBHL',
    'SundayTier4LeagueYCBHL',
    'SundayTier5LeagueYCBHL',
    'Tournaments',
  ];
  if (expectedTeamLabels.some((label) => !normalizedTeamLabels.includes(label))) throw new Error(`${viewport.id}: current competition navigation is incorrect.`);
  if (
    scheduleRows.length !== 3
    || !scheduleRows.some((row) => row.includes('MON/WED TIER 5'))
    || !scheduleRows.some((row) => row.includes('SUNDAY TIER 4'))
    || !scheduleRows.some((row) => row.includes('SUNDAY TIER 5'))
  ) throw new Error(`${viewport.id}: current league coverage is incomplete.`);
  if (seasonOptions.length < 16) throw new Error(`${viewport.id}: historical season archive is incomplete (${seasonOptions.length}).`);
  if (leaderCount < 1) throw new Error(`${viewport.id}: official player leaders are missing.`);
  if (sourceHref !== 'https://www.yorkcentralbhl.com/team/7250-goonsquad') throw new Error(`${viewport.id}: official source provenance is incorrect.`);
  if (!scheduleSummary.includes('SEASON SCHEDULE') || !scheduleSummary.includes('UPCOMING')) throw new Error(`${viewport.id}: league schedule summary is incomplete.`);
  if (!new URL(gamePageHref).searchParams.get('game')) throw new Error(`${viewport.id}: finalized game page is not deep-linked.`);
  if (new URL(gameListHref).searchParams.has('game')) throw new Error(`${viewport.id}: game-list return kept a stale game deep link.`);
  if (!deepLinkRestored) throw new Error(`${viewport.id}: game deep link did not survive reload.`);
  if (!insideViewport(gameToolbarRect, viewport)) throw new Error(`${viewport.id}: game-page navigation leaves the viewport.`);
  if (!gameDetailText.includes('GAME EVENTS') || !gameDetailText.includes('PLAYER BOX SCORE') || !gameDetailText.includes('GOALTENDING') || !gameDetailText.includes('PPG') || !gameDetailText.includes('SV%')) throw new Error(`${viewport.id}: verified game page is incomplete.`);
  if (
    scheduledGameCount > 0
    && (
      !scheduledPageText.includes('HEAD TO HEAD')
      || !scheduledPageText.includes('NEXT MEETING')
      || !scheduledPageText.includes('Verified matchup context')
    )
  ) {
    throw new Error(`${viewport.id}: scheduled game did not open a complete head-to-head page.`);
  }
  if (!gameDetailSource?.startsWith('https://www.yorkcentralbhl.com/game/')) throw new Error(`${viewport.id}: game-sheet provenance is missing.`);
  if (stageLabels.join('|') !== 'Regular season|Playoffs|All games') throw new Error(`${viewport.id}: stage filtering is incomplete.`);
  if (
    tournamentUrl.searchParams.get('competition') !== 'tournaments'
    || tournamentUrl.searchParams.get('tournament') !== '2026-oshawa-provincials'
  ) {
    throw new Error(`${viewport.id}: tournament deep link is incomplete.`);
  }
  const normalizedTournamentText = tournamentText.toLowerCase();
  if (
    !tournamentText.includes('2026 Oshawa Provincials')
    || !normalizedTournamentText.includes('semifinalist')
    || !normalizedTournamentText.includes('4-1-0')
    || !normalizedTournamentText.includes('game by game')
    || !normalizedTournamentText.includes('alex grezlovski')
  ) {
    throw new Error(`${viewport.id}: tournament overview is incomplete.`);
  }
  if (tournamentTabs.join('|') !== 'Weekend|Round robin|Full bracket|All games') throw new Error(`${viewport.id}: tournament dossier navigation is incomplete.`);
  if (
    !tournamentSelectorLabels.some((label) => label.startsWith('Oshawa 2026'))
    || !tournamentSelectorLabels.some((label) => label.startsWith('Mississauga 2024'))
  ) {
    throw new Error(`${viewport.id}: tournament archive selector is incomplete.`);
  }
  if (
    !tournamentStandingsText.toUpperCase().includes('OFFICIAL PRELIMINARY TABLE')
    || !tournamentStandingsText.includes('Goonsquad')
    || !tournamentStandingsText.includes('Brampton All Blacks')
    || !tournamentStandingsText.includes('Brown Royal')
  ) throw new Error(`${viewport.id}: tournament standings are incomplete.`);
  if (
    !tournamentBracketText.includes('Quarterfinal')
    || !tournamentBracketText.includes('Semifinal')
    || !tournamentBracketText.includes('Championship')
    || !tournamentBracketText.includes('New Tecumseth Outlaws')
  ) throw new Error(`${viewport.id}: tournament bracket path is incomplete.`);
  if (tournamentGameCount !== 28) throw new Error(`${viewport.id}: expected the complete 28-game event archive, received ${tournamentGameCount}.`);
  if (tournamentDocumentOverflow > 1) throw new Error(`${viewport.id}: tournament workspace has ${tournamentDocumentOverflow}px horizontal overflow.`);
  if (
    tournament2024Url.searchParams.get('tournament') !== '2024-mississauga-provincials'
    || !tournament2024Text.includes('2024 OBHF Summer Provincials')
    || !tournament2024Text.includes('Blades of Steel')
    || !tournament2024Text.includes('Spartans')
    || !tournament2024Text.includes('Cambridge Thunder')
  ) {
    throw new Error(`${viewport.id}: 2024 tournament dossier is incomplete.`);
  }
  if (
    !tournament2024BracketText.includes('Semifinals')
    || !tournament2024BracketText.includes('Championship')
    || !tournament2024BracketText.includes('Cambridge Thunder')
    || !tournament2024BracketText.includes('Blades of Steel')
  ) {
    throw new Error(`${viewport.id}: 2024 tournament bracket is incomplete.`);
  }
  if (
    !accountText.includes('Display name')
    || !accountText.includes('Username')
    || !accountText.includes('Email')
    || !accountText.includes('Password')
    || !accountText.includes('Keep me signed in on this device')
    || !accountText.includes('Create account')
  ) {
    throw new Error(`${viewport.id}: connected account launch state is unclear.`);
  }
  if (!accountInsideViewport) throw new Error(`${viewport.id}: account workspace leaves the viewport horizontally.`);
  if (documentOverflow > 1) throw new Error(`${viewport.id}: page has ${documentOverflow}px horizontal overflow.`);
  if (browserErrors.length) throw new Error(`${viewport.id}: ${browserErrors.join('; ')}`);

  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
