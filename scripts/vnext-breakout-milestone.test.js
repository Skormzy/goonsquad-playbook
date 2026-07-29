import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const evidencePath = path.resolve(
  'docs/vnext/evidence/strategy-first-standard-breakout/breakout-milestone-laptop-tablet.json',
);

async function readEvidence() {
  return JSON.parse(await readFile(evidencePath, 'utf8'));
}

describe('Standard Breakout laptop and tablet milestone evidence', () => {
  it('records hidden laptop and tablet captures for every approved camera', async () => {
    const evidence = await readEvidence();

    expect(evidence.headless).toBe(true);
    expect(evidence.visibleBrowserWindowOpened).toBe(false);
    expect(Object.keys(evidence.results)).toEqual(['laptop', 'tablet']);
    for (const result of Object.values(evidence.results)) {
      expect(Object.keys(result.cameras)).toEqual(['broadcast', 'overhead', 'bench', 'player']);
      expect(result.browserProblems).toEqual([]);
      expect(result.passes).toBe(true);
    }
  });

  it('preserves the settled-entry tactical state and complete layout', async () => {
    const evidence = await readEvidence();

    for (const result of Object.values(evidence.results)) {
      for (const camera of Object.values(result.cameras)) {
        expect(camera).toMatchObject({
          replayTime: 8.65,
          playerCount: 12,
          ballOwner: 'US_LW',
          possession: 'LW',
          nextRead: 'Hold the wall; let both support lanes arrive',
          spacingPhase: 'entry-settle',
          spacingStatus: 'pass',
        });
        expect(camera.layout.bodyWidth).toBeLessThanOrEqual(camera.layout.viewportWidth);
        expect(camera.layout.canvas.bottom).toBeLessThanOrEqual(camera.layout.consoleTop);
        expect(camera.canvasPixels.visiblePixels).toBeGreaterThan(1000);
        expect(camera.canvasPixels.lumaRange).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('stores every screenshot in the evidence package', async () => {
    const evidence = await readEvidence();

    for (const result of Object.values(evidence.results)) {
      for (const camera of Object.values(result.cameras)) {
        await expect(access(path.resolve(camera.screenshot))).resolves.toBeUndefined();
      }
    }
  });
});
