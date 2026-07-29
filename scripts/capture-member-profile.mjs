import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'member-profile');
const baseUrl = process.env.GOONSQUAD_PROFILE_URL ?? 'http://127.0.0.1:55601/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
  { id: 'narrow-mobile', width: 360, height: 740 },
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
  throw new Error('Chrome or Edge was not found for the hidden profile review.');
}

function insideViewport(rect, viewport) {
  return rect && rect.x >= -1 && rect.y >= -1
    && rect.x + rect.width <= viewport.width + 1
    && rect.y + rect.height <= viewport.height + 1;
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const results = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    hasTouch: viewport.width <= 390,
    isMobile: viewport.width <= 390,
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  url.search = '';
  url.searchParams.set('content', 'profile');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.profile-workspace').waitFor({ state: 'visible', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

  const workspacePath = path.join(outputDir, `${viewport.id}-profile-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: workspacePath, fullPage: false });
  const primaryButton = page.locator('.profile-gate > button');
  const primaryButtonRect = await primaryButton.boundingBox();
  const profileHeading = await page.locator('.profile-gate h1').textContent();
  await primaryButton.click();
  const accountWorkspace = page.locator('.account-workspace');
  await accountWorkspace.waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: 'Create your account' }).waitFor({ state: 'visible' });
  const accountFrameRect = await page.locator('.account-workspace-frame').boundingBox();
  const dialogPath = path.join(outputDir, `${viewport.id}-account-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: dialogPath, fullPage: false });

  const layout = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    accountHeading: document.querySelector('.account-workspace-panel h2')?.textContent?.trim() ?? '',
    accountScrollWidth: document.querySelector('.account-workspace')?.scrollWidth ?? 0,
    accountClientWidth: document.querySelector('.account-workspace')?.clientWidth ?? 0,
    signupFields: document.querySelectorAll('.account-workspace-form input').length,
    googleVisible: Boolean(document.querySelector('.account-workspace-google')),
    usernameVisible: Boolean(document.querySelector('#account-signup-username')),
  }));
  layout.heading = profileHeading?.trim() ?? '';
  const passed = problems.length === 0
    && layout.bodyWidth <= layout.viewportWidth
    && layout.documentWidth <= layout.viewportWidth
    && layout.accountScrollWidth <= layout.accountClientWidth
    && layout.heading.length > 0
    && layout.accountHeading === 'Create your account'
    && layout.signupFields === 4
    && layout.googleVisible
    && layout.usernameVisible
    && accountFrameRect?.width > 0
    && insideViewport(primaryButtonRect, viewport)
    && (viewport.width > 390 || primaryButtonRect.height >= 43);

  results[viewport.id] = {
    viewport: [viewport.width, viewport.height],
    screenshots: {
      profile: path.relative(root, workspacePath).replaceAll('\\', '/'),
      account: path.relative(root, dialogPath).replaceAll('\\', '/'),
    },
    layout,
    primaryButtonRect,
    accountFrameRect,
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
await writeFile(path.join(outputDir, 'member-profile.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
