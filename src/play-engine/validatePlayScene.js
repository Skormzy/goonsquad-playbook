import { calculateBoardBounce } from './boardBounce';

export const PLAY_SCENE_SCHEMA_VERSION = 1;
export const PLAY_SCENE_TEAMS = ['us', 'opponent'];
export const PLAY_SCENE_ROLES = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];

function movementThresholds(role, generatedFrom2d = false) {
  if (generatedFrom2d) {
    return role === 'G'
      ? { minKeyframes: 3, minTotalDistance: 0.25, minMaxDisplacement: 0.15 }
      : { minKeyframes: 3, minTotalDistance: 0.5, minMaxDisplacement: 0.3 };
  }
  return role === 'G'
    ? { minKeyframes: 3, minTotalDistance: 1.5, minMaxDisplacement: 0.85 }
    : { minKeyframes: 3, minTotalDistance: 6, minMaxDisplacement: 4 };
}

function movementReport(player, generatedFrom2d = false) {
  const keyframes = player.keyframes ?? [];
  const thresholds = movementThresholds(player.role, generatedFrom2d);
  if (keyframes.length < 2) {
    return {
      id: player.id,
      keyframeCount: keyframes.length,
      totalDistance: 0,
      maxDisplacement: 0,
      moving: false,
      thresholds,
    };
  }

  const first = keyframes[0].position;
  let totalDistance = 0;
  let maxDisplacement = 0;

  for (let i = 1; i < keyframes.length; i += 1) {
    const previous = keyframes[i - 1].position;
    const current = keyframes[i].position;
    totalDistance += Math.hypot(current.x - previous.x, current.y - previous.y);
    maxDisplacement = Math.max(
      maxDisplacement,
      Math.hypot(current.x - first.x, current.y - first.y),
    );
  }

  return {
    id: player.id,
    keyframeCount: keyframes.length,
    totalDistance: Number(totalDistance.toFixed(2)),
    maxDisplacement: Number(maxDisplacement.toFixed(2)),
    moving: keyframes.length >= thresholds.minKeyframes
      && totalDistance >= thresholds.minTotalDistance
      && maxDisplacement >= thresholds.minMaxDisplacement,
    thresholds,
  };
}

function isRinkPosition(position) {
  return Number.isFinite(position?.x)
    && Number.isFinite(position?.y)
    && position.x >= 0
    && position.x <= 100
    && position.y >= 0
    && position.y <= 100;
}

function sameMembers(actual, expected) {
  return actual.length === expected.length
    && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

function rosterReport(players, team) {
  const teamPlayers = players.filter((player) => player.team === team);
  const roles = teamPlayers
    .map((player) => player.role)
    .sort((a, b) => PLAY_SCENE_ROLES.indexOf(a) - PLAY_SCENE_ROLES.indexOf(b));
  return {
    team,
    playerCount: teamPlayers.length,
    roles,
    valid: teamPlayers.length === 6 && sameMembers(roles, PLAY_SCENE_ROLES),
  };
}

function playerTrackErrors(player, duration) {
  const errors = [];
  const keyframes = player.keyframes ?? [];

  if (keyframes.length === 0) return [`${player.id} needs keyframes.`];
  if (keyframes[0].time !== 0) errors.push(`${player.id} must start at time 0.`);
  if (keyframes.at(-1).time !== duration) errors.push(`${player.id} must end at the scene duration.`);

  for (let index = 0; index < keyframes.length; index += 1) {
    const keyframe = keyframes[index];
    if (!isRinkPosition(keyframe.position)) errors.push(`${player.id} has an out-of-bounds position at keyframe ${index}.`);
    if (index > 0 && keyframe.time <= keyframes[index - 1].time) {
      errors.push(`${player.id} keyframe times must increase.`);
      break;
    }
  }

  return errors;
}

function ballTimelineErrors(segments, duration, playerIds) {
  const errors = [];
  const supportedTypes = new Set(['carry', 'pass', 'board-pass', 'shot', 'loose', 'faceoff']);
  if (segments.length === 0) return ['Scene needs a ball timeline.'];
  if (segments[0].from !== 0) errors.push('Ball timeline must start at time 0.');
  if (segments.at(-1).to !== duration) errors.push('Ball timeline must end at the scene duration.');

  segments.forEach((segment, index) => {
    if (!supportedTypes.has(segment.type)) errors.push(`Ball segment ${index} has an unsupported type.`);
    if (!Number.isFinite(segment.from) || !Number.isFinite(segment.to) || segment.to <= segment.from) {
      errors.push(`Ball segment ${index} has an invalid time range.`);
    }
    if (index > 0 && segment.from !== segments[index - 1].to) {
      errors.push(`Ball segment ${index} does not continue from the previous segment.`);
    }
    for (const idField of ['ownerId', 'fromPlayerId', 'toPlayerId']) {
      if (segment[idField] && !playerIds.has(segment[idField])) {
        errors.push(`Ball segment ${index} references an unknown player in ${idField}.`);
      }
    }
    if (segment.type === 'carry' && !segment.ownerId) {
      errors.push(`Ball segment ${index} needs an owner.`);
    }
    if (['pass', 'board-pass'].includes(segment.type) && (!segment.fromPlayerId || !segment.toPlayerId)) {
      errors.push(`Ball segment ${index} needs a passer and receiver.`);
    }
    if (segment.type === 'faceoff' && !segment.toPlayerId) {
      errors.push(`Ball segment ${index} needs a draw receiver.`);
    }
    if (segment.type === 'shot' && !segment.fromPlayerId) {
      errors.push(`Ball segment ${index} needs a shooter.`);
    }
    if (['shot', 'loose', 'faceoff'].includes(segment.type) && (!isRinkPosition(segment.start) || !isRinkPosition(segment.end))) {
      errors.push(`Ball segment ${index} needs valid start and end positions.`);
    }
    if (segment.path?.some((point) => !isRinkPosition(point))) {
      errors.push(`Ball segment ${index} has an out-of-bounds path point.`);
    }
  });

  return errors;
}

export function validatePlayScene(scene) {
  const errors = [];
  const players = scene.players ?? [];
  const playerCount = players.length;
  const playerIds = new Set(players.map((player) => player.id));
  const movementByPlayer = players.map((player) => movementReport(player, scene.generatedFrom2d));
  const movingPlayerIds = movementByPlayer.filter((report) => report.moving).map((report) => report.id);
  const stationaryPlayerIds = movementByPlayer.filter((report) => !report.moving).map((report) => report.id);
  const boardBounceSegments = (scene.ball?.segments ?? []).filter((segment) => segment.type === 'board-pass');
  const invalidBoardBounceSegments = boardBounceSegments
    .map((segment, index) => ({ index, bounce: calculateBoardBounce(segment) }))
    .filter(({ bounce }) => !bounce.validPhysics);
  const rosters = PLAY_SCENE_TEAMS.map((team) => rosterReport(players, team));

  if (scene.schemaVersion !== PLAY_SCENE_SCHEMA_VERSION) errors.push(`Expected play-scene schema version ${PLAY_SCENE_SCHEMA_VERSION}.`);
  if (!['play', 'strategy'].includes(scene.kind)) errors.push('Scene kind must be play or strategy.');
  if (!Number.isFinite(scene.duration) || scene.duration <= 0) errors.push('Scene duration must be positive.');
  if (scene.rink?.orientation !== 'vertical') errors.push('Scene rink must use vertical orientation.');
  if (scene.rink?.ourNet !== 'bottom' || scene.rink?.theirNet !== 'top') errors.push('Our net must be at the bottom and their net must be at the top.');
  if (scene.presentation?.captionsPlacement !== 'below-rink') errors.push('Captions must be below the rink.');
  if (scene.presentation?.coachingOverlaysDefault !== false) errors.push('Coaching overlays must be off by default.');
  if (scene.presentation?.audio !== false) errors.push('Audio must be disabled.');
  if (playerCount !== 12) errors.push(`Expected 12 players, found ${playerCount}.`);
  if (playerIds.size !== playerCount) errors.push('Every player needs a unique ID.');
  rosters.filter((roster) => !roster.valid).forEach((roster) => {
    errors.push(`${roster.team} must include LW, C, RW, LD, RD, and G exactly once.`);
  });
  if (stationaryPlayerIds.length > 0) errors.push(`Every player needs visible movement in the scene. Check: ${stationaryPlayerIds.join(', ')}.`);
  players.forEach((player) => errors.push(...playerTrackErrors(player, scene.duration)));
  errors.push(...ballTimelineErrors(scene.ball?.segments ?? [], scene.duration, playerIds));
  if (invalidBoardBounceSegments.length > 0) {
    errors.push(`Board-bounce segment needs a realistic rebound angle. Check segment index: ${invalidBoardBounceSegments.map((item) => item.index).join(', ')}.`);
  }
  if (scene.kind === 'play' && !scene.sourcePlayId) errors.push('Play scene needs a source play link.');
  if (scene.kind === 'strategy' && !scene.sourceTacticId) errors.push('Strategy scene needs a source strategy link.');

  return {
    valid: errors.length === 0,
    errors,
    playerCount,
    movingPlayerIds,
    stationaryPlayerIds,
    movementByPlayer,
    boardBounceSegments,
    invalidBoardBounceSegments,
    rosters,
  };
}
