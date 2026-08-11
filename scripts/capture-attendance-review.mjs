import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';
import { signAttendanceToken } from '../server/attendanceReminders.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'attendance');
const baseUrl = process.env.GOONSQUAD_ATTENDANCE_URL || 'http://127.0.0.1:55603/';
const candidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];

async function executable() {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('Chrome or Edge is required for attendance review.');
}

await mkdir(outputDir, { recursive: true });
const executablePath = await executable();
const report = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.id === 'mobile' ? 2 : 1,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    const responseUrl = new URL(response.url());
    if (response.status() >= 400 && responseUrl.origin === new URL(baseUrl).origin) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  url.searchParams.set('content', 'home');
  url.searchParams.set('qaTeamAccess', '1');
  url.searchParams.set('qaFeed', '1');
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60_000 });
  const board = page.locator('.attendance-board');
  await board.waitFor({ state: 'visible', timeout: 30_000 });
  await board.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);

  const cardCount = await board.locator('.game-availability').count();
  const tabs = board.locator('.attendance-board-tabs');
  const tabCount = await tabs.locator('button[role="tab"]').count();
  const tabsVisible = await tabs.isVisible();
  const firstTitle = await board.locator('.game-availability h2').innerText();
  const documentOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const manager = board.locator('.attendance-access-manager');
  await manager.locator('summary').click();
  const managerVisible = await manager.locator('.attendance-access-manager-body').isVisible();
  const addLabel = await manager.locator('.attendance-ep-modes button').first().innerText();
  await manager.locator('summary').click();

  const notificationControl = board.locator('.attendance-notification-control');
  await notificationControl.locator('summary').click();
  const notificationControlVisible = await notificationControl.locator(':scope > div').isVisible();
  const reminderManager = board.locator('.attendance-reminder-manager');
  await reminderManager.locator('summary').click();
  const reminderManagerVisible = await reminderManager.locator('.attendance-reminder-body').isVisible();
  const reminderRecipientCount = await reminderManager.locator('.attendance-reminder-recipients label').count();
  await reminderManager.scrollIntoViewIfNeeded();
  const screenshotPath = path.join(outputDir, `${viewport.id}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const nextGameButton = board.getByRole('button', { name: 'Next game' });
  let secondTitle = '';
  if (tabCount > 1) {
    await nextGameButton.click();
    secondTitle = await board.locator('.game-availability h2').innerText();
  }

  if (cardCount !== 1) throw new Error(`${viewport.id}: expected one active attendance card, received ${cardCount}.`);
  if (tabCount < 1) throw new Error(`${viewport.id}: expected at least one upcoming fixture.`);
  if (viewport.id === 'mobile' && tabsVisible) throw new Error('mobile: fixture tabs should collapse behind arrows.');
  if (viewport.id === 'desktop' && !tabsVisible) throw new Error('desktop: fixture tabs should remain visible.');
  if (!managerVisible) throw new Error(`${viewport.id}: call-up manager did not open.`);
  if (!notificationControlVisible) throw new Error(`${viewport.id}: member notification setup did not open.`);
  if (!reminderManagerVisible) throw new Error(`${viewport.id}: coach reminder manager did not open.`);
  if (reminderRecipientCount < 1) throw new Error(`${viewport.id}: coach reminder manager has no waiting recipient.`);
  if (tabCount > 1 && firstTitle === secondTitle) {
    throw new Error(`${viewport.id}: next-game navigation did not change the fixture.`);
  }
  if (tabCount === 1 && await nextGameButton.isEnabled()) {
    throw new Error(`${viewport.id}: next-game navigation should be disabled for a single fixture.`);
  }
  if (documentOverflow > 1) throw new Error(`${viewport.id}: horizontal overflow ${documentOverflow}px.`);
  if (errors.length) throw new Error(`${viewport.id}: ${errors.join('; ')}`);

  const responseToken = signAttendanceToken({
    competitionLabel: 'Monday League',
    exp: Math.floor(Date.now() / 1000) + 3600,
    fixtureId: 'qa-fixture',
    opponent: 'Viperz',
    response: 'in',
    scheduledAt: '2026-08-03T23:00:00.000Z',
    userId: 'qa-winger',
  }, 'qa-attendance-review-secret');
  const responseUrl = new URL(baseUrl);
  responseUrl.searchParams.set('content', 'home');
  responseUrl.searchParams.set('attendanceToken', responseToken);
  await page.goto(responseUrl.href, { waitUntil: 'networkidle', timeout: 60_000 });
  const responseDialog = page.locator('.attendance-response-dialog');
  await responseDialog.waitFor({ state: 'visible', timeout: 30_000 });
  const responseScreenshotPath = path.join(outputDir, `${viewport.id}-response-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: responseScreenshotPath, fullPage: false });
  const responseDialogVisible = await responseDialog.isVisible();
  if (!responseDialogVisible) throw new Error(`${viewport.id}: secure attendance response dialog did not open.`);

  report[viewport.id] = {
    viewport,
    cardCount,
    tabCount,
    tabsVisible,
    firstTitle,
    secondTitle,
    managerVisible,
    notificationControlVisible,
    reminderManagerVisible,
    reminderRecipientCount,
    responseDialogVisible,
    addLabel: addLabel.replace(/\s+/gu, ' ').trim(),
    documentOverflow,
    screenshot: path.relative(root, screenshotPath).replaceAll('\\', '/'),
    responseScreenshot: path.relative(root, responseScreenshotPath).replaceAll('\\', '/'),
  };
  await browser.close();
}

await writeFile(
  path.join(outputDir, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
