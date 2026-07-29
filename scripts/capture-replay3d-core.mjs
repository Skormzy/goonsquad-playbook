export const DEFAULT_REPLAY_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'laptop', width: 1280, height: 832 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

export function buildChromiumLaunchConfig(chromePath, platform = process.platform) {
  const args = [
    '--hide-scrollbars',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ];

  return {
    executablePath: chromePath,
    headless: true,
    args,
  };
}

function withTimeout(promise, timeoutMs, label) {
  if (!timeoutMs) return promise;

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export async function captureViewportsSequentially({
  viewports = DEFAULT_REPLAY_VIEWPORTS,
  maxAttempts = 2,
  captureTimeoutMs = 90000,
  launchBrowser,
  capture,
}) {
  const results = [];

  for (const viewport of viewports) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const browser = await launchBrowser();

      try {
        const result = await withTimeout(
          capture(browser, viewport, attempt),
          captureTimeoutMs,
          `${viewport.name} capture attempt ${attempt}`,
        );
        results.push(result);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      } finally {
        try {
          await browser.close();
        } catch {
          // A crashed browser may already be gone; the original capture error is more useful.
        }
      }
    }

    if (lastError) throw lastError;
  }

  return results;
}
