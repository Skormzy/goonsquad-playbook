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
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'laptop', width: 1024, height: 768 },
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

function containedBy(inner, outer) {
  return Boolean(
    inner
    && outer
    && inner.x >= outer.x - 1
    && inner.y >= outer.y - 1
    && inner.x + inner.width <= outer.x + outer.width + 1
    && inner.y + inner.height <= outer.y + outer.height + 1
  );
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

  const sideRegion = page.locator('.team-home-scroll-region.is-side');
  const pulse = page.locator('.team-pulse');
  const attendanceScroller = page.locator('.team-home-attendance-scroll');
  const pulseBefore = await pulse.boundingBox();
  const sideBefore = await sideRegion.boundingBox();
  const pulseClipBefore = await pulse.evaluate((element) => element.scrollHeight - element.clientHeight);

  await page.locator('.game-availability-summary').click();
  await page.locator('.game-availability-roster').waitFor({ state: 'visible' });
  await attendanceScroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForTimeout(250);

  const pulseAfter = await pulse.boundingBox();
  const sideAfter = await sideRegion.boundingBox();
  const pulseClipAfter = await pulse.evaluate((element) => element.scrollHeight - element.clientHeight);
  const attendanceMetrics = await attendanceScroller.evaluate((element) => ({
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    scrollWidth: element.scrollWidth,
  }));
  const scrollButton = page.getByRole('button', { name: 'Back to top of attendance' });
  const scrollButtonVisible = await scrollButton.getAttribute('aria-hidden') === 'false';
  const screenshotPath = path.join(outputDir, `${viewport.id}-${viewport.width}x${viewport.height}-expanded.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  if (scrollButtonVisible) {
    await scrollButton.click();
    await page.waitForFunction(
      () => document.querySelector('.team-home-attendance-scroll')?.scrollTop < 2,
      null,
      { timeout: 5_000 },
    );
  }
  const returnedToTop = await attendanceScroller.evaluate((element) => element.scrollTop < 2);

  report[viewport.id] = {
    viewport,
    pulseContainedBefore: containedBy(pulseBefore, sideBefore),
    pulseContainedAfter: containedBy(pulseAfter, sideAfter),
    pulseHeightBefore: pulseBefore?.height ?? 0,
    pulseHeightAfter: pulseAfter?.height ?? 0,
    pulseTopBefore: pulseBefore?.y ?? 0,
    pulseTopAfter: pulseAfter?.y ?? 0,
    pulseClipBefore,
    pulseClipAfter,
    attendanceMetrics,
    scrollButtonVisible,
    returnedToTop,
    browserErrors,
    screenshot: path.relative(root, screenshotPath).replaceAll('\\', '/'),
  };

  const result = report[viewport.id];
  if (!result.pulseContainedBefore || !result.pulseContainedAfter) {
    throw new Error(`${viewport.id}: Game Pulse leaves the visible side rail.`);
  }
  if (Math.abs(result.pulseHeightBefore - result.pulseHeightAfter) > 1) {
    throw new Error(`${viewport.id}: expanding attendance resized Game Pulse.`);
  }
  if (Math.abs(result.pulseTopBefore - result.pulseTopAfter) > 1) {
    throw new Error(`${viewport.id}: scrolling attendance moved Game Pulse.`);
  }
  if (result.pulseClipBefore > 1 || result.pulseClipAfter > 1) {
    throw new Error(`${viewport.id}: Game Pulse content is clipped.`);
  }
  if (attendanceMetrics.clientHeight < 120 || attendanceMetrics.scrollHeight <= attendanceMetrics.clientHeight) {
    throw new Error(`${viewport.id}: expanded attendance does not have a usable independent scroller.`);
  }
  if (attendanceMetrics.scrollWidth - attendanceMetrics.clientWidth > 1) {
    throw new Error(`${viewport.id}: attendance pane has horizontal overflow.`);
  }
  if (!scrollButtonVisible || !returnedToTop) {
    throw new Error(`${viewport.id}: attendance return-to-top control is not usable.`);
  }
  if (browserErrors.length) throw new Error(`${viewport.id}: ${browserErrors.join('; ')}`);

  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
