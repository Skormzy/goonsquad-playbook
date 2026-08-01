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
  { id: 'desktop', width: 1440, height: 900, stickyRail: true },
  { id: 'laptop', width: 1024, height: 768, stickyRail: true },
  { id: 'mobile', width: 390, height: 844, stickyRail: false },
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
    colorScheme: 'light',
  });
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
  await page.locator('.game-availability-summary').waitFor({ state: 'visible', timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);

  const homeScroller = page.locator('.team-home');
  const sideRail = page.locator('.team-home-side-column');
  const pulse = page.locator('.team-pulse');
  const pulseBefore = await pulse.boundingBox();
  const pulseClipBefore = await pulse.evaluate((element) => element.scrollHeight - element.clientHeight);

  await page.locator('.game-availability-summary').click();
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
  const mobileBottomNavVisible = viewport.stickyRail
    ? null
    : await page.getByTestId('mobile-bottom-nav').isVisible();
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
    railTopWithinHome: (railAfter?.y ?? 0) - (homeBox?.y ?? 0),
    pulseTopWithinRail: (pulseAfter?.y ?? 0) - (railAfter?.y ?? 0),
    surfaceMetrics,
    scrollButtonVisible,
    mobileBottomNavVisible,
    returnedToTop,
    browserErrors,
    screenshot: path.relative(root, screenshotPath).replaceAll('\\', '/'),
  };

  const result = report[viewport.id];
  if (Math.abs(result.pulseHeightBefore - result.pulseHeightAfter) > 1) {
    throw new Error(`${viewport.id}: expanding attendance resized Game Pulse.`);
  }
  if (result.pulseClipBefore > 1 || result.pulseClipAfter > 1) {
    throw new Error(`${viewport.id}: Game Pulse content is clipped.`);
  }
  if (result.surfaceMetrics.home?.overflowY !== 'auto') {
    throw new Error(`${viewport.id}: Home is not the consolidated scroll surface.`);
  }
  if (result.surfaceMetrics.home.scrollHeight <= result.surfaceMetrics.home.clientHeight) {
    throw new Error(`${viewport.id}: Home does not have enough content to exercise page scrolling.`);
  }
  for (const surface of ['feed', 'attendance']) {
    const overflowY = result.surfaceMetrics[surface]?.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      throw new Error(`${viewport.id}: ${surface} reintroduced a nested vertical scrollbar.`);
    }
  }
  if (Math.abs(result.pulseTopWithinRail) > 1) {
    throw new Error(`${viewport.id}: Game Pulse is no longer the first visible rail module.`);
  }
  if ((result.surfaceMetrics.attendance?.scrollWidth ?? 0) - (result.surfaceMetrics.attendance?.clientWidth ?? 0) > 1) {
    throw new Error(`${viewport.id}: attendance has horizontal overflow.`);
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
    if (Math.abs(result.railTopWithinHome - 14) > 2) {
      throw new Error(`${viewport.id}: the right rail did not settle at the sticky top offset.`);
    }
  } else {
    if (result.surfaceMetrics.rail?.position !== 'static') {
      throw new Error(`${viewport.id}: the mobile rail should remain in natural document flow.`);
    }
    if (!mobileBottomNavVisible) {
      throw new Error(`${viewport.id}: the mobile bottom navigation is missing.`);
    }
  }
  if (browserErrors.length) throw new Error(`${viewport.id}: ${browserErrors.join('; ')}`);

  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
