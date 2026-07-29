import { calculateBoardBounce } from './boardBounce';
import { rinkDistanceMeters } from './movementMetrics';

const ROLES = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];
const FIELD_ROLES = ROLES.filter((role) => role !== 'G');
const MIN_PLAY_DURATION_SECONDS = 8;
const MIN_PLAY_TRANSITION_SECONDS = 3.4;
const MIN_STRATEGY_BEAT_SECONDS = 3.25;
const FINAL_RESOLUTION_SECONDS = 2.8;
const TACTICAL_CRUISE_SPEED_MPS = 3.2;
const MOVEMENT_RAMP_SECONDS = 0.6;
const MIN_AUTHORED_PLAY_BEAT_SECONDS = 1.8;
const MIN_FACEOFF_SET_SECONDS = 1.1;
const MIN_FACEOFF_DRAW_SECONDS = 1.6;
const FACEOFF_CONTACT_SECONDS = 0.64;
const MAX_FIELD_ADJUSTMENT = 0.9;
const MAX_GOALIE_ADJUSTMENT = 0.7;

const HOME_UNIFORM = Object.freeze({
  jersey: '#f8fafc',
  stripe: '#1d4ed8',
  shorts: '#0f172a',
  helmet: '#f8fafc',
});

const OPPONENT_UNIFORM = Object.freeze({
  jersey: '#b91c1c',
  stripe: '#fee2e2',
  shorts: '#111827',
  helmet: '#dc2626',
});

const HOME_FALLBACKS = Object.freeze({
  LW: { x: 22, y: 43 },
  C: { x: 50, y: 40 },
  RW: { x: 78, y: 43 },
  LD: { x: 34, y: 24 },
  RD: { x: 66, y: 24 },
  G: { x: 50, y: 7 },
});

const OPPONENT_FALLBACKS = Object.freeze({
  LW: { x: 22, y: 57 },
  C: { x: 50, y: 60 },
  RW: { x: 78, y: 57 },
  LD: { x: 34, y: 76 },
  RD: { x: 66, y: 76 },
  G: { x: 50, y: 93 },
});

const CAMERA_PRESETS = Object.freeze([
  { id: 'broadcast', label: 'Broadcast', position: [0, 22, -28], target: [0, 0, -2.5] },
  { id: 'bench', label: 'Bench', position: [-13, 9, -8], target: [0, 0, 3] },
  { id: 'overhead', label: 'Overhead', position: [0, 26, 0.01], target: [0, 0, 0] },
  { id: 'player', label: 'Player', position: [-6, 4.2, -10], target: [-3, 0.8, -6] },
]);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const roundTime = (value) => Number(value.toFixed(3));

function position(value, fallback) {
  return {
    x: clamp(Number(value?.x ?? fallback.x), 0, 100),
    y: clamp(Number(value?.y ?? fallback.y), 0, 100),
  };
}

function distance(a, b) {
  return Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
}

function roleFromLabel(label) {
  const normalized = String(label ?? '').trim().toUpperCase();
  if (ROLES.includes(normalized)) return normalized;
  if (normalized === 'F1') return 'C';
  if (normalized === 'F2') return 'LW';
  if (normalized === 'F3') return 'RW';
  if (normalized === 'D1') return 'LD';
  if (normalized === 'D2') return 'RD';
  return null;
}

function opponentLabel(player) {
  return player?.l ?? player?.label ?? '';
}

function createOpponentRoleMap(phases) {
  const sourcePlayers = new Map();
  phases.forEach((phase) => {
    (phase.opponents ?? []).forEach((player) => {
      if (!sourcePlayers.has(player.id)) sourcePlayers.set(player.id, player);
    });
  });

  const roleToSourceId = new Map();
  const assignedIds = new Set();
  const goalie = [...sourcePlayers.values()].find((player) => (
    player.isGoalie || roleFromLabel(opponentLabel(player)) === 'G'
  ));
  if (goalie) {
    roleToSourceId.set('G', goalie.id);
    assignedIds.add(goalie.id);
  }

  for (const player of sourcePlayers.values()) {
    if (assignedIds.has(player.id)) continue;
    const role = roleFromLabel(opponentLabel(player));
    if (role && role !== 'G' && !roleToSourceId.has(role)) {
      roleToSourceId.set(role, player.id);
      assignedIds.add(player.id);
    }
  }

  const remainingIds = [...sourcePlayers.keys()].filter((id) => !assignedIds.has(id));
  FIELD_ROLES.forEach((role) => {
    if (roleToSourceId.has(role)) return;
    roleToSourceId.set(role, remainingIds.shift() ?? null);
  });
  if (!roleToSourceId.has('G')) roleToSourceId.set('G', null);

  return roleToSourceId;
}

function phaseOpponentForRole(phase, roleMap, role) {
  const roleMatch = phase.opponents.find((player) => (
    roleFromLabel(opponentLabel(player)) === role
  ));
  if (roleMatch) return roleMatch;
  const sourceId = roleMap.get(role);
  return sourceId ? phase.opponents.find((player) => player.id === sourceId) ?? null : null;
}

function sourceOpponentIdToRole(roleMap, sourceId) {
  for (const [role, id] of roleMap.entries()) {
    if (id === sourceId) return role;
  }
  return null;
}

function phaseOpponentIdToRole(phase, roleMap, sourceId) {
  const sourcePlayer = phase.opponents.find((player) => player.id === sourceId);
  return roleFromLabel(opponentLabel(sourcePlayer)) ?? sourceOpponentIdToRole(roleMap, sourceId);
}

function cloneHomePositions(home) {
  return Object.fromEntries(Object.entries(home).map(([role, value]) => [
    role,
    { ...value },
  ]));
}

function withOpponentOwner(opponents, ownerId) {
  return opponents.map((player) => ({
    ...player,
    hasBall: player.id === ownerId,
  }));
}

function penaltyKillBoxSequence(phase) {
  const shiftedHome = (xShift) => Object.fromEntries(
    Object.entries(cloneHomePositions(phase.home)).map(([role, player]) => {
      if (role === 'RW') return [role, player];
      const roleScale = role === 'G' ? 0.12 : 1;
      return [role, {
        ...player,
        x: clamp(player.x + xShift * roleScale, 2, 98),
        y: clamp(player.y + (role === 'G' ? 0 : 0.8), 2, 98),
      }];
    }),
  );
  return [
    {
      ...phase,
      title: 'Box Set Behind the Ball',
      description: 'Two high and two low establish the inside lanes before pressure arrives.',
      opponents: withOpponentOwner(phase.opponents, 'o1'),
      ball: { x: 30, y: 36 },
    },
    {
      ...phase,
      id: 'box-shift-left',
      title: 'Box Slides to the Left Wall',
      description: 'All four defenders shift together while the weak side stays connected.',
      home: shiftedHome(-5),
      opponents: withOpponentOwner(phase.opponents, 'o3'),
      ball: { x: 14, y: 30 },
    },
    {
      ...phase,
      id: 'box-shift-right',
      title: 'Box Recovers Across the Middle',
      description: 'The unit crosses together, protects the slot, and arrives before the next pass.',
      home: shiftedHome(5),
      opponents: withOpponentOwner(phase.opponents, 'o2'),
      ball: { x: 70, y: 36 },
    },
  ];
}

function penaltyKillClearSequence(phase) {
  const home = cloneHomePositions(phase.home);
  Object.values(home).forEach((player) => delete player.ball);
  home.LW = {
    ...home.LW,
    x: 9,
    y: 50,
    ball: true,
  };
  home.C = { ...home.C, x: 48, y: 43 };
  home.LD = { ...home.LD, x: 25, y: 17 };
  home.RD = { ...home.RD, x: 55, y: 18 };
  return [
    phase,
    {
      ...phase,
      id: 'clear-reaches-winger',
      title: 'Clear Reaches the Winger',
      description: 'LD sends it hard up the wall; the winger receives beyond pressure and exits.',
      home,
      opponents: phase.opponents.map((player) => ({
        ...player,
        x: clamp(player.x + (player.x < 40 ? -2 : 1), 2, 98),
        y: clamp(player.y + 4, 2, 98),
      })),
      ball: { x: 9, y: 50 },
      ballPath: [
        phase.ball,
        { x: 4, y: 18 },
        { x: 5, y: 34 },
        { x: 9, y: 50 },
      ],
    },
  ];
}

function normalizePlayPhases(play) {
  const phases = play.phases.map((phase) => ({
    id: phase.id,
    title: phase.t,
    description: phase.desc,
    home: phase.pos,
    opponents: phase.opp ?? [],
    ball: phase.ball,
    ballPath: phase.ballPath ?? null,
    arrows: [],
    duration: phase.duration ?? null,
    ballOwner: phase.ballOwner ?? null,
    hasExplicitBallOwner: Object.hasOwn(phase, 'ballOwner'),
    faceoffState: phase.faceoffState ?? null,
    source: phase,
  }));
  if (play.id === 'pkb' && phases.length === 1) return penaltyKillBoxSequence(phases[0]);
  if (play.id === 'pkcl' && phases.length === 1) return penaltyKillClearSequence(phases[0]);
  return phases;
}

function normalizeStrategyPhases(tactic, variant) {
  const sourceScene = variant === 'mistake' ? tactic.mistakeScene : tactic.correctScene;
  return sourceScene.phases.map((phase, index) => ({
    id: index,
    title: phase.caption,
    description: phase.caption,
    home: phase.our,
    opponents: phase.opp ?? [],
    ball: phase.ball,
    ballPath: null,
    arrows: phase.arrows ?? [],
    duration: phase.duration,
    source: phase,
  }));
}

function maximumTransitionDistance(previous, next) {
  let maximum = rinkDistanceMeters(previous.ball, next.ball);
  ROLES.forEach((role) => {
    const before = previous.home?.[role];
    const after = next.home?.[role];
    if (before && after) maximum = Math.max(maximum, rinkDistanceMeters(before, after));
  });

  const previousOpponents = new Map(previous.opponents.map((player) => [player.id, player]));
  next.opponents.forEach((player) => {
    const before = previousOpponents.get(player.id);
    if (before) maximum = Math.max(maximum, rinkDistanceMeters(before, player));
  });
  return maximum;
}

function maximumPlayerTransitionDistance(previous, next) {
  let maximum = 0;
  ROLES.forEach((role) => {
    const before = previous.home?.[role];
    const after = next.home?.[role];
    if (before && after) maximum = Math.max(maximum, rinkDistanceMeters(before, after));
  });

  const previousOpponents = new Map(previous.opponents.map((player) => [player.id, player]));
  next.opponents.forEach((player) => {
    const before = previousOpponents.get(player.id);
    if (before) maximum = Math.max(maximum, rinkDistanceMeters(before, player));
  });
  return maximum;
}

function minimumPlayBeatSeconds(phase) {
  if (phase.faceoffState === 'set') return MIN_FACEOFF_SET_SECONDS;
  if (phase.faceoffState === 'draw') return MIN_FACEOFF_DRAW_SECONDS;
  return MIN_AUTHORED_PLAY_BEAT_SECONDS;
}

function movementSafeSeconds(previous, next) {
  return maximumPlayerTransitionDistance(previous, next) / TACTICAL_CRUISE_SPEED_MPS
    + MOVEMENT_RAMP_SECONDS;
}

function playTiming(phases) {
  if (phases.length <= 1) return { phaseTimes: [0], duration: MIN_PLAY_DURATION_SECONDS };
  const phaseTimes = [0];
  for (let index = 1; index < phases.length; index += 1) {
    const authoredSeconds = Number(phases[index - 1].duration);
    const previous = phases[index - 1];
    const next = phases[index];
    const minimumBeat = minimumPlayBeatSeconds(previous);
    const authoredOrDefault = Number.isFinite(authoredSeconds) && authoredSeconds > 0
      ? authoredSeconds
      : MIN_PLAY_TRANSITION_SECONDS;
    const runSeconds = clamp(
      Math.max(authoredOrDefault, movementSafeSeconds(previous, next), minimumBeat),
      minimumBeat,
      7.5,
    );
    phaseTimes.push(roundTime(phaseTimes.at(-1) + runSeconds));
  }
  const authoredFinalSeconds = Number(phases.at(-1)?.duration);
  const finalResolutionSeconds = Number.isFinite(authoredFinalSeconds) && authoredFinalSeconds > 0
    ? clamp(Math.max(authoredFinalSeconds, FINAL_RESOLUTION_SECONDS), FINAL_RESOLUTION_SECONDS, 6)
    : FINAL_RESOLUTION_SECONDS;
  return {
    phaseTimes,
    duration: roundTime(Math.max(
      phaseTimes.at(-1) + finalResolutionSeconds,
      MIN_PLAY_DURATION_SECONDS,
    )),
  };
}

function strategyTiming(phases) {
  const phaseTimes = [0];
  for (let index = 1; index < phases.length; index += 1) {
    const authoredSeconds = Number(phases[index - 1].duration) || MIN_STRATEGY_BEAT_SECONDS;
    const movementSeconds = Math.max(
      maximumTransitionDistance(phases[index - 1], phases[index]) / 3.2 + 0.75,
      movementSafeSeconds(phases[index - 1], phases[index]),
    );
    const beatSeconds = clamp(
      Math.max(authoredSeconds, movementSeconds, MIN_STRATEGY_BEAT_SECONDS),
      MIN_STRATEGY_BEAT_SECONDS,
      6,
    );
    phaseTimes.push(roundTime(phaseTimes.at(-1) + beatSeconds));
  }
  const finalBeatSeconds = clamp(
    Number(phases.at(-1)?.duration) || MIN_STRATEGY_BEAT_SECONDS,
    MIN_STRATEGY_BEAT_SECONDS,
    6,
  );
  return {
    phaseTimes,
    duration: roundTime(Math.max(
      phaseTimes.at(-1) + finalBeatSeconds,
      MIN_PLAY_DURATION_SECONDS,
    )),
  };
}

function headingBetween(from, to, fallback = 0) {
  const dx = (to?.x ?? from?.x ?? 0) - (from?.x ?? 0);
  const dy = (to?.y ?? from?.y ?? 0) - (from?.y ?? 0);
  if (Math.hypot(dx, dy) < 0.05) return fallback;
  return Math.atan2(dx, dy);
}

function facingForTrack(positions, ballPositions, index, role, team) {
  const current = positions[index];
  const next = positions[index + 1];
  const previous = positions[index - 1];
  const movementTarget = next && distance(current, next) >= 0.2
    ? next
    : previous && distance(previous, current) >= 0.2
      ? current
      : null;
  const movementOrigin = movementTarget === current ? previous : current;
  const tacticalTarget = ballPositions[index] ?? ballPositions.at(-1) ?? current;
  const defaultFacing = team === 'us' ? 0 : Math.PI;
  if (role === 'G' || !movementTarget) return headingBetween(current, tacticalTarget, defaultFacing);
  return headingBetween(movementOrigin, movementTarget, defaultFacing);
}

function finalMotionTarget({ team, role, positions, finalBall, index }) {
  const current = positions.at(-1);
  const previous = positions.at(-2);
  if (role === 'G') {
    const requestedShift = clamp(
      (finalBall.x - current.x) * 0.12,
      -MAX_GOALIE_ADJUSTMENT,
      MAX_GOALIE_ADJUSTMENT,
    );
    const trackingShift = Math.abs(requestedShift) >= 0.15
      ? requestedShift
      : (team === 'us' ? 0.32 : -0.32);
    return position({
      x: current.x + trackingShift,
      y: current.y,
    }, current);
  }

  let dx = previous ? current.x - previous.x : finalBall.x - current.x;
  let dy = previous ? current.y - previous.y : finalBall.y - current.y;
  let magnitude = Math.hypot(dx, dy);
  if (magnitude < 0.15) {
    dx = finalBall.x - current.x;
    dy = finalBall.y - current.y;
    magnitude = Math.hypot(dx, dy);
  }
  if (magnitude < 0.15) {
    dx = ((index % 3) - 1) * 0.35;
    dy = team === 'us' ? 1 : -1;
    magnitude = Math.hypot(dx, dy);
  }
  return position({
    x: current.x + dx / magnitude * MAX_FIELD_ADJUSTMENT,
    y: current.y + dy / magnitude * MAX_FIELD_ADJUSTMENT,
  }, current);
}

function createTrack({ team, role, positions, ballPositions, phaseTimes, duration, index }) {
  const frames = phaseTimes.map((time, frameIndex) => ({
    time,
    position: positions[frameIndex],
    facing: facingForTrack(positions, ballPositions, frameIndex, role, team),
  }));
  const finalPosition = positions.at(-1);
  const finalBall = ballPositions.at(-1) ?? finalPosition;
  const lastTime = phaseTimes.at(-1) ?? 0;
  const finalTarget = finalMotionTarget({ team, role, positions, finalBall, index });
  const finalFacing = headingBetween(
    finalPosition,
    finalTarget,
    facingForTrack(positions, ballPositions, positions.length - 1, role, team),
  );
  frames.push({
    time: roundTime(lastTime + (duration - lastTime) * 0.48),
    position: {
      x: (finalPosition.x + finalTarget.x) / 2,
      y: (finalPosition.y + finalTarget.y) / 2,
    },
    facing: role === 'G' ? headingBetween(finalPosition, finalBall, finalFacing) : finalFacing,
  });
  frames.push({
    time: duration,
    position: finalTarget,
    facing: role === 'G' ? headingBetween(finalTarget, finalBall, finalFacing) : finalFacing,
  });
  return frames;
}

function createPlayers(phases, roleMap, phaseTimes, duration) {
  const ballPositions = phases.map((phase) => position(
    resolvedPhaseBall(phase),
    { x: 50, y: 50 },
  ));
  const homePlayers = ROLES.map((role, index) => {
    const positions = phases.map((phase) => position(phase.home?.[role], HOME_FALLBACKS[role]));
    const sourcePlayer = phases.find((phase) => phase.home?.[role])?.home?.[role];
    const inactive = Boolean(sourcePlayer?.inactive);
    return {
      id: `US_${role}`,
      label: inactive ? 'PEN' : role,
      role,
      team: 'us',
      active: !inactive,
      status: sourcePlayer?.status ?? 'active',
      uniform: HOME_UNIFORM,
      keyframes: createTrack({
        team: 'us', role, positions, ballPositions, phaseTimes, duration, index,
      }),
    };
  });

  const opponentPlayers = ROLES.map((role, index) => {
    const positions = phases.map((phase) => {
      const source = phaseOpponentForRole(phase, roleMap, role);
      const fallback = roleMap.get(role)
        ? OPPONENT_FALLBACKS[role]
        : { x: 97, y: 43 + index * 2.5 };
      return position(source, fallback);
    });
    const sourcePlayer = phases
      .map((phase) => phaseOpponentForRole(phase, roleMap, role))
      .find(Boolean);
    const inactive = Boolean(sourcePlayer?.inactive);
    return {
      id: `OP_${role}`,
      label: inactive ? 'PEN' : role,
      role,
      team: 'opponent',
      active: !inactive,
      status: sourcePlayer?.status ?? 'active',
      uniform: OPPONENT_UNIFORM,
      keyframes: createTrack({
        team: 'opponent', role, positions, ballPositions, phaseTimes, duration, index: index + 6,
      }),
    };
  });

  return [...homePlayers, ...opponentPlayers];
}

function generatedPlayerPositions(phases, roleMap, phaseIndex) {
  const phase = phases[phaseIndex];
  return [
    ...ROLES.map((role) => ({
      id: `US_${role}`,
      role,
      position: position(phase.home?.[role], HOME_FALLBACKS[role]),
    })),
    ...ROLES.map((role, index) => ({
      id: `OP_${role}`,
      role,
      position: position(
        phaseOpponentForRole(phase, roleMap, role),
        roleMap.get(role) ? OPPONENT_FALLBACKS[role] : { x: 97, y: 43 + index * 2.5 },
      ),
    })),
  ];
}

function phaseEndsWithShot(phase) {
  return phase.arrows.some((arrow) => arrow.type === 'shot');
}

function resolvedPhaseBall(phase) {
  const finalShot = phase.arrows.filter((arrow) => arrow.type === 'shot').at(-1);
  return finalShot ? position(finalShot.to, phase.ball) : phase.ball;
}

function ownerForPhase(phases, roleMap, phaseIndex) {
  const phase = phases[phaseIndex];
  if (phaseEndsWithShot(phase)) return null;

  if (phase.hasExplicitBallOwner) {
    if (!phase.ballOwner) return null;
    if (/^(US|OP)_(LW|C|RW|LD|RD|G)$/.test(phase.ballOwner)) return phase.ballOwner;
    if (ROLES.includes(phase.ballOwner)) return `US_${phase.ballOwner}`;
    const opponentRole = phaseOpponentIdToRole(phase, roleMap, phase.ballOwner);
    return opponentRole ? `OP_${opponentRole}` : null;
  }

  const explicitHomeRole = ROLES.find((role) => phase.home?.[role]?.ball);
  if (explicitHomeRole) return `US_${explicitHomeRole}`;

  const explicitOpponent = phase.opponents.find((player) => player.hasBall || player.ball);
  if (explicitOpponent) {
    const role = phaseOpponentIdToRole(phase, roleMap, explicitOpponent.id);
    if (role) return `OP_${role}`;
  }

  if (phase.ball?.y <= 9 || phase.ball?.y >= 91) return null;
  const candidates = generatedPlayerPositions(phases, roleMap, phaseIndex)
    .filter((player) => player.role !== 'G')
    .map((player) => ({ ...player, ballDistance: distance(player.position, phase.ball) }))
    .sort((a, b) => a.ballDistance - b.ballDistance);
  return candidates[0]?.ballDistance <= 13 ? candidates[0].id : null;
}

function authoredPathForTransition(nextPhase) {
  if (!Array.isArray(nextPhase?.ballPath) || nextPhase.ballPath.length < 2) return null;
  return nextPhase.ballPath.map((point) => position(point, nextPhase.ball));
}

function nearestFieldPlayerId(phases, roleMap, phaseIndex, target, excludedId = null) {
  const candidates = generatedPlayerPositions(phases, roleMap, phaseIndex)
    .filter((player) => player.role !== 'G' && player.id !== excludedId)
    .map((player) => ({ ...player, targetDistance: distance(player.position, target) }))
    .sort((a, b) => a.targetDistance - b.targetDistance);
  return candidates[0]?.targetDistance <= 16 ? candidates[0].id : null;
}

function authoredArrowActions(phases, roleMap, nextPhaseIndex, fromOwner, toOwner) {
  const current = phases[nextPhaseIndex - 1];
  const next = phases[nextPhaseIndex];
  const arrows = next.arrows.filter((arrow) => ['pass', 'shot'].includes(arrow.type));
  if (arrows.length === 0) return null;

  let actionOwner = fromOwner;
  const actions = arrows.map((arrow, arrowIndex) => {
    const finalAction = arrowIndex === arrows.length - 1;
    const start = position(arrow.from, current.ball);
    const end = position(
      finalAction && arrow.type !== 'shot' ? next.ball : arrow.to,
      resolvedPhaseBall(next),
    );
    const fromPlayerId = actionOwner
      ?? nearestFieldPlayerId(phases, roleMap, Math.max(0, nextPhaseIndex - 1), start);
    let toPlayerId = null;
    if (arrow.type === 'pass') {
      toPlayerId = finalAction && toOwner
        ? toOwner
        : nearestFieldPlayerId(phases, roleMap, nextPhaseIndex, end, fromPlayerId);
    }
    actionOwner = toPlayerId;
    return {
      type: arrow.type,
      start,
      end,
      fromPlayerId,
      toPlayerId,
    };
  });

  const valid = actions.every((action) => (
    action.fromPlayerId
    && (action.type !== 'pass' || action.toPlayerId)
  ));
  return valid ? actions : null;
}

function realisticBoardSegment(baseSegment, path) {
  if (!baseSegment.fromPlayerId || !baseSegment.toPlayerId || !path) return null;
  const impact = path.find((point) => point.x <= 5 || point.x >= 95 || point.y <= 5 || point.y >= 95);
  if (!impact) return null;
  const candidate = {
    ...baseSegment,
    type: 'board-pass',
    incoming: path[0],
    impact,
    exitTarget: path.at(-1),
    restitution: 0.68,
  };
  return calculateBoardBounce(candidate).validPhysics ? candidate : null;
}

function createFlightSegment({
  from,
  to,
  fromOwner,
  toOwner,
  start,
  end,
  path,
  shot,
  type = null,
  faceoffState = null,
}) {
  const segment = {
    type: type ?? (shot ? 'shot' : fromOwner && toOwner ? 'pass' : 'loose'),
    from,
    to,
    start,
    end,
  };
  if (fromOwner) segment.fromPlayerId = fromOwner;
  if (toOwner) segment.toPlayerId = toOwner;
  if (path) segment.path = path;
  if (faceoffState) segment.faceoffState = faceoffState;
  return realisticBoardSegment(segment, path) ?? segment;
}

function appendAuthoredArrowTimeline({
  actions,
  add,
  current,
  from,
  fromOwner,
  to,
}) {
  if (!actions) return false;
  const span = to - from;
  const preActionSeconds = fromOwner ? clamp(span * 0.22, 0.5, 1.1) : 0;
  const flightWeights = actions.map((action) => clamp(
    rinkDistanceMeters(action.start, action.end) / 13,
    0.55,
    1.5,
  ));
  const controlWeights = actions.slice(0, -1).map((action) => (
    action.toPlayerId ? 0.38 : 0
  ));
  const weightTotal = flightWeights.reduce((sum, weight) => sum + weight, 0)
    + controlWeights.reduce((sum, weight) => sum + weight, 0);
  const actionSeconds = Math.max(span - preActionSeconds, 0.8);
  const secondsPerWeight = actionSeconds / Math.max(weightTotal, 0.001);
  let cursor = from;

  if (preActionSeconds > 0) {
    cursor = roundTime(from + preActionSeconds);
    add({
      type: 'carry',
      from,
      to: cursor,
      ownerId: fromOwner,
      start: resolvedPhaseBall(current),
      end: actions[0].start,
    });
  }

  actions.forEach((action, index) => {
    const finalAction = index === actions.length - 1;
    const flightEnd = finalAction && controlWeights[index] === undefined
      ? to
      : roundTime(cursor + flightWeights[index] * secondsPerWeight);
    add(createFlightSegment({
      from: cursor,
      to: flightEnd,
      fromOwner: action.fromPlayerId,
      toOwner: action.toPlayerId,
      start: action.start,
      end: action.end,
      path: null,
      shot: action.type === 'shot',
    }));
    cursor = flightEnd;

    const controlWeight = controlWeights[index] ?? 0;
    if (!finalAction && controlWeight > 0) {
      const controlEnd = roundTime(cursor + controlWeight * secondsPerWeight);
      add({
        type: 'carry',
        from: cursor,
        to: controlEnd,
        ownerId: action.toPlayerId,
        start: action.end,
        end: actions[index + 1].start,
      });
      cursor = controlEnd;
    }
  });
  return true;
}

function createBallTimeline(phases, roleMap, phaseTimes, duration) {
  const owners = phases.map((_, index) => ownerForPhase(phases, roleMap, index));
  const segments = [];

  const add = (segment) => {
    const from = segments.length ? segments.at(-1).to : segment.from;
    if (segment.to - from < 0.02) return;
    segments.push({ ...segment, from, to: roundTime(segment.to) });
  };

  for (let index = 0; index < phases.length - 1; index += 1) {
    const current = phases[index];
    const next = phases[index + 1];
    const from = phaseTimes[index];
    const to = phaseTimes[index + 1];
    const fromOwner = owners[index];
    const toOwner = owners[index + 1];

    if (current.faceoffState === 'draw') {
      const contactEnd = roundTime(Math.min(to, from + FACEOFF_CONTACT_SECONDS));
      add(createFlightSegment({
        type: 'faceoff',
        from,
        to: contactEnd,
        fromOwner: null,
        toOwner,
        start: resolvedPhaseBall(current),
        end: resolvedPhaseBall(next),
        path: authoredPathForTransition(next),
        shot: false,
        faceoffState: 'draw',
      }));
      if (toOwner && to - contactEnd >= 0.02) {
        add({
          type: 'carry',
          from: contactEnd,
          to,
          ownerId: toOwner,
          start: resolvedPhaseBall(next),
          end: resolvedPhaseBall(next),
          faceoffState: 'secured',
        });
      }
      continue;
    }

    const authoredActions = authoredArrowActions(
      phases,
      roleMap,
      index + 1,
      fromOwner,
      toOwner,
    );
    if (appendAuthoredArrowTimeline({
      actions: authoredActions,
      add,
      current,
      from,
      fromOwner,
      to,
    })) continue;

    if (fromOwner && fromOwner === toOwner) {
      add({
        type: 'carry',
        from,
        to,
        ownerId: fromOwner,
        start: resolvedPhaseBall(current),
        end: resolvedPhaseBall(next),
        faceoffState: current.faceoffState,
      });
      continue;
    }

    const ballDistance = rinkDistanceMeters(current.ball, next.ball);
    const flightDuration = clamp(ballDistance / 13, 0.6, Math.max(0.65, (to - from) * 0.58));
    const flightStart = fromOwner ? roundTime(to - flightDuration) : from;
    if (fromOwner && flightStart > from + 0.02) {
      add({
        type: 'carry',
        from,
        to: flightStart,
        ownerId: fromOwner,
        start: resolvedPhaseBall(current),
        end: resolvedPhaseBall(current),
      });
    }
    add(createFlightSegment({
      from: flightStart,
      to,
      fromOwner,
      toOwner,
      start: resolvedPhaseBall(current),
      end: resolvedPhaseBall(next),
      path: authoredPathForTransition(next),
      shot: !toOwner && (phaseEndsWithShot(next) || next.ball.y <= 9 || next.ball.y >= 91),
      faceoffState: current.faceoffState,
    }));
  }

  const finalIndex = phases.length - 1;
  const finalFrom = phaseTimes[finalIndex] ?? 0;
  const finalOwner = owners[finalIndex];
  const finalBall = resolvedPhaseBall(phases[finalIndex]);
  if (finalOwner) {
    add({
      type: 'carry',
      from: finalFrom,
      to: duration,
      ownerId: finalOwner,
      start: finalBall,
      end: finalBall,
      faceoffState: phases[finalIndex].faceoffState,
    });
  } else {
    add({
      type: 'loose',
      from: finalFrom,
      to: duration,
      start: finalBall,
      end: finalBall,
      faceoffState: phases[finalIndex].faceoffState,
    });
  }

  return segments;
}

function concise(text, fallback) {
  const value = String(text ?? fallback ?? '').trim();
  if (value.length <= 105) return value;
  return `${value.slice(0, 102).trimEnd()}...`;
}

function playResponsibilities(play) {
  const phase = play.faceoff?.outcome === 'lost' ? play.phases[2] : play.phases[0];
  const actionFor = (roles, fallback) => {
    const entries = roles.map((role) => phase.pos?.[role]).filter(Boolean);
    const priority = entries.find((entry) => entry.ball || entry.key) ?? entries[0];
    return concise(priority?.role, fallback);
  };
  return [
    { role: 'Winger', action: actionFor(['LW', 'RW'], 'Create width and stay available on the wall.') },
    { role: 'Center', action: actionFor(['C'], 'Support through the middle and stay underneath the ball.') },
    { role: 'Defense', action: actionFor(['LD', 'RD'], 'Keep support behind the play and move the ball quickly.') },
  ];
}

function strategyResponsibilities(tactic) {
  return [
    { role: 'Winger', action: concise(tactic.keyPoints[0], tactic.principle) },
    { role: 'Center', action: concise(tactic.keyPoints[1], tactic.principle) },
    { role: 'Defense', action: concise(tactic.keyPoints[2], tactic.principle) },
  ];
}

function strategyMatchups(tactic, variant, roleMap) {
  const sourceScene = variant === 'mistake' ? tactic.mistakeScene : tactic.correctScene;
  return Object.entries(sourceScene.coverage ?? {}).map(([homeRole, sourceOpponentId]) => {
    const opponentRole = sourceOpponentIdToRole(roleMap, sourceOpponentId);
    if (!FIELD_ROLES.includes(homeRole) || !opponentRole) return null;
    return {
      homePlayerId: `US_${homeRole}`,
      opponentPlayerId: `OP_${opponentRole}`,
      source: 'authored',
    };
  }).filter(Boolean);
}

function baseScene({ id, kind, title, duration, phaseTimes, players, ball, presentation, teachingPoints, events }) {
  return {
    schemaVersion: 1,
    generatedFrom2d: true,
    id,
    kind,
    title,
    duration,
    sourcePhaseTimes: phaseTimes,
    rink: {
      orientation: 'vertical',
      ourNet: 'bottom',
      theirNet: 'top',
      ourNetY: 6,
      theirNetY: 94,
    },
    presentation: {
      captionsPlacement: 'below-rink',
      coachingOverlaysDefault: false,
      audio: false,
      ...presentation,
    },
    teachingPoints,
    cameraPresets: CAMERA_PRESETS,
    players,
    ball: { radius: 0.13, segments: ball },
    events,
  };
}

export function compilePlayThreeDScene(play) {
  const phases = normalizePlayPhases(play);
  const timing = playTiming(phases);
  const roleMap = createOpponentRoleMap(phases);
  return {
    ...baseScene({
      id: `${play.id}-generated-3d`,
      kind: 'play',
      title: play.n,
      duration: timing.duration,
      phaseTimes: timing.phaseTimes,
      players: createPlayers(phases, roleMap, timing.phaseTimes, timing.duration),
      ball: createBallTimeline(phases, roleMap, timing.phaseTimes, timing.duration),
      presentation: {
        purpose: play.desc,
        responsibilities: playResponsibilities(play),
        faceoff: play.faceoff ?? null,
      },
      teachingPoints: phases.map((phase) => phase.description),
      events: phases.map((phase, index) => ({
        time: timing.phaseTimes[index],
        label: phase.title,
        nextRead: phase.description,
      })),
    }),
    sourcePlayId: play.id,
  };
}

export function compileStrategyThreeDScene(tactic, requestedVariant = 'correct') {
  const variant = requestedVariant === 'mistake' ? 'mistake' : 'correct';
  const phases = normalizeStrategyPhases(tactic, variant);
  const timing = strategyTiming(phases);
  const roleMap = createOpponentRoleMap(phases);
  const variantLabel = variant === 'mistake' ? 'The Mistake' : 'The Right Way';
  return {
    ...baseScene({
      id: `${tactic.id}-${variant}-generated-3d`,
      kind: 'strategy',
      title: `${tactic.title}: ${variantLabel}`,
      duration: timing.duration,
      phaseTimes: timing.phaseTimes,
      players: createPlayers(phases, roleMap, timing.phaseTimes, timing.duration),
      ball: createBallTimeline(phases, roleMap, timing.phaseTimes, timing.duration),
      presentation: {
        purpose: tactic.principle,
        responsibilities: strategyResponsibilities(tactic),
        matchups: strategyMatchups(tactic, variant, roleMap),
        variant,
      },
      teachingPoints: tactic.keyPoints,
      events: phases.map((phase, index) => ({
        time: timing.phaseTimes[index],
        label: phase.title,
        nextRead: phases[index + 1]?.title ?? tactic.principle,
      })),
    }),
    sourceTacticId: tactic.id,
    strategyVariant: variant,
  };
}
