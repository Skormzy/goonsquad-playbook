export const PLAYMAKER_SCHEMA_VERSION = 2;

export const PLAYMAKER_PLAYER_ACTIONS = Object.freeze([
  { id: 'hold', label: 'Hold position' },
  { id: 'run', label: 'Run lane' },
  { id: 'cut', label: 'Cut to space' },
  { id: 'support', label: 'Support ball' },
  { id: 'pressure', label: 'Pressure carrier' },
  { id: 'screen', label: 'Screen goalie' },
  { id: 'receive', label: 'Receive' },
  { id: 'pass', label: 'Pass' },
  { id: 'shoot', label: 'Shoot' },
]);

export const PLAYMAKER_BALL_TRANSITIONS = Object.freeze([
  { id: 'carry', label: 'Carry / keep' },
  { id: 'pass', label: 'Direct pass' },
  { id: 'board-pass', label: 'Boards pass' },
  { id: 'shot', label: 'Shot' },
  { id: 'loose', label: 'Loose ball' },
]);

export const PLAYMAKER_ROSTER = Object.freeze([
  { id: 'US_G', label: 'G', role: 'G', team: 'us' },
  { id: 'US_LD', label: 'LD', role: 'LD', team: 'us' },
  { id: 'US_RD', label: 'RD', role: 'RD', team: 'us' },
  { id: 'US_LW', label: 'LW', role: 'LW', team: 'us' },
  { id: 'US_C', label: 'C', role: 'C', team: 'us' },
  { id: 'US_RW', label: 'RW', role: 'RW', team: 'us' },
  { id: 'OP_G', label: 'G', role: 'G', team: 'opponent' },
  { id: 'OP_LD', label: 'LD', role: 'LD', team: 'opponent' },
  { id: 'OP_RD', label: 'RD', role: 'RD', team: 'opponent' },
  { id: 'OP_LW', label: 'LW', role: 'LW', team: 'opponent' },
  { id: 'OP_C', label: 'C', role: 'C', team: 'opponent' },
  { id: 'OP_RW', label: 'RW', role: 'RW', team: 'opponent' },
]);

const TEMPLATE_POSITIONS = Object.freeze({
  'full-court': Object.freeze({
    US_G: [50, 7], US_LD: [34, 19], US_RD: [66, 19], US_LW: [20, 39], US_C: [50, 33], US_RW: [80, 39],
    OP_G: [50, 93], OP_LD: [34, 81], OP_RD: [66, 81], OP_LW: [20, 61], OP_C: [50, 67], OP_RW: [80, 61],
  }),
  breakout: Object.freeze({
    US_G: [50, 7], US_LD: [31, 13], US_RD: [63, 16], US_LW: [13, 35], US_C: [48, 29], US_RW: [84, 39],
    OP_G: [50, 93], OP_LD: [33, 66], OP_RD: [67, 66], OP_LW: [18, 31], OP_C: [38, 20], OP_RW: [72, 34],
  }),
  'offensive-zone': Object.freeze({
    US_G: [50, 7], US_LD: [34, 61], US_RD: [66, 61], US_LW: [20, 78], US_C: [50, 73], US_RW: [80, 78],
    OP_G: [50, 93], OP_LD: [36, 82], OP_RD: [64, 82], OP_LW: [25, 68], OP_C: [50, 76], OP_RW: [75, 68],
  }),
  'defensive-zone': Object.freeze({
    US_G: [50, 7], US_LD: [36, 18], US_RD: [64, 18], US_LW: [25, 31], US_C: [50, 24], US_RW: [75, 31],
    OP_G: [50, 93], OP_LD: [34, 39], OP_RD: [66, 39], OP_LW: [20, 22], OP_C: [50, 29], OP_RW: [80, 22],
  }),
});

export const PLAYMAKER_TEMPLATES = Object.freeze([
  { id: 'full-court', label: 'Full court' },
  { id: 'breakout', label: 'Breakout' },
  { id: 'offensive-zone', label: 'Offensive zone' },
  { id: 'defensive-zone', label: 'Defensive zone' },
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function playmakerBallPosition(frame, playerId) {
  const player = playerId ? frame?.players?.[playerId] : null;
  return player ? { x: player.x, y: player.y } : { ...frame.ball.target };
}

export function playmakerBoardImpact(start, end) {
  const useLeft = (start.x + end.x) / 2 <= 50;
  return {
    x: useLeft ? 3.5 : 96.5,
    y: clamp(start.y + (end.y - start.y) * 0.58, 5, 95),
  };
}

export function resolvePlaymakerBallDecision(source, destination) {
  if (!source || !destination) return null;
  const type = destination.ball.transition;
  const fromPlayerId = source.ball.ownerId;
  const toPlayerId = type === 'pass' || type === 'board-pass'
    ? destination.ball.receiverId
    : type === 'loose'
      ? destination.ball.ownerId
      : null;
  const ownerId = type === 'carry' ? fromPlayerId : null;
  const endPlayerId = ownerId ?? toPlayerId;

  return {
    type,
    fromPlayerId,
    toPlayerId,
    ownerId,
    start: playmakerBallPosition(source, fromPlayerId),
    end: endPlayerId
      ? playmakerBallPosition(destination, endPlayerId)
      : { ...destination.ball.target },
  };
}

export function createPlaymakerId(prefix = 'draft') {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${id}`;
}

function playerStateFromTemplate(templateId) {
  const positions = TEMPLATE_POSITIONS[templateId] ?? TEMPLATE_POSITIONS['full-court'];
  return Object.fromEntries(PLAYMAKER_ROSTER.map((player) => {
    const [x, y] = positions[player.id];
    return [player.id, { x, y, action: 'hold' }];
  }));
}

export function clonePlaymakerFrame(frame, overrides = {}) {
  const ballOverrides = overrides.ball ?? {};
  return {
    ...frame,
    ...overrides,
    id: overrides.id ?? createPlaymakerId('moment'),
    players: Object.fromEntries(Object.entries(frame.players).map(([id, player]) => [id, { ...player }])),
    ball: {
      ...frame.ball,
      ...ballOverrides,
      receiverId: Object.hasOwn(ballOverrides, 'receiverId')
        ? ballOverrides.receiverId
        : frame.ball.receiverId ?? null,
      target: { ...(ballOverrides.target ?? frame.ball.target) },
    },
  };
}

export function createPlaymakerDraft(templateId = 'full-court') {
  const now = new Date().toISOString();
  const players = playerStateFromTemplate(templateId);
  const first = {
    id: createPlaymakerId('moment'),
    label: 'Starting shape',
    seconds: 0,
    players,
    ball: {
      ownerId: 'US_C',
      receiverId: null,
      transition: 'carry',
      target: { x: 50, y: 50 },
    },
  };
  const second = clonePlaymakerFrame(first, {
    label: 'Next read',
    seconds: 2,
    ball: { receiverId: 'US_C' },
  });

  return {
    schemaVersion: PLAYMAKER_SCHEMA_VERSION,
    id: createPlaymakerId('play'),
    title: 'Untitled play',
    description: 'Create the shape, movement, and ball decision for this play.',
    visibility: 'private',
    createdAt: now,
    updatedAt: now,
    frames: [first, second],
  };
}

function normalizePlayerState(value, fallback) {
  return {
    x: clamp(Number.isFinite(Number(value?.x)) ? Number(value.x) : fallback.x, 2, 98),
    y: clamp(Number.isFinite(Number(value?.y)) ? Number(value.y) : fallback.y, 2, 98),
    action: PLAYMAKER_PLAYER_ACTIONS.some(({ id }) => id === value?.action) ? value.action : 'hold',
  };
}

export function normalizePlaymakerDraft(value) {
  if (!value || typeof value !== 'object') return createPlaymakerDraft();
  const fallback = createPlaymakerDraft();
  const sourceFrames = Array.isArray(value.frames) && value.frames.length > 0
    ? value.frames
    : fallback.frames;
  let previousPlayers = fallback.frames[0].players;
  const frames = sourceFrames.map((frame, index) => {
    const players = Object.fromEntries(PLAYMAKER_ROSTER.map((player) => {
      const normalized = normalizePlayerState(frame?.players?.[player.id], previousPlayers[player.id]);
      return [player.id, normalized];
    }));
    previousPlayers = players;
    const transition = PLAYMAKER_BALL_TRANSITIONS.some(({ id }) => id === frame?.ball?.transition)
      ? frame.ball.transition
      : 'carry';
    return {
      id: typeof frame?.id === 'string' ? frame.id : createPlaymakerId('moment'),
      label: String(frame?.label || `Moment ${index + 1}`).slice(0, 80),
      seconds: index === 0 ? 0 : clamp(Number(frame?.seconds) || 2, 0.5, 8),
      players,
      ball: {
        ownerId: PLAYMAKER_ROSTER.some(({ id }) => id === frame?.ball?.ownerId)
          ? frame.ball.ownerId
          : null,
        receiverId: PLAYMAKER_ROSTER.some(({ id }) => id === frame?.ball?.receiverId)
          ? frame.ball.receiverId
          : null,
        transition,
        target: {
          x: clamp(Number(frame?.ball?.target?.x) || 50, 2, 98),
          y: clamp(Number(frame?.ball?.target?.y) || 50, 2, 98),
        },
      },
    };
  });

  if (frames.length === 1) {
    frames.push(clonePlaymakerFrame(frames[0], { label: 'Next read', seconds: 2 }));
  }

  // A frame's transition describes how the ball arrived from the prior frame.
  // Keep an explicit receiver ID so editing possession cannot redirect a pass.
  frames[0].ball.receiverId = null;
  for (let index = 1; index < frames.length; index += 1) {
    const source = frames[index - 1];
    const destination = frames[index];
    const sourcePlayer = PLAYMAKER_ROSTER.find(({ id }) => id === source.ball.ownerId);
    const legacyReceiver = PLAYMAKER_ROSTER.find(({ id }) => id === destination.ball.ownerId);
    const explicitReceiver = PLAYMAKER_ROSTER.find(({ id }) => id === destination.ball.receiverId);

    if (destination.ball.transition === 'carry') {
      destination.ball.receiverId = source.ball.ownerId;
      destination.ball.ownerId = source.ball.ownerId;
      continue;
    }

    if (destination.ball.transition === 'pass' || destination.ball.transition === 'board-pass') {
      const receiver = explicitReceiver ?? legacyReceiver;
      const receiverIsValid = Boolean(
        sourcePlayer
        && receiver
        && receiver.team === sourcePlayer.team
        && receiver.id !== sourcePlayer.id
      );
      destination.ball.receiverId = receiverIsValid ? receiver.id : null;
      destination.ball.ownerId = receiverIsValid ? receiver.id : null;
      continue;
    }

    destination.ball.receiverId = null;
    if (destination.ball.transition === 'shot') {
      destination.ball.ownerId = null;
    }
  }

  return {
    schemaVersion: PLAYMAKER_SCHEMA_VERSION,
    id: typeof value.id === 'string' ? value.id : createPlaymakerId('play'),
    title: String(value.title || 'Untitled play').slice(0, 100),
    description: String(value.description || '').slice(0, 320),
    visibility: value.visibility === 'public' ? 'public' : 'private',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    frames,
  };
}

export function playmakerFrameTimes(draft) {
  let elapsed = 0;
  return draft.frames.map((frame, index) => {
    if (index > 0) elapsed += frame.seconds;
    return Number(elapsed.toFixed(3));
  });
}

export function playmakerPlayerById(playerId) {
  return PLAYMAKER_ROSTER.find((player) => player.id === playerId) ?? null;
}
