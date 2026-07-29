import { describe, expect, it } from 'vitest';
import { standardBreakout3dReplay } from '../replay3d/data/standardBreakout3d';
import {
  getPlayScene,
  getRegisteredPlayScenes,
  getRegisteredStrategyScenes,
} from '../play-engine/sceneRegistry';
import {
  COURT_WIDTH_METERS,
  PENALTY_BOX_WORLD_POSITIONS,
  PENALTY_BOX_WORLD_ROTATION,
} from '../vnext3d/runtimeMapping';
import {
  sampleTacticalBallTrail,
  sampleTacticalReplay,
  tacticalBallMotionStreakWidth,
  TACTICAL_REPLAY_ENGINE_ID,
} from './sampleTacticalReplay';

function distanceBetween(a, b) {
  return Math.hypot(
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  );
}

describe('sampleTacticalReplay', () => {
  it('samples one deterministic frame for all 12 athletes and one ball', () => {
    const frame = sampleTacticalReplay(standardBreakout3dReplay, 3.1);

    expect(frame.engineId).toBe(TACTICAL_REPLAY_ENGINE_ID);
    expect(frame.players).toHaveLength(12);
    expect(new Set(frame.players.map((player) => player.id)).size).toBe(12);
    expect(frame.ball.worldPosition).toHaveLength(3);
    expect(frame.ball.state).toBe('flight');
  });

  it.each([
    ['ppum', 'opponent'],
    ['ppfo', 'opponent'],
    ['pkb', 'us'],
    ['pkfo', 'us'],
    ['pkcl', 'us'],
  ])('keeps the penalized athlete in the attached box for %s', (playId, team) => {
    const replay = getPlayScene(playId);
    const frame = sampleTacticalReplay(replay, replay.duration / 2);
    const boxedPlayers = frame.players.filter((player) => player.penaltyBox);

    expect(frame.players).toHaveLength(12);
    expect(boxedPlayers).toHaveLength(1);
    expect(boxedPlayers[0].team).toBe(team);
    expect(boxedPlayers[0].worldPosition).toEqual(PENALTY_BOX_WORLD_POSITIONS[team]);
    expect(boxedPlayers[0].worldPosition[0]).toBeLessThan(-COURT_WIDTH_METERS / 2);
    expect(boxedPlayers[0].worldRotation).toBe(PENALTY_BOX_WORLD_ROTATION);
    expect(boxedPlayers[0].worldVelocity).toEqual([0, 0, 0]);
    expect(boxedPlayers[0].clipName).toBe('ready');
  });

  it('keeps the ball continuous through release, board impact, and reception', () => {
    const boardPass = standardBreakout3dReplay.ball.segments[1];
    const impactTime = sampleTacticalReplay(
      standardBreakout3dReplay,
      (boardPass.from + boardPass.to) / 2,
    ).ball.impactTime;

    for (const boundary of [boardPass.from, impactTime, boardPass.to]) {
      const before = sampleTacticalReplay(standardBreakout3dReplay, boundary - 0.0001).ball.worldPosition;
      const after = sampleTacticalReplay(standardBreakout3dReplay, boundary + 0.0001).ball.worldPosition;
      expect(distanceBetween(before, after)).toBeLessThan(0.01);
    }
  });

  it('uses explicit authoritative ball states in tactical order', () => {
    const samples = [
      sampleTacticalReplay(standardBreakout3dReplay, 1).ball.state,
      sampleTacticalReplay(standardBreakout3dReplay, 2.45).ball.state,
      sampleTacticalReplay(standardBreakout3dReplay, 3.1).ball.state,
      sampleTacticalReplay(standardBreakout3dReplay, 4.45).ball.state,
      sampleTacticalReplay(standardBreakout3dReplay, 5.2).ball.state,
    ];

    expect(samples).toEqual(['carried', 'release', 'flight', 'receive', 'controlled']);
  });

  it('hits the boards and returns to the designated winger without any extra pass', () => {
    const passFrame = sampleTacticalReplay(standardBreakout3dReplay, 3.1);
    const impactFrame = sampleTacticalReplay(standardBreakout3dReplay, passFrame.ball.impactTime);
    const receivedFrame = sampleTacticalReplay(standardBreakout3dReplay, 4.6);
    const finalFrame = sampleTacticalReplay(standardBreakout3dReplay, standardBreakout3dReplay.duration);

    expect(impactFrame.ball.worldPosition[0]).toBeCloseTo(-11.04, 2);
    expect(receivedFrame.ball.ownerId).toBe('US_LW');
    expect(finalFrame.ball.ownerId).toBe('US_LW');
    expect(finalFrame.ball.segmentType).toBe('carry');
  });

  it('renders one deterministic streak only while the authoritative ball is in flight', () => {
    const carriedFrame = sampleTacticalReplay(standardBreakout3dReplay, 1.2);
    const flightFrame = sampleTacticalReplay(standardBreakout3dReplay, 3.45);
    const trail = sampleTacticalBallTrail(standardBreakout3dReplay, 3.45);

    expect(tacticalBallMotionStreakWidth(carriedFrame.ball)).toBe(0);
    expect(sampleTacticalBallTrail(standardBreakout3dReplay, 1.2)).toBeNull();
    expect(tacticalBallMotionStreakWidth(flightFrame.ball)).toBe(1);
    expect(trail).not.toBeNull();
    expect(trail.distance).toBeGreaterThan(0.1);
    expect(trail.distance).toBeLessThan(1.2);
    expect(trail.end).toEqual(flightFrame.ball.worldPosition);
  });

  it('never advances the ball far enough in one 120 Hz frame to look like a teleport', () => {
    let previous = sampleTacticalReplay(standardBreakout3dReplay, 0).ball.worldPosition;
    let maximumStep = 0;
    for (let time = 1 / 120; time <= standardBreakout3dReplay.duration; time += 1 / 120) {
      const current = sampleTacticalReplay(standardBreakout3dReplay, time).ball.worldPosition;
      maximumStep = Math.max(maximumStep, distanceBetween(previous, current));
      previous = current;
    }

    expect(maximumStep).toBeLessThan(0.16);
  });

  it('keeps one continuous authoritative ball across every generated scene boundary', () => {
    const scenes = [...getRegisteredPlayScenes(), ...getRegisteredStrategyScenes()];
    scenes.forEach((scene) => {
      scene.ball.segments.slice(0, -1).forEach((segment, index) => {
        const before = sampleTacticalReplay(scene, Math.max(0, segment.to - 0.0001)).ball.worldPosition;
        const after = sampleTacticalReplay(scene, Math.min(scene.duration, segment.to + 0.0001)).ball.worldPosition;
        expect(
          distanceBetween(before, after),
          `${scene.id} ${segment.type}->${scene.ball.segments[index + 1].type} at ${segment.to}`,
        ).toBeLessThan(0.025);
      });
    });
  });
});
