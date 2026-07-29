import { rinkPositionToWorld } from '../vnext3d/runtimeMapping';
import { sampleTacticalReplay } from './sampleTacticalReplay';

const FIELD_ROLES = ['LW', 'C', 'RW', 'LD', 'RD'];
const DEFAULT_OPPONENT_ROLE = Object.freeze({
  LW: 'RD',
  C: 'C',
  RW: 'LD',
  LD: 'RW',
  RD: 'LW',
});

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

function playerByRole(replay, team, role) {
  return replay.players.find((player) => player.team === team && player.role === role);
}

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
  const authored = authoredMatchupsAtTime(replay, requestedTime)
    .filter((matchup) => validMatchup(replay, matchup));
  const authoredByHomePlayer = new Map(
    (authored ?? []).map((matchup) => [matchup.homePlayerId, matchup]),
  );

  return FIELD_ROLES.map((role) => {
    const home = playerByRole(replay, 'us', role);
    if (home && authoredByHomePlayer.has(home.id)) return authoredByHomePlayer.get(home.id);
    const opponent = playerByRole(replay, 'opponent', DEFAULT_OPPONENT_ROLE[role]);
    if (!home || !opponent) return null;
    return {
      homePlayerId: home.id,
      opponentPlayerId: opponent.id,
      source: 'role-fallback',
    };
  }).filter(Boolean);
}

export function matchupGapColor(distanceMeters) {
  if (distanceMeters <= 4.5) return '#42df91';
  if (distanceMeters <= 7) return '#f5bc58';
  return '#ff6468';
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
