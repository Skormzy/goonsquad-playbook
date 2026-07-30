import { describe, expect, it } from 'vitest';
import { samplePlayScene } from '../play-engine/samplePlayScene';
import { standardBreakout3dReplay } from '../replay3d/data/standardBreakout3d';
import { createProductionRuntimePlayers } from './runtimeMapping';

function runtimeAt(time) {
  const frame = samplePlayScene(standardBreakout3dReplay, time);
  return { frame, players: createProductionRuntimePlayers(frame) };
}

describe('Standard Breakout production cadence', () => {
  it('keeps the moving LD ball carrier in the sprint clip', () => {
    const { frame, players } = runtimeAt(2);
    const carrier = players.find((player) => player.id === 'US_LD');

    expect(frame.ball).toMatchObject({
      stickContact: 'carry',
      stickTargetPlayerId: 'US_LD',
    });
    expect(carrier).toMatchObject({ clipName: 'sprint', speedMps: 2.97 });
    expect(carrier.locomotionCadence.cycleDurationSeconds).toBeCloseTo(0.8168, 4);
    expect(carrier.worldVelocity).toEqual([
      expect.closeTo(1, 3),
      0,
      expect.closeTo(2.8, 3),
    ]);
    expect(carrier.worldAngularVelocity).toBeCloseTo(-0.25, 3);
  });

  it('matches the wing release to a near-source sprint cycle', () => {
    const { frame, players } = runtimeAt(4.9);
    const carrier = players.find((player) => player.id === 'US_LW');

    expect(frame.ball).toMatchObject({
      stickContact: 'carry',
      stickTargetPlayerId: 'US_LW',
    });
    expect(carrier).toMatchObject({ clipName: 'sprint', speedMps: 2.43 });
    expect(carrier.locomotionCadence.cycleDurationSeconds).toBeCloseTo(0.9983, 4);
  });

  it('runs the authored goalie shuffle close to its one-second source cadence', () => {
    const { players } = runtimeAt(1.5);
    const goalie = players.find((player) => player.id === 'US_G');

    expect(goalie).toMatchObject({ clipName: 'goalie-shuffle', speedMps: 0.11 });
    expect(goalie.locomotionCadence.cycleDurationSeconds).toBeCloseTo(1.2727, 4);
  });
});
