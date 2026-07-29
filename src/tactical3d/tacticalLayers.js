import { rinkPositionToWorld } from '../vnext3d/runtimeMapping';
import { coverageGapColor } from '../play-engine/movementMetrics';
import { sampleTacticalReplay } from './sampleTacticalReplay';

export const TACTICAL_LAYER_DEFAULTS = Object.freeze({
  matchups: false,
  routes: false,
  passing: false,
  targets: false,
});

export const TACTICAL_LAYER_KEYS = Object.freeze(Object.keys(TACTICAL_LAYER_DEFAULTS));

export const ROLE_LAYER_COLORS = Object.freeze({
  LW: '#4fd6ff',
  RW: '#4fd6ff',
  C: '#bda2ff',
  LD: '#5ce6a4',
  RD: '#5ce6a4',
  G: '#f4f7fb',
});

function validMatchup(replay, matchup) {
  const home = replay.players.find((player) => player.id === matchup.homePlayerId);
  const opponent = replay.players.find((player) => player.id === matchup.opponentPlayerId);
  return home?.team === 'us' && opponent?.team === 'opponent' && home.role !== 'G';
}

function authoredMatchupsAtTime(replay, requestedTime) {
  const phases = replay.presentation?.matchupPhases ?? [];
  const activePhase = [...phases].reverse().find((phase) => (
    phase.time <= requestedTime + 0.001
  ));
  return activePhase?.matchups ?? replay.presentation?.matchups ?? [];
}

export function tacticalMatchupsForReplay(replay, requestedTime = 0) {
  return authoredMatchupsAtTime(replay, requestedTime)
    .filter((matchup) => validMatchup(replay, matchup));
}

export function matchupGapColor(distanceMeters) {
  return coverageGapColor(distanceMeters);
}

export function tacticalRoutePoints(player) {
  const points = player.keyframes.map(({ position }) => {
    const world = rinkPositionToWorld(position);
    return [world.x, 0.034, world.z];
  });
  return points.filter((point, index) => (
    index === 0 || Math.hypot(
      point[0] - points[index - 1][0],
      point[2] - points[index - 1][2],
    ) > 0.04
  ));
}

export function nextTacticalTarget(player, requestedTime) {
  const target = player.keyframes.find((keyframe) => keyframe.time > requestedTime + 0.18)
    ?? player.keyframes.at(-1);
  const world = rinkPositionToWorld(target.position);
  return {
    playerId: player.id,
    role: player.role,
    time: target.time,
    worldPosition: [world.x, 0.028, world.z],
  };
}

function ballLayerSegment(replay, requestedTime) {
  return replay.ball.segments.find((segment) => (
    segment.type !== 'carry'
    && segment.to >= requestedTime
    && segment.from <= requestedTime + 4
  )) ?? null;
}

function groundedBallPosition(replay, requestedTime) {
  const position = sampleTacticalReplay(replay, requestedTime).ball.worldPosition;
  return [position[0], 0.045, position[2]];
}

export function upcomingBallLayer(replay, requestedTime) {
  const segment = ballLayerSegment(replay, requestedTime);
  if (!segment) return null;

  const epsilon = Math.min(0.01, Math.max((segment.to - segment.from) * 0.02, 0.001));
  const points = [groundedBallPosition(replay, Math.min(segment.to, segment.from + epsilon))];
  if (segment.type === 'board-pass' && segment.impact) {
    const impact = rinkPositionToWorld(segment.impact);
    points.push([impact.x, 0.045, impact.z]);
  } else if (Array.isArray(segment.path)) {
    segment.path.forEach((point) => {
      const world = rinkPositionToWorld(point);
      points.push([world.x, 0.045, world.z]);
    });
  }
  points.push(groundedBallPosition(replay, Math.max(segment.from, segment.to - epsilon)));

  return {
    type: segment.type,
    from: segment.from,
    to: segment.to,
    points,
    target: points.at(-1),
  };
}
