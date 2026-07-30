import { describe, expect, it } from 'vitest';
import {
  BALL_RECEIVE_PREP_SECONDS,
  BALL_RELEASE_CONTACT_SECONDS,
} from '../play-engine/ballContactTiming';
import {
  BALL_RADIUS_METERS,
  BOARD_IMPACT_HOP_MAX_METERS,
  COURT_LENGTH_METERS,
  COURT_WIDTH_METERS,
  FIELD_ACTION_CONTACT_PHASE,
  LOCOMOTION_CYCLE_DISTANCE_METERS,
  LOCOMOTION_CLIP_CALIBRATION,
  PRIVATE_CMU16_JOG_CYCLE_DISTANCE_METERS,
  createProductionRuntimePlayers,
  productionActionPhase,
  productionAssetKey,
  productionBallPosition,
  productionBallHeightMeters,
  productionClipName,
  productionClipPhaseOffset,
  productionGoalieClipName,
  productionLocomotionCadence,
  productionLocomotionCycles,
  productionMovementClipName,
  rinkFacingToWorldRotation,
  rinkPositionToWorld,
  worldPositionToRink,
} from './runtimeMapping';

describe('vNext production athlete runtime mapping', () => {
  it('maps percentage rink coordinates into the production court', () => {
    expect(rinkPositionToWorld({ x: 0, y: 0 })).toEqual({
      x: COURT_WIDTH_METERS / 2,
      z: -COURT_LENGTH_METERS / 2,
    });
    expect(rinkPositionToWorld({ x: 50, y: 50 })).toEqual({ x: 0, z: 0 });
    expect(rinkPositionToWorld({ x: 100, y: 100 })).toEqual({
      x: -COURT_WIDTH_METERS / 2,
      z: COURT_LENGTH_METERS / 2,
    });
    expect(worldPositionToRink(rinkPositionToWorld({ x: 18, y: 73 }))).toEqual({
      x: 18,
      y: 73,
    });
    expect(rinkFacingToWorldRotation(Math.PI / 3)).toBeCloseTo(-Math.PI / 3);
  });

  it('selects only accepted field and goalie variants', () => {
    expect(productionAssetKey({ team: 'us', role: 'C' })).toBe('field-home');
    expect(productionAssetKey({ team: 'opponent', role: 'LD' })).toBe('field-away');
    expect(productionAssetKey({ team: 'us', role: 'G' })).toBe('goalie-home');
    expect(productionAssetKey({ team: 'opponent', role: 'G' })).toBe('goalie-away');
  });

  it('maps replay actions to authored Blender clips', () => {
    expect(productionClipName({ role: 'C', action: 'sprint-forward' })).toBe('sprint');
    expect(productionClipName({ role: 'LW', action: 'forehand-pass' })).toBe('pass');
    expect(productionClipName({ role: 'RW', action: 'receive-pass' })).toBe('receive');
    expect(productionClipName({ role: 'G', action: 'goalie-ready' })).toBe('goalie-ready');
    expect(productionClipName({ role: 'LD', action: 'stick-handle', speedMps: 2.8 })).toBe('sprint');
    expect(productionClipName({ role: 'LW', action: 'stick-handle', speedMps: 1.7 })).toBe('jog');
  });

  it('calibrates locomotion distance to accepted clip timing and flagship court speed', () => {
    expect(LOCOMOTION_CYCLE_DISTANCE_METERS.jog).toBeCloseTo(1.8139, 4);
    expect(LOCOMOTION_CYCLE_DISTANCE_METERS.sprint).toBeCloseTo(2.4258, 4);
    expect(LOCOMOTION_CYCLE_DISTANCE_METERS['goalie-shuffle']).toBe(0.14);
    expect(LOCOMOTION_CLIP_CALIBRATION.jog.authoredDurationSeconds).toBe(1.067);
    expect(productionMovementClipName(2.1)).toBe('jog');
    expect(productionMovementClipName(2.3)).toBe('sprint');
    expect(productionLocomotionCadence('jog', 1.7)).toMatchObject({
      cyclesPerSecond: expect.closeTo(1 / 1.067, 4),
      authoredDurationRatio: expect.closeTo(1, 4),
    });
    expect(productionLocomotionCadence('sprint', 2.6)).toMatchObject({
      cyclesPerSecond: expect.closeTo(1 / 0.933, 4),
      authoredDurationRatio: expect.closeTo(1, 4),
    });
    expect(productionLocomotionCadence('ready', 2)).toBeNull();
  });

  it('uses source-measured jog distance only for the private Subject 16 review', () => {
    expect(PRIVATE_CMU16_JOG_CYCLE_DISTANCE_METERS).toBe(2.2321);
    expect(productionLocomotionCadence('jog', 1.6741, 'cmu-jog16')).toMatchObject({
      cycleDurationSeconds: expect.closeTo(1.3333, 4),
      authoredDurationRatio: expect.closeTo(1.2496, 4),
    });
    expect(productionLocomotionCadence('jog', 1.6741).cycleDurationSeconds)
      .not.toBeCloseTo(1.3333, 2);
    expect(productionLocomotionCadence('jog', 1.6741, 'cmu-jog16-ik')).toMatchObject({
      cycleDurationSeconds: expect.closeTo(1.3333, 4),
    });
    expect(productionLocomotionCadence('jog', 1.6741, 'cmu-jog16-ik-pbr')).toMatchObject({
      cycleDurationSeconds: expect.closeTo(1.3333, 4),
    });
  });

  it('keeps sprint phase tuning private to the captured locomotion review', () => {
    expect(productionClipPhaseOffset('sprint', 'cmu-jog16')).toBe(0);
    expect(productionClipPhaseOffset('sprint', 'cmu-jog16', { sprintPhaseOffset: 0.609 }))
      .toBe(0.609);
    expect(productionClipPhaseOffset('sprint', 'cmu-jog16-ik', { sprintPhaseOffset: 0.609 }))
      .toBe(0.609);
    expect(productionClipPhaseOffset('sprint', 'cmu-jog16-ik-pbr', { sprintPhaseOffset: 0.609 }))
      .toBe(0.609);
    expect(productionClipPhaseOffset('jog', 'cmu-jog16', { sprintPhaseOffset: 0.609 }))
      .toBe(0);
    expect(productionClipPhaseOffset('sprint', null, { sprintPhaseOffset: 0.609 }))
      .toBe(0);
  });


  it('uses authored goalie tracking and set actions from deterministic replay state', () => {
    const homeGoalie = { id: 'US_G', role: 'G', team: 'us', speedMps: 0.12 };
    const awayGoalie = { id: 'OP_G', role: 'G', team: 'opponent', speedMps: 0.12 };
    const frame = {
      players: [homeGoalie, awayGoalie, { id: 'US_RW', role: 'RW', team: 'us' }],
      ball: { ownerId: 'US_RW', position: { x: 55, y: 70 } },
    };

    expect(productionGoalieClipName(homeGoalie, frame)).toBe('goalie-shuffle');
    expect(productionGoalieClipName(awayGoalie, frame)).toBe('goalie-set');
    expect(productionActionPhase(awayGoalie, frame)).toBe(0.5);
    expect(productionGoalieClipName({ ...homeGoalie, speedMps: 0 }, {
      ...frame,
      ball: { ownerId: 'US_RW', position: { x: 55, y: 50 } },
    })).toBe('goalie-ready');
  });

  it('aligns pass release and receive catch phases to the authored contact frame', () => {
    const passer = { id: 'US_LD', role: 'LD', action: 'forehand-pass' };
    const receiver = { id: 'US_LW', role: 'LW', action: 'receive-pass' };
    const segmentDuration = 2.2;
    const releaseEnd = BALL_RELEASE_CONTACT_SECONDS / segmentDuration;
    const receiveStart = 1 - BALL_RECEIVE_PREP_SECONDS / segmentDuration;

    expect(productionActionPhase(passer, {
      ball: { fromPlayerId: 'US_LD', progress: 0, segmentDuration },
    })).toBeCloseTo(FIELD_ACTION_CONTACT_PHASE.pass, 6);
    expect(productionActionPhase(passer, {
      ball: { fromPlayerId: 'US_LD', progress: releaseEnd, segmentDuration },
    })).toBe(1);
    expect(productionActionPhase(receiver, {
      ball: { toPlayerId: 'US_LW', progress: receiveStart, segmentDuration },
    })).toBe(0);
    expect(productionActionPhase(receiver, {
      ball: { toPlayerId: 'US_LW', progress: 1, segmentDuration },
    })).toBeCloseTo(FIELD_ACTION_CONTACT_PHASE.receive, 6);
  });

  it('blends the one replay ball from its trajectory to the accepted GLB contact marker', () => {
    const ball = {
      position: { x: 20, y: 30 },
      trajectoryPosition: { x: 60, y: 70 },
      stickContactWeight: 0.5,
    };
    const trajectory = rinkPositionToWorld(ball.trajectoryPosition);
    const marker = { x: 4, y: 0.14, z: 12 };
    const result = productionBallPosition(ball, marker);

    expect(result.x).toBeCloseTo((trajectory.x + marker.x) / 2, 6);
    expect(result.y).toBeCloseTo((BALL_RADIUS_METERS + marker.y) / 2, 6);
    expect(result.z).toBeCloseTo((trajectory.z + marker.z) / 2, 6);
    expect(productionBallPosition({ ...ball, stickContactWeight: 0 }, marker)).toEqual({
      x: trajectory.x,
      y: BALL_RADIUS_METERS,
      z: trajectory.z,
    });
  });

  it('adds one restrained post-impact hop without changing carry or receive height', () => {
    const boardBall = {
      segmentType: 'board-pass',
      impactProgress: 0.52,
    };

    expect(productionBallHeightMeters({ ...boardBall, progress: 0.52 })).toBe(BALL_RADIUS_METERS);
    const risingHeight = productionBallHeightMeters({ ...boardBall, progress: 0.58 });
    expect(risingHeight).toBeGreaterThan(BALL_RADIUS_METERS + 0.02);
    expect(risingHeight).toBeLessThanOrEqual(BALL_RADIUS_METERS + BOARD_IMPACT_HOP_MAX_METERS);
    expect(productionBallHeightMeters({ ...boardBall, progress: 0.69 })).toBe(BALL_RADIUS_METERS);
    expect(productionBallHeightMeters({ segmentType: 'carry', progress: 0.5 })).toBe(BALL_RADIUS_METERS);
  });

  it('preserves exactly 12 replay athletes with two goalies', () => {
    const players = Array.from({ length: 12 }, (_, index) => ({
      id: `P${index}`,
      team: index < 6 ? 'us' : 'opponent',
      role: index === 0 || index === 6 ? 'G' : 'C',
      action: 'idle-ready',
      position: { x: 10 + index * 6, y: 8 + index * 7 },
      facing: 0,
    }));
    const runtime = createProductionRuntimePlayers({ players, time: 0 });
    expect(runtime).toHaveLength(12);
    expect(runtime.filter((player) => player.assetKey.startsWith('goalie-'))).toHaveLength(2);
    expect(runtime.every((player) => player.assetKey === 'field-home'
      || player.assetKey === 'field-away'
      || player.assetKey === 'goalie-home'
      || player.assetKey === 'goalie-away')).toBe(true);
  });

  it('omits a penalized athlete from the production runtime', () => {
    const players = Array.from({ length: 12 }, (_, index) => ({
      id: `P${index}`,
      team: index < 6 ? 'us' : 'opponent',
      role: index === 0 || index === 6 ? 'G' : 'C',
      action: 'sprint-forward',
      position: { x: 10 + index * 6, y: 8 + index * 7 },
      facing: 0.7,
      speedMps: 3.1,
      status: index === 11 ? 'penalty-box' : 'active',
      active: index !== 11,
    }));
    const runtime = createProductionRuntimePlayers({ players, time: 0 });

    expect(runtime).toHaveLength(11);
    expect(runtime.find((player) => player.id === 'P11')).toBeUndefined();
    expect(runtime.every((player) => player.status !== 'penalty-box')).toBe(true);
  });

  it('drives locomotion phase from cumulative world distance instead of replay time', () => {
    const player = {
      role: 'C',
      keyframes: [
        { time: 0, position: { x: 50, y: 50 } },
        { time: 2, position: { x: 60, y: 50 } },
        { time: 4, position: { x: 60, y: 60 } },
      ],
    };

    const firstHalfMeters = COURT_WIDTH_METERS * 0.05;
    expect(productionLocomotionCycles(player, 1)).toBeCloseTo(
      firstHalfMeters / LOCOMOTION_CYCLE_DISTANCE_METERS.jog,
      5,
    );

    const xSegmentMeters = COURT_WIDTH_METERS * 0.1;
    const halfZSegmentMeters = COURT_LENGTH_METERS * 0.05;
    expect(productionLocomotionCycles(player, 3)).toBeCloseTo(
      xSegmentMeters / LOCOMOTION_CYCLE_DISTANCE_METERS.jog
        + halfZSegmentMeters / LOCOMOTION_CYCLE_DISTANCE_METERS.sprint,
      5,
    );
  });

  it('preserves foot phase through jog and sprint segments and gives goalies an independent shuffle cadence', () => {
    const fieldPlayer = {
      role: 'LW',
      keyframes: [
        { time: 0, position: { x: 10, y: 20 } },
        { time: 2, position: { x: 20, y: 20 } },
        { time: 3, position: { x: 50, y: 20 } },
      ],
    };
    const jogCycles = (COURT_WIDTH_METERS * 0.1) / LOCOMOTION_CYCLE_DISTANCE_METERS.jog;
    const sprintCycles = (COURT_WIDTH_METERS * 0.3) / LOCOMOTION_CYCLE_DISTANCE_METERS.sprint;

    expect(productionLocomotionCycles(fieldPlayer, 3)).toBeCloseTo(jogCycles + sprintCycles, 5);
    const goalie = {
      role: 'G',
      keyframes: [
        { time: 0, position: { x: 50, y: 7 } },
        { time: 2, position: { x: 52, y: 7 } },
      ],
    };
    const goalieTravelMeters = COURT_WIDTH_METERS * 0.02;
    expect(productionLocomotionCycles(goalie, 2)).toBeCloseTo(
      goalieTravelMeters / LOCOMOTION_CYCLE_DISTANCE_METERS['goalie-shuffle'],
      5,
    );
  });
});
