import { describe, expect, it } from 'vitest';
import { ARENA_CROWD_PROFILE, COURT_TEXTURE_PROFILE } from './ReplayCourt';

describe('ReplayCourt texture profile', () => {
  it('tracks sport-court tile and wear detail as a first-class visual requirement', () => {
    expect(COURT_TEXTURE_PROFILE.material).toBe('matte-polypropylene-sport-court');
    expect(COURT_TEXTURE_PROFILE.tileRepeat).toEqual({ x: 4, y: 9 });
    expect(COURT_TEXTURE_PROFILE.scuffLayers).toBeGreaterThanOrEqual(2);
    expect(COURT_TEXTURE_PROFILE.ballWearMarks).toBeGreaterThanOrEqual(40);
  });

  it('tracks dense broadcast crowd backdrops behind the glass', () => {
    expect(ARENA_CROWD_PROFILE.material).toBe('procedural-broadcast-crowd-backdrop');
    expect(ARENA_CROWD_PROFILE.sideSpectators).toBeGreaterThanOrEqual(180);
    expect(ARENA_CROWD_PROFILE.endSpectators).toBeGreaterThanOrEqual(96);
    expect(ARENA_CROWD_PROFILE.rowBands).toBeGreaterThanOrEqual(5);
  });
});
