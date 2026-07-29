import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'theme-integrity');
const baseUrl = process.env.GOONSQUAD_THEME_URL ?? 'http://127.0.0.1:55601/';
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const routes = [
  { id: 'home', query: 'content=stats&mode=2d', root: '.stats-workspace' },
  { id: 'plays-2d', query: 'content=plays&mode=2d&playId=brk', root: '.play-workspace' },
  { id: 'plays-3d', query: 'content=plays&mode=3d&playId=brk&playing=false', root: '.vnext3d-preview-view' },
  { id: 'strategy-2d', query: 'content=strategy&mode=2d', root: '.tactics-learn' },
  { id: 'strategy-3d', query: 'content=strategy&mode=3d&playing=false', root: '.vnext3d-preview-view' },
  { id: 'create-2d', query: 'content=playmaker&mode=2d', root: '.playmaker-workspace' },
  { id: 'create-3d', query: 'content=playmaker&mode=2d', root: '.playmaker-workspace', action: 'open-create-3d' },
  { id: 'profile', query: 'content=profile&mode=2d', root: '.profile-workspace' },
  { id: 'account', query: 'content=account&mode=2d&auth=signup', root: '.account-workspace' },
];

const reviewMatrix = [
  { theme: 'light', viewport: { id: 'desktop', width: 1440, height: 900 } },
  { theme: 'light', viewport: { id: 'mobile', width: 390, height: 844 } },
  { theme: 'dark', viewport: { id: 'desktop', width: 1440, height: 900 } },
  { theme: 'dark', viewport: { id: 'mobile', width: 390, height: 844 } },
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
  throw new Error('Chrome or Edge was not found for hidden theme review.');
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findChrome();
const browser = await chromium.launch(buildChromiumLaunchConfig(executablePath));
const results = {};

for (const review of reviewMatrix) {
  for (const route of routes) {
    const key = `${review.theme}-${review.viewport.id}-${route.id}`;
    const context = await browser.newContext({
      viewport: { width: review.viewport.width, height: review.viewport.height },
      deviceScaleFactor: 1,
      colorScheme: review.theme,
      hasTouch: review.viewport.width <= 390,
      isMobile: review.viewport.width <= 390,
    });
    await context.addInitScript((theme) => localStorage.setItem('theme', theme), review.theme);
    const page = await context.newPage();
    const problems = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

    try {
      const url = new URL(baseUrl);
      url.search = route.query;
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.locator(route.root).first().waitFor({ state: 'visible', timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);

      if (route.action === 'open-create-3d') {
        await page.getByRole('button', { name: 'Preview', exact: true }).click();
        await page.locator('.playmaker-3d-stage canvas').waitFor({ state: 'visible', timeout: 60_000 });
      }

      if (route.id.endsWith('-3d')) {
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 60_000 });
        await page.waitForTimeout(900);
      } else {
        await page.waitForTimeout(180);
      }

      const audit = await page.evaluate(({ expectedTheme }) => {
        const parseColor = (value) => {
          const match = value.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
          if (!match) return null;
          return {
            red: Number(match[1]),
            green: Number(match[2]),
            blue: Number(match[3]),
            alpha: match[4] === undefined ? 1 : Number(match[4]),
          };
        };
        const luminance = ({ red, green, blue }) => {
          const channels = [red, green, blue].map((value) => {
            const normalized = value / 255;
            return normalized <= 0.03928
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
        };
        const ignored = (element) => element.matches('canvas, svg, img, picture, video')
          || Boolean(element.closest('svg, canvas, picture'))
          || element.classList.contains('app-brand-crest');

        const darkSurfaces = expectedTheme === 'light'
          ? [...document.querySelectorAll('body *')].flatMap((element) => {
            if (!(element instanceof HTMLElement) || ignored(element)) return [];
            const rect = element.getBoundingClientRect();
            if (rect.width * rect.height < 5_000 || rect.bottom < 0 || rect.top > innerHeight) return [];
            const style = getComputedStyle(element);
            if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return [];
            const color = parseColor(style.backgroundColor);
            if (!color || color.alpha < 0.78 || luminance(color) >= 0.18) return [];
            const chroma = Math.max(color.red, color.green, color.blue)
              - Math.min(color.red, color.green, color.blue);
            if (chroma > 50) return [];
            return [{
              element: element.tagName.toLowerCase(),
              className: element.className,
              background: style.backgroundColor,
              bounds: [
                Math.round(rect.x),
                Math.round(rect.y),
                Math.round(rect.width),
                Math.round(rect.height),
              ],
            }];
          }).slice(0, 20)
          : [];

        const shell = document.querySelector('.app-shell');
        const workspace = document.querySelector('main, .play-workspace, .tactics-learn, .vnext3d-preview-view');
        return {
          rootTheme: document.documentElement.dataset.theme,
          shellTheme: shell?.dataset.theme ?? '',
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          workspaceBackground: workspace ? getComputedStyle(workspace).backgroundColor : '',
          darkSurfaces,
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
        };
      }, { expectedTheme: review.theme });

      const screenshot = path.join(
        outputDir,
        `${review.theme}-${route.id}-${review.viewport.width}x${review.viewport.height}.png`,
      );
      await page.screenshot({ path: screenshot, fullPage: false });
      const passed = problems.length === 0
        && audit.rootTheme === review.theme
        && audit.shellTheme === review.theme
        && audit.documentWidth <= audit.viewportWidth + 1
        && audit.bodyWidth <= audit.viewportWidth + 1
        && audit.darkSurfaces.length === 0;
      results[key] = {
        theme: review.theme,
        viewport: [review.viewport.width, review.viewport.height],
        route: route.id,
        screenshot: path.relative(root, screenshot).replaceAll('\\', '/'),
        audit,
        problems,
        passed,
      };
    } catch (error) {
      results[key] = {
        theme: review.theme,
        viewport: [review.viewport.width, review.viewport.height],
        route: route.id,
        problems: [...problems, error.message],
        passed: false,
      };
    }

    await context.close();
  }
}

await browser.close();
const report = {
  generatedAt: new Date().toISOString(),
  headless: true,
  visibleBrowserWindowOpened: false,
  passed: Object.values(results).every((result) => result.passed),
  results,
};
await writeFile(path.join(outputDir, 'theme-integrity.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
