import { chromium } from 'playwright-core';
import { access, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_REPLAY_VIEWPORTS,
  buildChromiumLaunchConfig,
  captureViewportsSequentially,
} from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'src', 'screenshots');
const prefix = process.argv[2] || 'replay3d-qa';
const replayUrl = process.argv[3] || process.env.REPLAY3D_URL || 'http://127.0.0.1:55601/?view=replay3d';

const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch { /* try next candidate */ }
  }
  throw new Error('Chrome or Edge was not found. Set CHROME_BIN to the browser executable.');
}

async function capture(browser, { name, width, height }) {
  const outputPath = path.join(outputDir, `${prefix}-${name}.png`);
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleProblems = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.goto(replayUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByText('LOADING 3D REPLAY...', { exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: outputPath, fullPage: true });
  await context.close();

  const info = await stat(outputPath);
  return { name, outputPath, bytes: info.size, consoleProblems };
}

await mkdir(outputDir, { recursive: true });
const chromePath = await findChrome();
const launchConfig = buildChromiumLaunchConfig(chromePath);
const results = await captureViewportsSequentially({
  viewports: DEFAULT_REPLAY_VIEWPORTS,
  maxAttempts: 2,
  launchBrowser: () => chromium.launch(launchConfig),
  capture,
});

for (const result of results) {
  console.log(`${result.name}: ${result.outputPath} (${result.bytes} bytes)`);
  const importantProblems = result.consoleProblems.filter((problem) => !problem.includes('THREE.Clock:'));
  if (importantProblems.length > 0) {
    console.log(`${result.name} console:`);
    for (const problem of importantProblems.slice(0, 8)) {
      console.log(`- ${problem}`);
    }
  }
}
