import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'artifacts', 'qa', 'tournament-entrants');
const baseUrl = process.env.GOONSQUAD_TOURNAMENT_URL ?? 'http://127.0.0.1:55602/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const expectedTeams = Object.freeze([
  'Goonsquad',
  'Cambridge',
  'Sudbury Silly Gooses',
  'Balls of Glory',
  'Moosehead',
  'Dirty Birds',
  'High Park Highlanders',
  'Sarabha',
  'Mitt Magicians',
]);
const placeholderPattern = /\b(?:winner|loser)\b|\b\d+(?:st|nd|rd|th)\b.*\boverall\b|\b(?:tbd|tba|bye)\b/iu;
const viewports = [
  { id: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { id: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
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
  throw new Error('Chrome or Edge was not found for the hidden tournament entrant review.');
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const report = {};

for (const viewport of viewports) {
  const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
  try {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      colorScheme: 'light',
    });
    const page = await context.newPage();
    const browserErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

    const url = new URL(baseUrl);
    url.searchParams.set('content', 'stats');
    url.searchParams.set('competition', 'tournaments');
    url.searchParams.set('tournament', '2026-mississauga-provincials');
    url.searchParams.set('qaTeamAccess', '1');
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const field = page.locator('.tournament-field');
    await field.waitFor({ state: 'visible', timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await field.scrollIntoViewIfNeeded();

    const fieldHeading = (await field.locator('h3').textContent())?.trim() || '';
    const renderedTeams = await field.locator(':scope > div > span > strong').allTextContents();
    const normalizedTeams = renderedTeams.map((name) => name.trim()).filter(Boolean);
    const screenshotPath = path.join(
      outputDir,
      `${viewport.id}-${viewport.width}x${viewport.height}.png`,
    );
    await field.screenshot({ path: screenshotPath });

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));

    report[viewport.id] = {
      viewport,
      fieldHeading,
      teams: normalizedTeams,
      browserErrors,
      overflow,
      screenshot: path.relative(root, screenshotPath).replaceAll('\\', '/'),
    };

    if (fieldHeading !== `${expectedTeams.length} tournament teams`) {
      throw new Error(`${viewport.id}: expected the field heading to report exactly nine teams, received "${fieldHeading}".`);
    }
    if (JSON.stringify(normalizedTeams) !== JSON.stringify(expectedTeams)) {
      throw new Error(`${viewport.id}: tournament entrants do not match the published pool field: ${normalizedTeams.join(', ')}.`);
    }
    const placeholder = normalizedTeams.find((name) => placeholderPattern.test(name));
    if (placeholder) {
      throw new Error(`${viewport.id}: bracket instruction "${placeholder}" was rendered as a tournament team.`);
    }
    if (browserErrors.length > 0) {
      throw new Error(`${viewport.id}: browser errors detected: ${browserErrors.join(' | ')}`);
    }
    if (overflow.document > 1 || overflow.body > 1) {
      throw new Error(`${viewport.id}: horizontal page overflow detected: ${JSON.stringify(overflow)}.`);
    }
  } finally {
    await browser.close();
  }
}

const reportPath = path.join(outputDir, 'report.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Tournament entrant QA passed: ${path.relative(root, reportPath).replaceAll('\\', '/')}`);
