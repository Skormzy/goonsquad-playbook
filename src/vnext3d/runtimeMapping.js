import {
  COURT_LENGTH_METERS,
  COURT_WIDTH_METERS,
  FIELD_JOG_SPEED_THRESHOLD_MPS,
  FIELD_SPRINT_SPEED_THRESHOLD_MPS,
  rinkDistanceMeters,
} from '../play-engine/movementMetrics';
import {
  BALL_RECEIVE_PREP_SECONDS,
  BALL_RELEASE_CONTACT_SECONDS,
  ballTimingProgressWindow,
} from '../play-engine/ballContactTiming';
import { isPenaltyBoxPlayer } from '../play-engine/penaltyBox';

export { COURT_LENGTH_METERS, COURT_WIDTH_METERS };

export const LOCOMOTION_CLIP_CALIBRATION = Object.freeze({
  jog: Object.freeze({ authoredDurationSeconds: 1.067, nominalSpeedMps: 1.7 }),
  sprint: Object.freeze({ authoredDurationSeconds: 0.933, nominalSpeedMps: 2.6 }),
  'goalie-shuffle': Object.freeze({ authoredDurationSeconds: 1.067, lateralExcursionMeters: 0.07 }),
});

export const LOCOMOTION_CYCLE_DISTANCE_METERS = Object.freeze({
  jog: LOCOMOTION_CLIP_CALIBRATION.jog.authoredDurationSeconds
    * LOCOMOTION_CLIP_CALIBRATION.jog.nominalSpeedMps,
  sprint: LOCOMOTION_CLIP_CALIBRATION.sprint.authoredDurationSeconds
    * LOCOMOTION_CLIP_CALIBRATION.sprint.nominalSpeedMps,
  'goalie-shuffle': LOCOMOTION_CLIP_CALIBRATION['goalie-shuffle'].lateralExcursionMeters * 2,
});

export const PRIVATE_CMU16_JOG_CYCLE_DISTANCE_METERS = 2.2321;
const PRIVATE_CMU16_REVIEWS = new Set([
  'cmu-jog16',
  'cmu-jog16-ik',
  'cmu-jog16-ik-uniform',
  'cmu-jog16-ik-red-sleeve',
  'cmu-jog16-ik-continuous-jersey',
  'cmu-jog16-ik-upper-body',
  'cmu-jog16-ik-open-face',
  'cmu-jog16-ik-natural-grip',
  'cmu-jog16-ik-diagonal-stick',
  'cmu-jog16-ik-pbr',
  'cmu-jog16-ik-silhouette',
  'cmu-jog16-ik-tailored-uniform',
  'cmu-jog16-ik-cloth-drape',
  'cmu-jog16-ik-helmet-detail',
  'cmu-jog16-ik-face-pose',
  'cmu-jog16-ik-neck-boundary',
]);

export function locomotionCycleDistance(clipName, motionReview = null) {
  if (PRIVATE_CMU16_REVIEWS.has(motionReview) && clipName === 'jog') {
    return PRIVATE_CMU16_JOG_CYCLE_DISTANCE_METERS;
  }
  return LOCOMOTION_CYCLE_DISTANCE_METERS[clipName];
}

export const FIELD_ACTION_CONTACT_PHASE = Object.freeze({
  pass: 15 / 31,
  receive: 15 / 31,
});

export const BALL_RADIUS_METERS = 0.033;
export const BOARD_IMPACT_HOP_MAX_METERS = 0.042;
const BOARD_IMPACT_HOP_WINDOW = 0.16;
const GOALIE_SHUFFLE_SPEED_MPS = 0.04;
const OUR_DEFENSIVE_ZONE_MAX_Y = 36;
const OPPONENT_DEFENSIVE_ZONE_MIN_Y = 64;

const FIELD_ACTIONS = Object.freeze({
  'idle-ready': 'ready',
  'jog-forward': 'jog',
  'sprint-forward': 'sprint',
  'receive-pass': 'receive',
  'forehand-pass': 'pass',
  'stick-handle': 'ready',
});

export function rinkPositionToWorld(position) {
  return {
    // Three.js uses a right-handed floor plane. Negating rink x keeps the
    // vertical playbook's left/right orientation intact when cameras look
    // from our end toward their end.
    x: ((50 - position.x) / 100) * COURT_WIDTH_METERS,
    z: ((position.y - 50) / 100) * COURT_LENGTH_METERS,
  };
}

export function worldPositionToRink(position) {
  const worldX = Array.isArray(position) ? position[0] : position.x;
  const worldZ = Array.isArray(position) ? position[2] : position.z;
  return {
    x: 50 - (worldX / COURT_WIDTH_METERS) * 100,
    y: 50 + (worldZ / COURT_LENGTH_METERS) * 100,
  };
}

export function rinkFacingToWorldRotation(facing = 0) {
  return -facing;
}

export function productionAssetKey(player) {
  const side = player.team === 'us' ? 'home' : 'away';
  return player.role === 'G' ? `goalie-${side}` : `field-${side}`;
}

function controllingTeam(frame) {
  const controllerId = frame?.ball?.ownerId
    ?? frame?.ball?.fromPlayerId
    ?? frame?.ball?.toPlayerId;
  return frame?.players?.find((player) => player.id === controllerId)?.team ?? null;
}

export function productionGoalieClipName(player, frame) {
  const ballTeam = controllingTeam(frame);
  const ballY = frame?.ball?.position?.y;
  const defendingZoneThreat = ballTeam && ballTeam !== player.team && Number.isFinite(ballY)
    && (player.team === 'us' ? ballY <= OUR_DEFENSIVE_ZONE_MAX_Y : ballY >= OPPONENT_DEFENSIVE_ZONE_MIN_Y);

  if (defendingZoneThreat) return 'goalie-set';
  if ((player.speedMps ?? 0) > GOALIE_SHUFFLE_SPEED_MPS) return 'goalie-shuffle';
  return 'goalie-ready';
}

export function productionClipName(player, frame) {
  if (player.role === 'G') return productionGoalieClipName(player, frame);
  if (player.action === 'stick-handle') return productionMovementClipName(player.speedMps);
  return FIELD_ACTIONS[player.action] ?? 'ready';
}

export function productionMovementClipName(speedMps = 0) {
  if (speedMps > FIELD_SPRINT_SPEED_THRESHOLD_MPS) return 'sprint';
  if (speedMps > FIELD_JOG_SPEED_THRESHOLD_MPS) return 'jog';
  return 'ready';
}

export function productionLocomotionCadence(clipName, speedMps = 0, motionReview = null) {
  const distance = locomotionCycleDistance(clipName, motionReview);
  const calibration = LOCOMOTION_CLIP_CALIBRATION[clipName];
  if (!distance || !calibration || speedMps <= 0) return null;

  const cyclesPerSecond = speedMps / distance;
  return {
    cyclesPerSecond,
    cycleDurationSeconds: 1 / cyclesPerSecond,
    authoredDurationRatio: (1 / cyclesPerSecond) / calibration.authoredDurationSeconds,
  };
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function productionActionPhase(player, frame) {
  const clipName = productionClipName(player, frame);
  const ball = frame?.ball;
  if (clipName === 'goalie-set') return 0.5;
  if (!ball) return null;

  if (clipName === 'pass' && ball.fromPlayerId === player.id) {
    const releaseWindow = ballTimingProgressWindow(
      BALL_RELEASE_CONTACT_SECONDS,
      ball.segmentDuration,
    );
    const releaseProgress = clamp01((ball.progress ?? 0) / releaseWindow);
    const contactPhase = FIELD_ACTION_CONTACT_PHASE.pass;
    return contactPhase + (1 - contactPhase) * releaseProgress;
  }

  if (clipName === 'receive' && ball.toPlayerId === player.id) {
    const receiveWindow = ballTimingProgressWindow(
      BALL_RECEIVE_PREP_SECONDS,
      ball.segmentDuration,
    );
    const receiveStart = 1 - receiveWindow;
    const receiveProgress = clamp01(((ball.progress ?? 0) - receiveStart) / receiveWindow);
    return FIELD_ACTION_CONTACT_PHASE.receive * receiveProgress;
  }

  return null;
}

export function productionBallHeightMeters(ball) {
  if (
    ball?.segmentType !== 'board-pass'
    || !Number.isFinite(ball.progress)
    || !Number.isFinite(ball.impactProgress)
  ) return BALL_RADIUS_METERS;

  const hopProgress = (ball.progress - ball.impactProgress) / BOARD_IMPACT_HOP_WINDOW;
  if (hopProgress <= 0 || hopProgress >= 1) return BALL_RADIUS_METERS;

  const damping = 1 - hopProgress * 0.42;
  return BALL_RADIUS_METERS
    + Math.sin(hopProgress * Math.PI) * BOARD_IMPACT_HOP_MAX_METERS * damping;
}

export function productionBallPosition(ball, contactPoint) {
  const trajectory = rinkPositionToWorld(ball.trajectoryPosition ?? ball.position);
  const base = { x: trajectory.x, y: productionBallHeightMeters(ball), z: trajectory.z };
  const weight = clamp01(ball.stickContactWeight ?? 0);
  if (!contactPoint || weight === 0) return base;

  return {
    x: base.x + (contactPoint.x - base.x) * weight,
    y: base.y + (contactPoint.y - base.y) * weight,
    z: base.z + (contactPoint.z - base.z) * weight,
  };
}

function worldDistanceBetween(from, to) {
  return rinkDistanceMeters(from, to);
}

function productionWorldMotion(player, requestedTime) {
  if (!Array.isArray(player.keyframes) || player.keyframes.length < 2) {
    return { velocity: [0, 0, 0], angularVelocity: 0 };
  }

  const segment = player.keyframes.slice(0, -1).find((current, index) => (
    requestedTime >= current.time && requestedTime <= player.keyframes[index + 1].time
  ));
  if (!segment) return { velocity: [0, 0, 0], angularVelocity: 0 };
  const index = player.keyframes.indexOf(segment);
  const next = player.keyframes[index + 1];
  const duration = Math.max(next.time - segment.time, 0.001);
  const start = rinkPositionToWorld(segment.position);
  const end = rinkPositionToWorld(next.position);
  return {
    velocity: [(end.x - start.x) / duration, 0, (end.z - start.z) / duration],
    angularVelocity: (
      rinkFacingToWorldRotation(next.facing)
      - rinkFacingToWorldRotation(segment.facing)
    ) / duration,
  };
}

function locomotionClipForSegment(player, current, next) {
  const duration = Math.max(next.time - current.time, 0.001);
  if (player.role === 'G') {
    const speedMps = worldDistanceBetween(current.position, next.position) / duration;
    return speedMps > GOALIE_SHUFFLE_SPEED_MPS ? 'goalie-shuffle' : null;
  }

  const speedMps = worldDistanceBetween(current.position, next.position) / duration;
  const clipName = productionMovementClipName(speedMps);
  return clipName === 'ready' ? null : clipName;
}

export function productionLocomotionCycles(player, requestedTime, motionReview = null) {
  if (!Array.isArray(player.keyframes) || player.keyframes.length < 2) return 0;

  const firstTime = player.keyframes[0].time;
  const finalTime = player.keyframes.at(-1).time;
  const time = Math.min(Math.max(requestedTime, firstTime), finalTime);
  let cycles = 0;

  for (let index = 0; index < player.keyframes.length - 1; index += 1) {
    const current = player.keyframes[index];
    const next = player.keyframes[index + 1];
    if (time <= current.time) break;

    const clipName = locomotionClipForSegment(player, current, next);
    if (!clipName) continue;

    const segmentProgress = Math.min((time - current.time) / (next.time - current.time), 1);
    const traveledMeters = worldDistanceBetween(current.position, next.position) * segmentProgress;
    cycles += traveledMeters / locomotionCycleDistance(clipName, motionReview);

    if (time < next.time) break;
  }

  return cycles;
}

export function productionClipPhaseOffset(clipName, motionReview = null, motionTuning = null) {
  if (!PRIVATE_CMU16_REVIEWS.has(motionReview) || clipName !== 'sprint') return 0;
  return motionTuning?.sprintPhaseOffset ?? 0;
}

export function createProductionRuntimePlayers(frame, motionReview = null, motionTuning = null) {
  return frame.players
    .filter((player) => !isPenaltyBoxPlayer(player))
    .map((player) => {
      const world = rinkPositionToWorld(player.position);
      const clipName = productionClipName(player, frame);
      const worldMotion = productionWorldMotion(player, frame.time);
      return {
        ...player,
        assetKey: productionAssetKey(player),
        clipName,
        actionPhase: productionActionPhase(player, frame),
        locomotionCadence: productionLocomotionCadence(clipName, player.speedMps, motionReview),
        motionPhaseCycles: productionLocomotionCycles(player, frame.time, motionReview)
          + productionClipPhaseOffset(clipName, motionReview, motionTuning),
        worldPosition: [world.x, 0, world.z],
        worldRotation: rinkFacingToWorldRotation(player.facing),
        worldVelocity: worldMotion.velocity,
        worldAngularVelocity: worldMotion.angularVelocity,
      };
    });
}
