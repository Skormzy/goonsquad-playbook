import {
  FIELD_JOG_SPEED_THRESHOLD_MPS,
  FIELD_SPRINT_SPEED_THRESHOLD_MPS,
  rinkDistanceMeters,
} from '../play-engine/movementMetrics';
import {
  productionAssetKey,
  productionPenaltyBoxPose,
  rinkFacingToWorldRotation,
  rinkPositionToWorld,
  worldPositionToRink,
} from '../vnext3d/runtimeMapping';
import { isPenaltyBoxPlayer } from '../play-engine/penaltyBox';

export const TACTICAL_BALL_RADIUS_METERS = 0.052;
export const TACTICAL_BALL_RENDER_MODE = 'single-authority-flight-streak';
export const TACTICAL_REPLAY_ENGINE_ID = 'strategy-runtime-v1';

const BALL_RELEASE_SECONDS = 0.18;
const BALL_RECEIVE_SECONDS = 0.26;
const BALL_CONTROL_SETTLE_SECONDS = 0.18;
const BOARD_IMPACT_STATE_SECONDS = 0.09;
const BOARD_IMPACT_HOP_SECONDS = 0.24;
const BOARD_IMPACT_HOP_METERS = 0.038;
const BALL_TRAIL_LOOKBACK_SECONDS = 0.075;
const FIELD_JOG_CYCLE_METERS = 2.2321;
const FIELD_SPRINT_CYCLE_METERS = 2.5;
const GOALIE_CYCLE_METERS = 0.28;
const BALL_RELEASE_FACING_LEAD_SECONDS = 0.34;
const BALL_RELEASE_FACING_RECOVERY_SECONDS = 0.28;
const BALL_RECEIVE_FACING_LEAD_SECONDS = 0.42;
const MOVEMENT_HEADING_SPEED_MPS = 0.01;
const FULL_MOVEMENT_FACING_SPEED_MPS = 0.28;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const clamp01 = (value) => clamp(value, 0, 1);

function lerp(a, b, progress) {
  return a + (b - a) * progress;
}

function lerpAngle(a, b, progress) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * progress;
}

function movementFacingWeight(speedMps) {
  return clamp01((speedMps - 0.04) / (FULL_MOVEMENT_FACING_SPEED_MPS - 0.04));
}

function smoothstep(progress) {
  const value = clamp01(progress);
  return value * value * (3 - 2 * value);
}

function physicalVector(vector) {
  return { x: vector.x / 100 * 24, y: vector.y / 100 * 48 };
}

function vectorMagnitude(vector) {
  const physical = physicalVector(vector);
  return Math.hypot(physical.x, physical.y);
}

function keyframeTangent(keyframes, index) {
  if (index <= 0 || index >= keyframes.length - 1) return { x: 0, y: 0 };
  const previous = keyframes[index - 1];
  const current = keyframes[index];
  const next = keyframes[index + 1];
  const incomingSeconds = Math.max(current.time - previous.time, 0.001);
  const outgoingSeconds = Math.max(next.time - current.time, 0.001);
  const incoming = {
    x: (current.position.x - previous.position.x) / incomingSeconds,
    y: (current.position.y - previous.position.y) / incomingSeconds,
  };
  const outgoing = {
    x: (next.position.x - current.position.x) / outgoingSeconds,
    y: (next.position.y - current.position.y) / outgoingSeconds,
  };
  const incomingPhysical = physicalVector(incoming);
  const outgoingPhysical = physicalVector(outgoing);
  const incomingSpeed = Math.hypot(incomingPhysical.x, incomingPhysical.y);
  const outgoingSpeed = Math.hypot(outgoingPhysical.x, outgoingPhysical.y);
  const directionDot = (
    incomingPhysical.x * outgoingPhysical.x
    + incomingPhysical.y * outgoingPhysical.y
  );
  if (incomingSpeed < 0.02 || outgoingSpeed < 0.02 || directionDot <= 0) {
    return { x: 0, y: 0 };
  }

  const totalSeconds = Math.max(next.time - previous.time, 0.001);
  const tangent = {
    x: (next.position.x - previous.position.x) / totalSeconds,
    y: (next.position.y - previous.position.y) / totalSeconds,
  };
  const maximumSpeed = Math.min(incomingSpeed, outgoingSpeed) * 1.2;
  const tangentSpeed = vectorMagnitude(tangent);
  if (tangentSpeed <= maximumSpeed || tangentSpeed < 0.001) return tangent;
  const scale = maximumSpeed / tangentSpeed;
  return { x: tangent.x * scale, y: tangent.y * scale };
}

function hermiteTrackSample(current, next, currentTangent, nextTangent, duration, progress) {
  const progress2 = progress * progress;
  const progress3 = progress2 * progress;
  const h00 = 2 * progress3 - 3 * progress2 + 1;
  const h10 = progress3 - 2 * progress2 + progress;
  const h01 = -2 * progress3 + 3 * progress2;
  const h11 = progress3 - progress2;
  const dh00 = 6 * progress2 - 6 * progress;
  const dh10 = 3 * progress2 - 4 * progress + 1;
  const dh01 = -6 * progress2 + 6 * progress;
  const dh11 = 3 * progress2 - 2 * progress;
  return {
    position: {
      x: h00 * current.x + h10 * currentTangent.x * duration
        + h01 * next.x + h11 * nextTangent.x * duration,
      y: h00 * current.y + h10 * currentTangent.y * duration
        + h01 * next.y + h11 * nextTangent.y * duration,
    },
    derivative: {
      x: (dh00 * current.x + dh10 * currentTangent.x * duration
        + dh01 * next.x + dh11 * nextTangent.x * duration) / duration,
      y: (dh00 * current.y + dh10 * currentTangent.y * duration
        + dh01 * next.y + dh11 * nextTangent.y * duration) / duration,
    },
  };
}

function findTrackSegment(keyframes, requestedTime) {
  const time = clamp(requestedTime, keyframes[0].time, keyframes.at(-1).time);
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    if (time <= keyframes[index + 1].time) {
      const current = keyframes[index];
      const next = keyframes[index + 1];
      const duration = Math.max(next.time - current.time, 0.001);
      return {
        index,
        progress: clamp01((time - current.time) / duration),
        duration,
      };
    }
  }
  return {
    index: keyframes.length - 2,
    progress: 1,
    duration: Math.max(keyframes.at(-1).time - keyframes.at(-2).time, 0.001),
  };
}

function cumulativeTrackDistance(player, segmentIndex, segmentProgress) {
  let distance = 0;
  for (let index = 0; index < segmentIndex; index += 1) {
    distance += rinkDistanceMeters(
      player.keyframes[index].position,
      player.keyframes[index + 1].position,
    );
  }
  distance += rinkDistanceMeters(
    player.keyframes[segmentIndex].position,
    player.keyframes[segmentIndex + 1].position,
  ) * segmentProgress;
  return distance;
}

function authoredFacing(player, segmentIndex, progress) {
  const current = player.keyframes[segmentIndex];
  const next = player.keyframes[segmentIndex + 1];
  return lerpAngle(current.facing ?? 0, next.facing ?? 0, progress);
}

export function sampleTacticalPlayerTrack(player, requestedTime) {
  const { keyframes } = player;
  const { index, progress, duration } = findTrackSegment(keyframes, requestedTime);
  const current = keyframes[index].position;
  const next = keyframes[index + 1].position;
  const trackSample = hermiteTrackSample(
    current,
    next,
    keyframeTangent(keyframes, index),
    keyframeTangent(keyframes, index + 1),
    duration,
    progress,
  );
  const position = {
    x: clamp(trackSample.position.x, 0, 100),
    y: clamp(trackSample.position.y, 0, 100),
  };
  const world = rinkPositionToWorld(position);
  const worldVelocity = [
    -trackSample.derivative.x / 100 * 24,
    0,
    trackSample.derivative.y / 100 * 48,
  ];
  const speedMps = Math.hypot(worldVelocity[0], worldVelocity[2]);
  const authoredRotation = rinkFacingToWorldRotation(
    authoredFacing(player, index, progress),
  );
  const movementRotation = speedMps >= MOVEMENT_HEADING_SPEED_MPS
    ? Math.atan2(worldVelocity[0], worldVelocity[2])
    : authoredRotation;
  return {
    ...player,
    time: clamp(requestedTime, keyframes[0].time, keyframes.at(-1).time),
    position,
    worldPosition: [world.x, 0, world.z],
    worldVelocity,
    authoredRotation,
    movementRotation,
    worldRotation: authoredRotation,
    speedMps,
    trackDistanceMeters: cumulativeTrackDistance(player, index, progress),
  };
}

function headingToWorldPoint(player, point, fallback) {
  const dx = point.x - player.worldPosition[0];
  const dz = point.z - player.worldPosition[2];
  if (Math.hypot(dx, dz) < 0.01) return fallback;
  return Math.atan2(dx, dz);
}

function releaseTarget(segment) {
  if (segment.type === 'board-pass' && segment.impact) return worldPoint(segment.impact);
  const pathTarget = segment.path?.find((point) => distance2d(worldPoint(segment.start), worldPoint(point)) > 0.05);
  return worldPoint(pathTarget ?? segment.end);
}

function receiveSource(segment) {
  if (segment.type === 'board-pass' && segment.impact) return worldPoint(segment.impact);
  const pathSource = segment.path?.length > 2 ? segment.path.at(-2) : segment.start;
  return worldPoint(pathSource);
}

export function resolveTacticalPlayerFacing(scene, player, requestedTime) {
  if (player.role === 'G') return player.authoredRotation ?? player.worldRotation ?? 0;

  const movementRotation = player.movementRotation ?? player.worldRotation ?? 0;
  const movementWeight = movementFacingWeight(player.speedMps);
  const release = scene.ball.segments.find((segment) => (
    segment.fromPlayerId === player.id
    && requestedTime >= segment.from - BALL_RELEASE_FACING_LEAD_SECONDS
    && requestedTime <= segment.from + BALL_RELEASE_FACING_RECOVERY_SECONDS
  ));
  if (release) {
    const targetRotation = headingToWorldPoint(player, releaseTarget(release), movementRotation);
    const baseRotation = lerpAngle(
      player.authoredRotation ?? player.worldRotation ?? 0,
      movementRotation,
      movementWeight,
    );
    const turnWeight = requestedTime <= release.from
      ? smoothstep(
        (requestedTime - (release.from - BALL_RELEASE_FACING_LEAD_SECONDS))
          / BALL_RELEASE_FACING_LEAD_SECONDS,
      )
      : 1 - smoothstep(
        (requestedTime - release.from) / BALL_RELEASE_FACING_RECOVERY_SECONDS,
      );
    return lerpAngle(baseRotation, targetRotation, turnWeight);
  }

  const receive = scene.ball.segments.find((segment) => (
    segment.toPlayerId === player.id
    && requestedTime >= segment.to - BALL_RECEIVE_FACING_LEAD_SECONDS
    && requestedTime <= segment.to + BALL_RECEIVE_SECONDS
  ));
  if (receive) {
    const receiveMovementWeight = movementFacingWeight(player.speedMps);
    const source = receiveSource(receive);
    const sourceDistance = distance2d(
      { x: player.worldPosition[0], z: player.worldPosition[2] },
      source,
    );
    const targetRotation = sourceDistance < 0.35
      ? player.authoredRotation ?? movementRotation
      : headingToWorldPoint(player, source, movementRotation);
    return lerpAngle(targetRotation, movementRotation, receiveMovementWeight);
  }

  const carry = scene.ball.segments.find((segment) => (
    segment.type === 'carry'
    && segment.ownerId === player.id
    && requestedTime >= segment.from
    && requestedTime <= segment.to
  ));
  if (carry) {
    return lerpAngle(
      player.authoredRotation ?? player.worldRotation ?? movementRotation,
      movementRotation,
      movementWeight,
    );
  }

  return lerpAngle(
    player.authoredRotation ?? player.worldRotation ?? 0,
    movementRotation,
    movementWeight,
  );
}

function sampleOrientedPlayerTrack(scene, player, requestedTime) {
  const sampled = sampleTacticalPlayerTrack(player, requestedTime);
  return {
    ...sampled,
    worldRotation: resolveTacticalPlayerFacing(scene, sampled, requestedTime),
  };
}

function faceWorldPosition(player, worldPosition) {
  return headingToWorldPoint(
    player,
    { x: worldPosition[0], z: worldPosition[2] },
    player.worldRotation ?? 0,
  );
}

function orientPlayerToLiveAction(player, ball) {
  if (player.role === 'G') {
    return { ...player, worldRotation: faceWorldPosition(player, ball.worldPosition) };
  }

  const involvedPlayerIds = [ball.ownerId, ball.fromPlayerId, ball.toPlayerId];
  if (player.speedMps < MOVEMENT_HEADING_SPEED_MPS && !involvedPlayerIds.includes(player.id)) {
    return { ...player, worldRotation: faceWorldPosition(player, ball.worldPosition) };
  }

  return player;
}

function stickPocketWorld(player) {
  const heading = player.worldRotation ?? 0;
  const forward = [Math.sin(heading), Math.cos(heading)];
  const right = [Math.cos(heading), -Math.sin(heading)];
  const lateral = player.team === 'us' ? -0.38 : 0.38;
  const forwardReach = 0.72;
  return {
    x: player.worldPosition[0] + forward[0] * forwardReach + right[0] * lateral,
    z: player.worldPosition[2] + forward[1] * forwardReach + right[1] * lateral,
  };
}

function worldPoint(position) {
  const world = rinkPositionToWorld(position);
  return { x: world.x, z: world.z };
}

function distance2d(from, to) {
  return Math.hypot(to.x - from.x, to.z - from.z);
}

function linearPoint(from, to, progress) {
  return {
    x: lerp(from.x, to.x, progress),
    z: lerp(from.z, to.z, progress),
  };
}

function hermitePoint(from, to, startTangent, endTangent, progress) {
  const progress2 = progress * progress;
  const progress3 = progress2 * progress;
  const h00 = 2 * progress3 - 3 * progress2 + 1;
  const h10 = progress3 - 2 * progress2 + progress;
  const h01 = -2 * progress3 + 3 * progress2;
  const h11 = progress3 - progress2;
  return {
    x: h00 * from.x + h10 * startTangent.x + h01 * to.x + h11 * endTangent.x,
    z: h00 * from.z + h10 * startTangent.z + h01 * to.z + h11 * endTangent.z,
  };
}

function activeEvent(events, requestedTime) {
  let current = null;
  for (const event of events) {
    if (event.time > requestedTime) break;
    current = event;
  }
  return current;
}

function boardPassGeometry(scene, segment) {
  const passer = scene.players.find((player) => player.id === segment.fromPlayerId);
  const receiver = scene.players.find((player) => player.id === segment.toPlayerId);
  const releasePlayer = sampleOrientedPlayerTrack(scene, passer, segment.from);
  const receivePlayer = sampleOrientedPlayerTrack(scene, receiver, segment.to);
  const start = stickPocketWorld(releasePlayer);
  const impact = worldPoint(segment.impact);
  const end = stickPocketWorld(receivePlayer);
  const inboundDistance = distance2d(start, impact);
  const outboundDistance = distance2d(impact, end);
  const restitution = clamp(segment.restitution ?? 0.68, 0.2, 1);
  const effectiveDistance = inboundDistance + outboundDistance / restitution;
  const impactProgress = effectiveDistance > 0 ? inboundDistance / effectiveDistance : 0.5;
  const impactTime = lerp(segment.from, segment.to, impactProgress);
  const outboundDuration = Math.max(segment.to - impactTime, 0.001);
  const outboundVector = { x: end.x - impact.x, z: end.z - impact.z };

  return {
    start,
    impact,
    end,
    impactProgress,
    impactTime,
    outboundDuration,
    outboundStartTangent: {
      x: outboundVector.x * 1.08,
      z: outboundVector.z * 1.08,
    },
    outboundEndTangent: {
      x: receivePlayer.worldVelocity[0] * outboundDuration,
      z: receivePlayer.worldVelocity[2] * outboundDuration,
    },
  };
}

function boardPassState(segment, geometry, requestedTime) {
  if (requestedTime <= segment.from + BALL_RELEASE_SECONDS) return 'release';
  if (Math.abs(requestedTime - geometry.impactTime) <= BOARD_IMPACT_STATE_SECONDS / 2) {
    return 'board-impact';
  }
  if (requestedTime >= segment.to - BALL_RECEIVE_SECONDS) return 'receive';
  return 'flight';
}

function sampleBoardPass(scene, segment, requestedTime) {
  const geometry = boardPassGeometry(scene, segment);
  const inbound = requestedTime <= geometry.impactTime;
  let point;
  if (inbound) {
    const progress = clamp01(
      (requestedTime - segment.from) / Math.max(geometry.impactTime - segment.from, 0.001),
    );
    point = linearPoint(geometry.start, geometry.impact, progress);
  } else {
    const progress = clamp01(
      (requestedTime - geometry.impactTime) / geometry.outboundDuration,
    );
    point = hermitePoint(
      geometry.impact,
      geometry.end,
      geometry.outboundStartTangent,
      geometry.outboundEndTangent,
      progress,
    );
  }

  const hopProgress = clamp01((requestedTime - geometry.impactTime) / BOARD_IMPACT_HOP_SECONDS);
  const hop = requestedTime > geometry.impactTime
    && requestedTime < geometry.impactTime + BOARD_IMPACT_HOP_SECONDS
    ? Math.sin(hopProgress * Math.PI) * BOARD_IMPACT_HOP_METERS * (1 - hopProgress * 0.35)
    : 0;
  const progress = clamp01((requestedTime - segment.from) / (segment.to - segment.from));

  return {
    state: boardPassState(segment, geometry, requestedTime),
    segmentType: segment.type,
    ownerId: null,
    fromPlayerId: segment.fromPlayerId,
    toPlayerId: segment.toPlayerId,
    position: point,
    worldPosition: [point.x, TACTICAL_BALL_RADIUS_METERS + hop, point.z],
    progress,
    impactTime: geometry.impactTime,
    impactProgress: geometry.impactProgress,
    boardPhase: inbound ? 'inbound' : hop > 0 ? 'impact' : 'outbound',
  };
}

function sampleCarry(scene, segment, sampledPlayers, requestedTime, segmentIndex) {
  const owner = sampledPlayers.find((player) => player.id === segment.ownerId);
  const livePoint = stickPocketWorld(owner);
  const previousSegment = scene.ball.segments[segmentIndex - 1];
  const settleProgress = clamp01(
    (requestedTime - segment.from) / BALL_CONTROL_SETTLE_SECONDS,
  );
  const point = previousSegment && settleProgress < 1
    ? linearPoint(
      segmentEndpoint(scene, previousSegment),
      livePoint,
      smoothstep(settleProgress),
    )
    : livePoint;
  return {
    state: segmentIndex === 0 ? 'carried' : 'controlled',
    segmentType: segment.type,
    ownerId: segment.ownerId,
    fromPlayerId: null,
    toPlayerId: null,
    position: point,
    worldPosition: [point.x, TACTICAL_BALL_RADIUS_METERS, point.z],
    progress: clamp01((requestedTime - segment.from) / Math.max(segment.to - segment.from, 0.001)),
    boardPhase: 'none',
  };
}

function uniquePathPoints(points) {
  return points.filter((point, index) => (
    index === 0 || distance2d(points[index - 1], point) > 0.015
  ));
}

function samplePath(points, progress) {
  const path = uniquePathPoints(points);
  if (path.length <= 1) return path[0];
  const lengths = path.slice(1).map((point, index) => distance2d(path[index], point));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (total < 0.001) return path.at(-1);
  const target = clamp01(progress) * total;
  let travelled = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const nextTravelled = travelled + lengths[index];
    if (target <= nextTravelled || index === lengths.length - 1) {
      return linearPoint(path[index], path[index + 1], (target - travelled) / Math.max(lengths[index], 0.001));
    }
    travelled = nextTravelled;
  }
  return path.at(-1);
}

function genericFlightGeometry(scene, segment) {
  const passer = segment.fromPlayerId
    ? scene.players.find((player) => player.id === segment.fromPlayerId)
    : null;
  const receiver = segment.toPlayerId
    ? scene.players.find((player) => player.id === segment.toPlayerId)
    : null;
  const releasePlayer = passer ? sampleOrientedPlayerTrack(scene, passer, segment.from) : null;
  const receivePlayer = receiver ? sampleOrientedPlayerTrack(scene, receiver, segment.to) : null;
  const start = releasePlayer ? stickPocketWorld(releasePlayer) : worldPoint(segment.start);
  const end = receivePlayer ? stickPocketWorld(receivePlayer) : worldPoint(segment.end);
  const duration = Math.max(segment.to - segment.from, 0.001);
  const path = segment.path?.length
    ? [start, ...segment.path.map(worldPoint), end]
    : null;
  const directVector = { x: end.x - start.x, z: end.z - start.z };
  return {
    start,
    end,
    path,
    startTangent: releasePlayer
      ? {
        x: releasePlayer.worldVelocity[0] * duration * 0.35 + directVector.x * 0.72,
        z: releasePlayer.worldVelocity[2] * duration * 0.35 + directVector.z * 0.72,
      }
      : directVector,
    endTangent: receivePlayer
      ? {
        x: receivePlayer.worldVelocity[0] * duration * 0.45 + directVector.x * 0.55,
        z: receivePlayer.worldVelocity[2] * duration * 0.45 + directVector.z * 0.55,
      }
      : directVector,
  };
}

function genericFlightState(segment, requestedTime) {
  if (segment.fromPlayerId && requestedTime <= segment.from + BALL_RELEASE_SECONDS) return 'release';
  if (segment.toPlayerId && requestedTime >= segment.to - BALL_RECEIVE_SECONDS) return 'receive';
  return segment.type === 'shot' ? 'shot-flight' : 'flight';
}

function sampleGenericFlight(scene, segment, requestedTime) {
  const geometry = genericFlightGeometry(scene, segment);
  const progress = clamp01((requestedTime - segment.from) / Math.max(segment.to - segment.from, 0.001));
  const point = geometry.path
    ? samplePath(geometry.path, progress)
    : hermitePoint(
      geometry.start,
      geometry.end,
      geometry.startTangent,
      geometry.endTangent,
      progress,
    );
  const arcHeight = segment.type === 'shot' ? 0.055 : segment.type === 'pass' ? 0.018 : 0.008;
  const hop = Math.sin(progress * Math.PI) * arcHeight;
  return {
    state: genericFlightState(segment, requestedTime),
    segmentType: segment.type,
    ownerId: null,
    fromPlayerId: segment.fromPlayerId ?? null,
    toPlayerId: segment.toPlayerId ?? null,
    position: point,
    worldPosition: [point.x, TACTICAL_BALL_RADIUS_METERS + hop, point.z],
    progress,
    boardPhase: 'none',
  };
}

function segmentEndpoint(scene, segment) {
  if (segment.type === 'carry') {
    const owner = scene.players.find((player) => player.id === segment.ownerId);
    return stickPocketWorld(sampleOrientedPlayerTrack(scene, owner, segment.to));
  }
  if (segment.type === 'board-pass') {
    return sampleBoardPass(scene, segment, segment.to).position;
  }
  return sampleGenericFlight(scene, segment, segment.to).position;
}

function activeBallSegment(scene, requestedTime) {
  const finalIndex = scene.ball.segments.length - 1;
  const segmentIndex = Math.max(0, scene.ball.segments.findIndex((segment, index) => (
    requestedTime >= segment.from
    && (index === finalIndex ? requestedTime <= segment.to : requestedTime < segment.to)
  )));
  return {
    segment: scene.ball.segments[segmentIndex] ?? scene.ball.segments.at(-1),
    segmentIndex,
  };
}

function sampleBall(scene, sampledPlayers, requestedTime) {
  const { segment, segmentIndex } = activeBallSegment(scene, requestedTime);
  let sampled;
  if (segment.type === 'board-pass') {
    sampled = sampleBoardPass(scene, segment, requestedTime);
  } else if (segment.type === 'carry') {
    sampled = sampleCarry(scene, segment, sampledPlayers, requestedTime, segmentIndex);
  } else {
    sampled = sampleGenericFlight(scene, segment, requestedTime);
  }

  const path = segment.type === 'board-pass'
    ? [segment.incoming, segment.impact, segment.exitTarget]
    : segment.path ?? [segment.start, segment.end];
  return {
    ...sampled,
    rinkPosition: worldPositionToRink(sampled.position),
    path: path.filter(Boolean),
  };
}

export function tacticalBallMotionStreakWidth(ball) {
  return ball.ownerId === null && ['board-pass', 'pass', 'shot', 'loose'].includes(ball.segmentType) ? 1 : 0;
}

export function sampleTacticalBallTrail(scene, requestedTime) {
  const time = clamp(requestedTime, 0, scene.duration);
  const { segment } = activeBallSegment(scene, time);
  if (segment.type === 'carry') return null;

  const sampler = segment.type === 'board-pass' ? sampleBoardPass : sampleGenericFlight;
  const end = sampler(scene, segment, time).worldPosition;
  const startTime = Math.max(segment.from, time - BALL_TRAIL_LOOKBACK_SECONDS);
  const start = sampler(scene, segment, startTime).worldPosition;
  const distance = Math.hypot(
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2],
  );
  if (distance < 0.015) return null;

  return { start, end, distance };
}

function goalieClip(player, ball) {
  if (player.speedMps > 0.04) return 'goalie-shuffle';
  const ballRinkY = (ball.worldPosition[2] / 48 + 0.5) * 100;
  const threatened = player.team === 'us' ? ballRinkY < 36 : ballRinkY > 64;
  return threatened ? 'goalie-set' : 'goalie-ready';
}

function fieldLocomotionClip(speedMps) {
  if (speedMps > FIELD_SPRINT_SPEED_THRESHOLD_MPS) return 'sprint';
  if (speedMps > FIELD_JOG_SPEED_THRESHOLD_MPS) return 'jog';
  return 'ready';
}

function playerAnimation(player, ball, ballSegments, requestedTime) {
  if (player.role === 'G') {
    const clipName = goalieClip(player, ball);
    return {
      clipName,
      clipPhase: (player.trackDistanceMeters / GOALIE_CYCLE_METERS) % 1,
    };
  }

  const passSegment = ballSegments.find((segment) => (
    ['board-pass', 'pass', 'shot'].includes(segment.type) && segment.fromPlayerId === player.id
  ));
  if (passSegment) {
    const start = passSegment.from - 0.16;
    const end = passSegment.from + 0.3;
    if (requestedTime >= start && requestedTime <= end) {
      return { clipName: 'pass', clipPhase: clamp01((requestedTime - start) / (end - start)) };
    }
  }

  const receiveSegment = ballSegments.find((segment) => (
    ['board-pass', 'pass', 'loose'].includes(segment.type) && segment.toPlayerId === player.id
  ));
  if (receiveSegment) {
    const start = receiveSegment.to - 0.32;
    const end = receiveSegment.to + 0.18;
    if (requestedTime >= start && requestedTime <= end) {
      return { clipName: 'receive', clipPhase: clamp01((requestedTime - start) / (end - start)) };
    }
  }

  const clipName = fieldLocomotionClip(player.speedMps);
  const cycleMeters = clipName === 'sprint' ? FIELD_SPRINT_CYCLE_METERS : FIELD_JOG_CYCLE_METERS;
  return {
    clipName,
    clipPhase: clipName === 'ready' ? (requestedTime * 0.35) % 1 : (player.trackDistanceMeters / cycleMeters) % 1,
  };
}

function pinPlayerInPenaltyBox(player) {
  const pose = productionPenaltyBoxPose(player);
  return {
    ...player,
    ...pose,
    authoredRotation: pose.worldRotation,
    movementRotation: pose.worldRotation,
    speedMps: 0,
    trackDistanceMeters: 0,
  };
}

export function sampleTacticalReplay(scene, requestedTime) {
  const time = clamp(requestedTime, 0, scene.duration);
  const playersWithTracks = scene.players.map((player) => {
    const sampled = {
      ...sampleOrientedPlayerTrack(scene, player, time),
      assetKey: productionAssetKey(player),
    };
    return isPenaltyBoxPlayer(player) ? pinPlayerInPenaltyBox(sampled) : sampled;
  });
  const ball = sampleBall(scene, playersWithTracks, time);
  const players = playersWithTracks.map((player) => {
    if (isPenaltyBoxPlayer(player)) {
      return {
        ...pinPlayerInPenaltyBox(player),
        clipName: 'ready',
        clipPhase: 0,
      };
    }
    const orientedPlayer = orientPlayerToLiveAction(player, ball);
    const animation = playerAnimation(orientedPlayer, ball, scene.ball.segments, time);
    return { ...orientedPlayer, ...animation };
  });

  return {
    engineId: TACTICAL_REPLAY_ENGINE_ID,
    time,
    event: activeEvent(scene.events, time),
    players,
    ball,
  };
}
