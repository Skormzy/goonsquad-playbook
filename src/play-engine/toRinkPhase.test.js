import { describe, expect, it } from 'vitest';
import { standardBreakout3dReplay } from '../replay3d/data/standardBreakout3d';
import { getPlayScene } from './sceneRegistry';
import { playSceneToRinkPhase } from './toRinkPhase';

describe('playSceneToRinkPhase', () => {
  it('maps a sampled play scene into the shared 2D rink shape', () => {
    const phase = playSceneToRinkPhase(standardBreakout3dReplay, 3.8);

    expect(Object.keys(phase.pos)).toEqual(['LW', 'C', 'RW', 'LD', 'RD', 'G']);
    expect(phase.opp).toHaveLength(6);
    expect(phase.opp.map((player) => player.l)).toEqual(['G', 'C', 'RW', 'LW', 'RD', 'LD']);
    const opponentByRole = Object.fromEntries(phase.opp.map((player) => [player.l, player]));
    expect(opponentByRole.RW.x).toBeLessThan(opponentByRole.LW.x);
    expect(opponentByRole.RD.x).toBeLessThan(opponentByRole.LD.x);
    expect(phase.ball).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(phase.ballPath).toHaveLength(3);
    expect(phase.lanes).toEqual([{ f: 'LD', t: 'LW', ty: 'primary' }]);
    expect(phase.t).toContain('boards');
  });

  it('marks a home carrier while keeping both complete teams', () => {
    const phase = playSceneToRinkPhase(standardBreakout3dReplay, 1.2);

    expect(phase.pos.LD.ball).toBe(true);
    expect(Object.values(phase.pos).filter(Boolean)).toHaveLength(6);
    expect(phase.opp).toHaveLength(6);
    expect(phase.sceneFrame.players).toHaveLength(12);
  });

  it('samples the same final scene state used by 3D', () => {
    const phase = playSceneToRinkPhase(standardBreakout3dReplay, 99);

    expect(phase.time).toBe(standardBreakout3dReplay.duration);
    expect(phase.pos.LW.ball).toBe(true);
    expect(phase.ball).toEqual(phase.sceneFrame.ball.rinkPosition);
  });

  it('omits the penalized athlete from shared 2D rink frames', () => {
    const powerPlay = playSceneToRinkPhase(getPlayScene('ppum'), 0);
    const penaltyKill = playSceneToRinkPhase(getPlayScene('pkb'), 0);

    expect(Object.values(powerPlay.pos).filter(Boolean)).toHaveLength(6);
    expect(powerPlay.opp).toHaveLength(5);
    expect(powerPlay.opp.every((player) => player.status !== 'penalty-box')).toBe(true);
    expect(Object.values(penaltyKill.pos).filter(Boolean)).toHaveLength(5);
    expect(penaltyKill.pos.RW).toBeNull();
    expect(penaltyKill.opp).toHaveLength(6);
    expect(
      Object.values(penaltyKill.pos)
        .filter(Boolean)
        .every((player) => player.status !== 'penalty-box'),
    ).toBe(true);
  });
});
