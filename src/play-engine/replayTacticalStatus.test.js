import { describe, expect, it } from 'vitest';
import { standardBreakout3dReplay } from '../replay3d/data/standardBreakout3d';
import { samplePlayScene } from './samplePlayScene';
import { replayNextRead, replayPossessionLabel } from './replayTacticalStatus';

describe('replay tactical status', () => {
  it('derives possession from authoritative carry, flight, and receive state', () => {
    expect(replayPossessionLabel(samplePlayScene(standardBreakout3dReplay, 1.2))).toBe('LD');
    expect(replayPossessionLabel(samplePlayScene(standardBreakout3dReplay, 3.72))).toBe('IN FLIGHT');
    expect(replayPossessionLabel(samplePlayScene(standardBreakout3dReplay, 4.5))).toBe('LW');
    expect(replayPossessionLabel(samplePlayScene(standardBreakout3dReplay, 8.2))).toBe('LW');
  });

  it('keeps the next read synchronized to the active authored event', () => {
    expect(replayNextRead(samplePlayScene(standardBreakout3dReplay, 3.72)))
      .toBe('Winger times the boards receive');
    expect(replayNextRead(samplePlayScene(standardBreakout3dReplay, 7.8)))
      .toBe('Protect wide; scan C underneath');
    expect(replayNextRead(samplePlayScene(standardBreakout3dReplay, 8.65)))
      .toBe('Hold the wall; let both support lanes arrive');
  });
});
