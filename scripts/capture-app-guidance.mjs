import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'app-guidance');
const baseUrl = process.env.GOONSQUAD_GUIDE_URL ?? 'http://127.0.0.1:55601/';
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
  throw new Error('Chrome or Edge was not found for the hidden guidance review.');
}

async function screenshot(page, viewport, name) {
  const outputPath = path.join(outputDir, `${viewport.id}-${name}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: outputPath, fullPage: false });
  return path.relative(root, outputPath).replaceAll('\\', '/');
}

function insideViewport(rect, viewport) {
  return rect.x >= -1
    && rect.y >= -1
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
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  const url = new URL(baseUrl);
  url.searchParams.set('content', 'playmaker');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.playmaker-workspace').waitFor({ state: 'visible', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);

  if (viewport.width <= 390) {
    await page.getByLabel('Open more app actions').click();
    await page.getByRole('button', { name: 'Guide' }).click();
  } else {
    await page.getByRole('button', { name: 'Open product guide' }).click();
  }
  const guide = page.getByRole('dialog', { name: 'Goonsquad product guide' });
  await guide.waitFor({ state: 'visible' });
  await page.waitForTimeout(320);
  const selectedGuideTab = await page.locator('.guide-nav [aria-selected="true"]').textContent();
  const guideRect = await guide.boundingBox();
  const guideScreenshot = await screenshot(page, viewport, 'create-guide');

  await page.getByRole('button', { name: 'Start Create tutorial' }).click();
  const tutorial = page.getByRole('dialog', { name: 'Create tutorial' });
  await tutorial.waitFor({ state: 'visible' });
  const tutorialHeadings = [await tutorial.locator('h2').textContent()];
  const tutorialWelcomeRect = await tutorial.boundingBox();
  const tutorialScreenshot = await screenshot(page, viewport, 'tutorial-welcome');

  for (let index = 1; index < 6; index += 1) {
    await tutorial.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(220);
    tutorialHeadings.push(await tutorial.locator('h2').textContent());
  }
  const ballStepText = (await tutorial.textContent()).replace(/\s+/gu, ' ').trim();
  const spotlightRect = await page.locator('.playmaker-tutorial-spotlight').boundingBox();
  const tutorialBallRect = await tutorial.boundingBox();
  const ballTutorialScreenshot = await screenshot(page, viewport, 'tutorial-ball-contract');

  while ((await tutorial.getByText(/STEP \d+ OF 10/u).textContent()) !== 'STEP 10 OF 10') {
    await tutorial.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(80);
  }
  await tutorial.getByRole('button', { name: 'Finish' }).click();
  await tutorial.waitFor({ state: 'detached' });
  const completionStored = await page.evaluate(() => localStorage.getItem('gs_playmaker_tutorial_complete_v1'));

  const ballHelp = page.getByLabel('About ball decisions');
  await ballHelp.scrollIntoViewIfNeeded();
  await ballHelp.click();
  const contextHelpText = await page.locator('.playmaker-ball-section .playmaker-context-help > div').textContent();
  const contextHelpScreenshot = await screenshot(page, viewport, 'ball-context-help');

  const layout = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    guideCount: document.querySelectorAll('.guide-panel').length,
    tutorialCount: document.querySelectorAll('.playmaker-tutorial-card').length,
  }));
  const tutorialRectsInside = [tutorialWelcomeRect, tutorialBallRect].every((rect) => rect && insideViewport(rect, viewport));
  const passed = problems.length === 0
    && selectedGuideTab.trim() === 'Create'
    && guideRect
    && insideViewport(guideRect, viewport)
    && tutorialRectsInside
    && spotlightRect
    && spotlightRect.width > 40
    && spotlightRect.height > 30
    && ballStepText.includes('exact receiver')
    && ballStepText.includes('all 3D cameras')
    && tutorialHeadings.length === 6
    && completionStored === 'true'
    && contextHelpText.includes('exact receiving teammate')
    && layout.bodyWidth <= layout.viewportWidth
    && layout.documentWidth <= layout.viewportWidth
    && layout.guideCount === 0
    && layout.tutorialCount === 0;

  results[viewport.id] = {
    viewport: [viewport.width, viewport.height],
    screenshots: {
      guide: guideScreenshot,
      tutorialWelcome: tutorialScreenshot,
      tutorialBallContract: ballTutorialScreenshot,
      ballContextHelp: contextHelpScreenshot,
    },
    selectedGuideTab: selectedGuideTab.trim(),
    tutorialHeadings,
    ballStepIncludesExactReceiver: ballStepText.includes('exact receiver'),
    ballStepIncludesCameraParity: ballStepText.includes('all 3D cameras'),
    completionStored,
    contextHelpText: contextHelpText.trim(),
    guideInsideViewport: Boolean(guideRect && insideViewport(guideRect, viewport)),
    tutorialInsideViewport: tutorialRectsInside,
    spotlightRect,
    layout,
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
await writeFile(
  path.join(outputDir, 'app-guidance.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
