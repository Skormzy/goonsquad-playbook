import { createServer } from 'node:http';
import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildChromiumLaunchConfig } from './capture-replay3d-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'goonsquad-pwa-update-'));
const previousDist = path.join(temporaryRoot, 'previous');
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep looking for an installed browser.
    }
  }
  throw new Error('Chrome or Edge is required for the PWA release update check.');
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForCurrentRelease(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await Promise.race([
      page.evaluate(() => (
        document.documentElement.dataset.previousClient !== 'true'
          && document.querySelectorAll('.team-pulse-team-record').length === 2
      )).catch(() => false),
      delay(1_000).then(() => false),
    ]);
    if (ready) return;
    await delay(200);
  }
  throw new Error(`Current release did not replace the installed client within ${timeoutMs}ms.`);
}

async function preparePreviousRelease() {
  await cp(dist, previousDist, { recursive: true });
  const indexPath = path.join(previousDist, 'index.html');
  const workerPath = path.join(previousDist, 'sw.js');
  const index = await readFile(indexPath, 'utf8');
  const worker = await readFile(workerPath, 'utf8');
  const modulePattern = /<script type="module" crossorigin src="[^"]+"><\/script>/u;
  if (!modulePattern.test(index)) throw new Error('Production index does not expose its module entry.');

  await writeFile(indexPath, index.replace(
    modulePattern,
    '<script type="module" src="/previous-client.js"></script>',
  ));
  await writeFile(path.join(previousDist, 'previous-client.js'), `
document.documentElement.dataset.previousClient = 'true';
navigator.serviceWorker.register('/sw.js', { scope: '/' });
`);
  const previousWorker = worker.replace(
    /const BUILD_ID = ["'][^"']+["'];/u,
    "const BUILD_ID = 'previous-release-fixture';",
  );
  if (!previousWorker.includes("const BUILD_ID = 'previous-release-fixture';")) {
    throw new Error('Previous release fixture could not replace the production worker build ID.');
  }
  await writeFile(workerPath, previousWorker);
}

function createReleaseServer(initialRoot) {
  let activeRoot = initialRoot;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      let filePath = path.resolve(activeRoot, relativePath);
      if (!filePath.startsWith(path.resolve(activeRoot))) {
        response.writeHead(403).end();
        return;
      }
      let body;
      try {
        body = await readFile(filePath);
      } catch {
        filePath = path.join(activeRoot, 'index.html');
        body = await readFile(filePath);
      }
      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      if (url.pathname === '/sw.js') response.setHeader('Service-Worker-Allowed', '/');
      response.setHeader('Content-Type', mimeTypes.get(path.extname(filePath)) || 'application/octet-stream');
      response.writeHead(200).end(body);
    } catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : String(error));
    }
  });

  return {
    server,
    useRelease(nextRoot) {
      activeRoot = nextRoot;
    },
  };
}

let browser;
let server;
try {
  await preparePreviousRelease();
  console.log('Prepared previous release fixture.');
  const releaseServer = createReleaseServer(previousDist);
  server = releaseServer.server;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('PWA test server did not bind to a port.');
  const baseUrl = `http://127.0.0.1:${address.port}/`;

  browser = await chromium.launch(buildChromiumLaunchConfig(await firstExisting(chromeCandidates)));
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = [];
  const navigations = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60_000 });
  console.log('Opened previous release client.');
  await page.waitForFunction(() => (
    document.documentElement.dataset.previousClient === 'true'
      && Boolean(navigator.serviceWorker.controller)
  ), null, { timeout: 30_000 });
  console.log('Previous release controls the client.');

  releaseServer.useRelease(dist);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) throw new Error('Previous release has no service-worker registration.');
    await registration.update();
  });
  console.log('Requested current release worker.');
  try {
    await waitForCurrentRelease(page, 60_000);
  } catch (error) {
    const diagnostics = await Promise.race([
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const workerResponse = await fetch('/sw.js', { cache: 'no-store' });
        return {
          url: window.location.href,
          previousClient: document.documentElement.dataset.previousClient,
          recordCount: document.querySelectorAll('.team-pulse-team-record').length,
          cacheKeys: await caches.keys(),
          controllerState: navigator.serviceWorker.controller?.state,
          activeState: registration?.active?.state,
          waitingState: registration?.waiting?.state,
          installingState: registration?.installing?.state,
          workerLead: (await workerResponse.text()).slice(0, 100),
        };
      }).catch((diagnosticError) => ({ error: diagnosticError.message })),
      delay(5_000).then(() => ({ error: 'diagnostics timed out during navigation' })),
    ]);
    console.error(JSON.stringify({ diagnostics, browserErrors, navigations }, null, 2));
    throw error;
  }

  const result = await page.locator('.team-pulse-team-record').evaluateAll((records) => ({
    records: records.map((record) => record.textContent.replace(/\s+/gu, ' ').trim()),
    releaseClientLoaded: document.documentElement.dataset.previousClient !== 'true',
  }));
  if (browserErrors.length > 0) throw new Error(browserErrors.join('; '));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server?.closeAllConnections?.();
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporaryRoot, { recursive: true, force: true });
}
