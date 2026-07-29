import { describe, expect, it } from 'vitest';
import { standardBreakout3dReplay } from '../replay3d/data/standardBreakout3d';
import { PLAY_SCENE_ROLES, validatePlayScene } from './validatePlayScene';

describe('validatePlayScene', () => {
  it('accepts the flagship scene as a renderer-neutral source', () => {
    const report = validatePlayScene(standardBreakout3dReplay);

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.rosters).toEqual([
      { team: 'us', playerCount: 6, roles: PLAY_SCENE_ROLES, valid: true },
      { team: 'opponent', playerCount: 6, roles: PLAY_SCENE_ROLES, valid: true },
    ]);
  });

  it('rejects the wrong rink orientation and presentation defaults', () => {
    const scene = structuredClone(standardBreakout3dReplay);
    scene.rink.orientation = 'horizontal';
    scene.presentation.captionsPlacement = 'on-rink';
    scene.presentation.coachingOverlaysDefault = true;

    const report = validatePlayScene(scene);

    expect(report.valid).toBe(false);
    expect(report.errors).toContain('Scene rink must use vertical orientation.');
    expect(report.errors).toContain('Captions must be below the rink.');
    expect(report.errors).toContain('Coaching overlays must be off by default.');
  });

  it('requires the full six-role roster for each team', () => {
    const scene = structuredClone(standardBreakout3dReplay);
    scene.players.find((player) => player.id === 'OP_F1').role = 'LW';

    const report = validatePlayScene(scene);

    expect(report.valid).toBe(false);
    expect(report.errors).toContain('opponent must include LW, C, RW, LD, RD, and G exactly once.');
  });

  it('rejects out-of-bounds player tracks and broken ball continuity', () => {
    const scene = structuredClone(standardBreakout3dReplay);
    scene.players[0].keyframes[1].position.x = 104;
    scene.ball.segments[1].from = 2.5;

    const report = validatePlayScene(scene);

    expect(report.valid).toBe(false);
    expect(report.errors).toContain('US_G has an out-of-bounds position at keyframe 1.');
    expect(report.errors).toContain('Ball segment 1 does not continue from the previous segment.');
  });
});
