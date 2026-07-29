import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPLAY_VIEWPORTS,
  buildChromiumLaunchConfig,
  captureViewportsSequentially,
} from './capture-replay3d-core.mjs';

describe('capture replay 3d core', () => {
  it('uses stable Chromium flags without forcing a fragile graphics backend', () => {
    const config = buildChromiumLaunchConfig('C:/Chrome/chrome.exe', 'win32');

    expect(config).toMatchObject({
      executablePath: 'C:/Chrome/chrome.exe',
      headless: true,
    });
    expect(config.args).toContain('--disable-dev-shm-usage');
    expect(config.args).not.toContain('--use-angle=swiftshader');
    expect(config.args).not.toContain('--enable-unsafe-swiftshader');
  });

  it('captures all required responsive viewports', () => {
    expect(DEFAULT_REPLAY_VIEWPORTS.map((viewport) => viewport.name)).toEqual([
      'desktop',
      'laptop',
      'tablet',
      'mobile',
    ]);
  });

  it('retries a failed viewport with a fresh browser and closes every attempt', async () => {
    const closed = [];
    let launches = 0;
    let tabletAttempts = 0;

    const results = await captureViewportsSequentially({
      viewports: [
        { name: 'desktop', width: 1440, height: 1100 },
        { name: 'tablet', width: 834, height: 1112 },
      ],
      maxAttempts: 2,
      launchBrowser: async () => {
        launches += 1;
        const id = launches;
        return {
          id,
          close: async () => closed.push(id),
        };
      },
      capture: async (browser, viewport) => {
        if (viewport.name === 'tablet') {
          tabletAttempts += 1;
          if (tabletAttempts === 1) throw new Error('browser crashed during tablet capture');
        }

        return { name: viewport.name, browserId: browser.id };
      },
    });

    expect(results).toEqual([
      { name: 'desktop', browserId: 1 },
      { name: 'tablet', browserId: 3 },
    ]);
    expect(launches).toBe(3);
    expect(closed).toEqual([1, 2, 3]);
  });

  it('times out a wedged viewport capture and closes the browser', async () => {
    const closed = [];
    const capturePromise = captureViewportsSequentially({
      viewports: [{ name: 'desktop', width: 1440, height: 1100 }],
      maxAttempts: 1,
      captureTimeoutMs: 10,
      launchBrowser: async () => ({
        id: 1,
        close: async () => closed.push(1),
      }),
      capture: async () => new Promise(() => {}),
    });

    const outcome = await Promise.race([
      capturePromise.then(
        () => 'resolved',
        (error) => error.message,
      ),
      new Promise((resolve) => setTimeout(() => resolve('still-running'), 100)),
    ]);

    expect(outcome).toContain('timed out');
    expect(closed).toEqual([1]);
  });
});
