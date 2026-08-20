import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'home-side-rail');
const baseUrl = process.env.GOONSQUAD_HOME_URL ?? 'http://127.0.0.1:55601/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const viewports = [
  { id: 'desktop', width: 1440, height: 900, stickyRail: true, stickyTop: 14, mobileNav: false },
  { id: 'laptop', width: 1024, height: 768, stickyRail: true, stickyTop: 14, mobileNav: false },
  { id: 'landscape', width: 1024, height: 470, stickyRail: true, stickyTop: 7, mobileNav: true, compactDock: true, theme: 'light' },
  { id: 'landscape-dark', width: 1024, height: 470, stickyRail: true, stickyTop: 7, mobileNav: true, compactDock: true, theme: 'dark' },
  { id: 'mobile', width: 390, height: 844, stickyRail: false, mobileNav: true },
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
  throw new Error('Chrome or Edge was not found for the hidden side-rail review.');
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const report = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: viewport.theme ?? 'light',
  });
  if (viewport.theme) {
    await context.addInitScript((theme) => localStorage.setItem('theme', theme), viewport.theme);
  }
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  url.searchParams.set('content', 'home');
  url.searchParams.set('qaTeamAccess', '1');
  url.searchParams.set('qaFeed', '1');
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.team-pulse').waitFor({ state: 'visible', timeout: 30_000 });
  const compactAvailability = page.locator('.game-availability.is-compact-dock');
  const availabilitySummary = page.locator('.game-availability-summary');
  if (viewport.compactDock) {
    await compactAvailability.waitFor({ state: 'visible', timeout: 30_000 });
  } else {
    await availabilitySummary.waitFor({ state: 'visible', timeout: 30_000 });
  }
  await page.evaluate(() => document.fonts.ready);
  const topScreenshotPath = path.join(outputDir, `${viewport.id}-${viewport.width}x${viewport.height}-top.png`);
  await page.screenshot({ path: topScreenshotPath, fullPage: false });

  const homeScroller = page.locator('.team-home');
  const sideRail = page.locator('.team-home-side-column');
  const pulse = page.locator('.team-pulse');
  const teamRecordMetrics = await page.locator('.team-pulse-team-record').evaluateAll((elements) => (
    elements.map((element) => ({
      ariaLabel: element.getAttribute('aria-label'),
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
      text: element.textContent.replace(/\s+/gu, ' ').trim(),
    }))
  ));
  const compactAttendanceBefore = viewport.compactDock
    ? await page.locator('.attendance-board.is-dock-mode').boundingBox()
    : null;
  const bottomNavBefore = viewport.mobileNav
    ? await page.getByTestId('mobile-bottom-nav').boundingBox()
    : null;
  const homeIconMetrics = viewport.mobileNav
    ? await page.getByTestId('mobile-nav-home').locator('[data-brand-icon="goonsquad-home"]').evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        height: box.height,
        maskImage: style.maskImage || style.webkitMaskImage,
        width: box.width,
      };
    })
    : null;
  const headerCrestMetrics = await page.locator('.app-brand-crest img').evaluate((element) => {
    const imageBox = element.getBoundingClientRect();
    const slotBox = element.closest('.app-brand-crest').getBoundingClientRect();
    const headerBox = element.closest('.app-header').getBoundingClientRect();
    const style = getComputedStyle(element);
    const readBox = (box) => ({
      bottom: box.bottom,
      height: box.height,
      left: box.left,
      right: box.right,
      top: box.top,
      width: box.width,
    });
    return {
      headerBox: readBox(headerBox),
      imageBox: readBox(imageBox),
      naturalHeight: element.naturalHeight,
      naturalWidth: element.naturalWidth,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      slotBox: readBox(slotBox),
      src: element.getAttribute('src'),
    };
  });
  const pulseBefore = await pulse.boundingBox();
  const pulseClipBefore = await pulse.evaluate((element) => element.scrollHeight - element.clientHeight);

  if (viewport.compactDock) {
    const collapsedScreenshotPath = path.join(outputDir, `${viewport.id}-${viewport.width}x${viewport.height}-compact.png`);
    await page.screenshot({ path: collapsedScreenshotPath, fullPage: false });
    await page.getByRole('button', { name: 'Expand attendance' }).click();
    await page.locator('.attendance-board.is-dock-expanded').waitFor({ state: 'visible' });
    await availabilitySummary.click();
  } else {
    await availabilitySummary.click();
  }
  await page.locator('.game-availability-roster').waitFor({ state: 'visible' });
  await homeScroller.evaluate((element) => {
    const maxScroll = element.scrollHeight - element.clientHeight;
    element.scrollTop = Math.min(Math.max(640, maxScroll * 0.35), maxScroll);
  });
  await page.waitForTimeout(250);

  const homeBox = await homeScroller.boundingBox();
  const railAfter = await sideRail.boundingBox();
  const pulseAfter = await pulse.boundingBox();
  const pulseClipAfter = await pulse.evaluate((element) => element.scrollHeight - element.clientHeight);
  const surfaceMetrics = await page.evaluate(() => {
    const readSurface = (selector) => {
      const element = document.querySelector(selector);
      const style = element ? getComputedStyle(element) : null;
      return element && style ? {
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        overflowY: style.overflowY,
        position: style.position,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
        scrollWidth: element.scrollWidth,
      } : null;
    };
    return {
      attendance: readSurface('.team-home-attendance'),
      feed: readSurface('.team-feed-column'),
      home: readSurface('.team-home'),
      rail: readSurface('.team-home-side-column'),
      roster: readSurface('.game-availability-roster'),
    };
  });
  const scrollButton = page.getByRole('button', { name: 'Back to top' });
  const scrollButtonVisible = await scrollButton.getAttribute('aria-hidden') === 'false';
  const mobileBottomNavVisible = viewport.mobileNav
    ? await page.getByTestId('mobile-bottom-nav').isVisible()
    : null;
  const screenshotPath = path.join(outputDir, `${viewport.id}-${viewport.width}x${viewport.height}-expanded.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  if (scrollButtonVisible) {
    await scrollButton.click();
    await page.waitForFunction(
      () => document.querySelector('.team-home')?.scrollTop < 2,
      null,
      { timeout: 5_000 },
    );
  }
  const returnedToTop = await homeScroller.evaluate((element) => element.scrollTop < 2);

  report[viewport.id] = {
    viewport,
    pulseHeightBefore: pulseBefore?.height ?? 0,
    pulseHeightAfter: pulseAfter?.height ?? 0,
    pulseClipBefore,
    pulseClipAfter,
    teamRecordMetrics,
    railTopWithinHome: (railAfter?.y ?? 0) - (homeBox?.y ?? 0),
    pulseTopWithinRail: (pulseAfter?.y ?? 0) - (railAfter?.y ?? 0),
    surfaceMetrics,
    scrollButtonVisible,
    mobileBottomNavVisible,
    returnedToTop,
    browserErrors,
    compactAttendanceBefore,
    bottomNavBefore,
    homeIconMetrics,
    headerCrestMetrics,
    topScreenshot: path.relative(root, topScreenshotPath).replaceAll('\\', '/'),
    screenshot: path.relative(root, screenshotPath).replaceAll('\\', '/'),
  };

  const result = report[viewport.id];
  const crest = result.headerCrestMetrics;
  const outside = (inner, outer) => (
    inner.left < outer.left - 1
    || inner.right > outer.right + 1
    || inner.top < outer.top - 1
    || inner.bottom > outer.bottom + 1
  );
  if (crest.src !== '/goonsquad-crest-v3.png' || crest.naturalWidth !== 258 || crest.naturalHeight !== 325) {
    throw new Error(`${viewport.id}: the header is not using the complete production crest.`);
  }
  if (crest.objectFit !== 'contain' || crest.objectPosition !== '50% 50%') {
    throw new Error(`${viewport.id}: the header crest can be cropped by its image fit.`);
  }
  if (outside(crest.imageBox, crest.slotBox) || outside(crest.imageBox, crest.headerBox)) {
    throw new Error(`${viewport.id}: the header crest is clipped by its slot or header bounds.`);
  }
  if (Math.abs(result.pulseHeightBefore - result.pulseHeightAfter) > 1) {
    throw new Error(`${viewport.id}: expanding attendance resized Game Pulse.`);
  }
  if (result.pulseClipBefore > 1 || result.pulseClipAfter > 1) {
    throw new Error(`${viewport.id}: Game Pulse content is clipped.`);
  }
  const expectedSchedules = ['Sunday Tier 4 League', 'Sunday Tier 5 League', 'Monday Tier 5 League'];
  if (result.teamRecordMetrics.length !== expectedSchedules.length) {
    throw new Error(`${viewport.id}: Game Pulse must show all three current Fall schedules.`);
  }
  for (const expectedSchedule of expectedSchedules) {
    const teamRecord = result.teamRecordMetrics.find((item) => item.ariaLabel?.includes(`${expectedSchedule} stats`));
    if (!teamRecord) {
      throw new Error(`${viewport.id}: ${expectedSchedule} record is missing or not directly actionable.`);
    }
    if (teamRecord.scrollWidth - teamRecord.clientWidth > 1 || teamRecord.scrollHeight - teamRecord.clientHeight > 1) {
      throw new Error(`${viewport.id}: ${expectedSchedule} record content is clipped.`);
    }
  }
  if (result.surfaceMetrics.home?.overflowY !== 'auto') {
    throw new Error(`${viewport.id}: Home is not the consolidated scroll surface.`);
  }
  if (result.surfaceMetrics.home.scrollHeight <= result.surfaceMetrics.home.clientHeight) {
    throw new Error(`${viewport.id}: Home does not have enough content to exercise page scrolling.`);
  }
  const feedOverflowY = result.surfaceMetrics.feed?.overflowY;
  if (feedOverflowY === 'auto' || feedOverflowY === 'scroll') {
    throw new Error(`${viewport.id}: the feed reintroduced a nested vertical scrollbar.`);
  }
  const attendanceOverflowY = result.surfaceMetrics.attendance?.overflowY;
  if (viewport.stickyRail && attendanceOverflowY !== 'auto' && attendanceOverflowY !== 'scroll') {
    throw new Error(`${viewport.id}: sticky attendance cannot reveal an expanded roster.`);
  }
  if (!viewport.stickyRail && (attendanceOverflowY === 'auto' || attendanceOverflowY === 'scroll')) {
    throw new Error(`${viewport.id}: mobile attendance should remain in the consolidated page flow.`);
  }
  if (Math.abs(result.pulseTopWithinRail) > 1) {
    throw new Error(`${viewport.id}: Game Pulse is no longer the first visible rail module.`);
  }
  if ((result.surfaceMetrics.attendance?.scrollWidth ?? 0) - (result.surfaceMetrics.attendance?.clientWidth ?? 0) > 1) {
    throw new Error(`${viewport.id}: attendance has horizontal overflow.`);
  }
  if (viewport.compactDock) {
    const attendanceBottom = result.compactAttendanceBefore
      ? result.compactAttendanceBefore.y + result.compactAttendanceBefore.height
      : Number.POSITIVE_INFINITY;
    const navTop = result.bottomNavBefore?.y ?? viewport.height;
    if (!result.compactAttendanceBefore || attendanceBottom > navTop + 1) {
      throw new Error(`${viewport.id}: compact attendance is not fully visible above the bottom navigation.`);
    }
    if (!result.mobileBottomNavVisible) {
      throw new Error(`${viewport.id}: compact landscape lost the mobile bottom navigation.`);
    }
  }
  if (viewport.mobileNav) {
    if (!result.homeIconMetrics?.maskImage || result.homeIconMetrics.maskImage === 'none') {
      throw new Error(`${viewport.id}: the Home navigation is not using the production logo mask.`);
    }
    if (result.homeIconMetrics.width < 19 || result.homeIconMetrics.height < 21) {
      throw new Error(`${viewport.id}: the Goonsquad Home mark is too small to remain recognizable.`);
    }
  }
  if (!scrollButtonVisible || !returnedToTop) {
    throw new Error(`${viewport.id}: the consolidated return-to-top control is not usable.`);
  }
  if (viewport.stickyRail) {
    if (result.surfaceMetrics.roster?.overflowY === 'auto' || result.surfaceMetrics.roster?.overflowY === 'scroll') {
      throw new Error(`${viewport.id}: the expanded roster reintroduced a nested vertical scrollbar.`);
    }
    if (result.surfaceMetrics.rail?.position !== 'sticky') {
      throw new Error(`${viewport.id}: the full right rail is not sticky.`);
    }
    if (Math.abs(result.railTopWithinHome - viewport.stickyTop) > 2) {
      throw new Error(`${viewport.id}: the right rail did not settle at the sticky top offset.`);
    }
  } else {
    if (result.surfaceMetrics.rail?.position !== 'static') {
      throw new Error(`${viewport.id}: the mobile rail should remain in natural document flow.`);
    }
    if (!result.mobileBottomNavVisible) {
      throw new Error(`${viewport.id}: the mobile bottom navigation is missing.`);
    }
  }
  if (viewport.id === 'desktop') {
    result.scopedTeamRoutes = [];
    for (const expected of [
      { schedule: 'Sunday Tier 4', team: 'fall-2026-sunday-tier-4' },
      { schedule: 'Sunday Tier 5', team: 'fall-2026-sunday-tier-5' },
      { schedule: 'Monday Tier 5', team: 'fall-2026-mon-wed' },
    ]) {
      const routePage = await context.newPage();
      await routePage.goto(url.href, { waitUntil: 'networkidle', timeout: 60_000 });
      await routePage.getByRole('button', { name: new RegExp(`Open YCBHL · ${expected.schedule} League stats`, 'u') }).click();
      await routePage.waitForFunction((team) => {
        const current = new URL(window.location.href);
        return current.searchParams.get('content') === 'stats'
          && current.searchParams.get('season') === 'fall-2026'
          && current.searchParams.get('team') === team;
      }, expected.team);
      const destination = routePage.url();
      result.scopedTeamRoutes.push({ schedule: expected.schedule, destination });
      await routePage.close();
    }
  }
  if (browserErrors.length) throw new Error(`${viewport.id}: ${browserErrors.join('; ')}`);

  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
