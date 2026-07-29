import { describe, expect, it } from 'vitest';
import { standardBreakout3dReplay } from './standardBreakout3d';
import { validateReplay } from './validateReplay';

describe('standardBreakout3dReplay', () => {
  it('is a deterministic 12-player flagship replay linked to the existing play and tactic', () => {
    expect(standardBreakout3dReplay.id).toBe('standard-breakout-3d');
    expect(standardBreakout3dReplay.sourcePlayId).toBe('brk');
    expect(standardBreakout3dReplay.sourceTacticId).toBe('breakout-patterns');
    expect(standardBreakout3dReplay.players).toHaveLength(12);
    expect(standardBreakout3dReplay.players.filter((player) => player.team === 'us')).toHaveLength(6);
    expect(standardBreakout3dReplay.players.filter((player) => player.team === 'opponent')).toHaveLength(6);
  });

  it('keeps every runner involved and gives the ball a board-bounce segment', () => {
    const report = validateReplay(standardBreakout3dReplay);

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.playerCount).toBe(12);
    expect(report.movingPlayerIds).toHaveLength(12);
    expect(report.stationaryPlayerIds).toEqual([]);
    expect(report.movementByPlayer.find((player) => player.id === 'US_G').maxDisplacement).toBeGreaterThan(0.85);
    expect(report.movementByPlayer.find((player) => player.id === 'US_LD').totalDistance).toBeGreaterThan(6);
    expect(report.boardBounceSegments).toHaveLength(1);
    expect(report.invalidBoardBounceSegments).toEqual([]);
  });

  it('gives every replay event one concise next tactical read', () => {
    expect(standardBreakout3dReplay.events.every((event) => (
      typeof event.nextRead === 'string' && event.nextRead.length > 0
    ))).toBe(true);
    expect(standardBreakout3dReplay.events.at(-1).nextRead)
      .toBe('Hold the wall; let both support lanes arrive');
  });

  it('reports the exact player IDs that do not move enough', () => {
    const replay = structuredClone(standardBreakout3dReplay);
    const leftDefense = replay.players.find((player) => player.id === 'US_LD');
    leftDefense.keyframes = leftDefense.keyframes.map((keyframe) => ({
      ...keyframe,
      position: leftDefense.keyframes[0].position,
    }));

    const report = validateReplay(replay);

    expect(report.valid).toBe(false);
    expect(report.stationaryPlayerIds).toEqual(['US_LD']);
    expect(report.errors[0]).toContain('US_LD');
  });

  it('rejects board releases with unrealistic rebound angles', () => {
    const replay = structuredClone(standardBreakout3dReplay);
    const boardPass = replay.ball.segments.find((segment) => segment.type === 'board-pass');
    boardPass.exitTarget = { x: 2, y: 45 };

    const report = validateReplay(replay);

    expect(report.valid).toBe(false);
    expect(report.invalidBoardBounceSegments).toHaveLength(1);
    expect(report.errors.some((error) => error.includes('rebound angle'))).toBe(true);
  });
});
