import { validatePlayScene } from '../play-engine/validatePlayScene';
import {
  PLAYMAKER_PLAYER_ACTIONS,
  PLAYMAKER_ROSTER,
  playmakerFrameTimes,
  playmakerBoardImpact,
  normalizePlaymakerDraft,
  resolvePlaymakerBallDecision,
} from './playmakerModel';

const homeUniform = Object.freeze({
  jersey: '#f8fafc', stripe: '#1d4ed8', shorts: '#0f172a', helmet: '#f8fafc',
});
const awayUniform = Object.freeze({
  jersey: '#b91c1c', stripe: '#fee2e2', shorts: '#111827', helmet: '#dc2626',
});

const actionLabels = new Map(PLAYMAKER_PLAYER_ACTIONS.map((action) => [action.id, action.label]));

function positionFor(frame, playerId) {
  const state = frame.players[playerId];
  return { x: state.x, y: state.y };
}

function facingFor(frames, index, player) {
  const current = positionFor(frames[index], player.id);
  const adjacent = index < frames.length - 1
    ? positionFor(frames[index + 1], player.id)
    : positionFor(frames[Math.max(0, index - 1)], player.id);
  const dx = index < frames.length - 1 ? adjacent.x - current.x : current.x - adjacent.x;
  const dy = index < frames.length - 1 ? adjacent.y - current.y : current.y - adjacent.y;
  if (Math.hypot(dx, dy) > 0.08) return Math.atan2(dx, dy);
  return player.team === 'us' ? 0 : Math.PI;
}

function playerKeyframes(draft, times, player) {
  const frames = draft.frames;
  const keyframes = frames.map((frame, index) => ({
    time: times[index],
    position: positionFor(frame, player.id),
    facing: facingFor(frames, index, player),
    intent: frame.players[player.id].action,
  }));
  if (keyframes.length !== 2) return keyframes;

  const [start, end] = keyframes;
  return [
    start,
    {
      time: Number(((start.time + end.time) / 2).toFixed(3)),
      position: {
        x: Number(((start.position.x + end.position.x) / 2).toFixed(3)),
        y: Number(((start.position.y + end.position.y) / 2).toFixed(3)),
      },
      facing: start.facing,
      intent: end.intent,
    },
    end,
  ];
}

function compileBallSegment(previous, next, from, to) {
  const decision = resolvePlaymakerBallDecision(previous, next);
  const {
    end,
    fromPlayerId,
    ownerId,
    start,
    toPlayerId,
    type: requestedType,
  } = decision;

  if (requestedType === 'carry' && ownerId) {
    return {
      type: 'carry',
      from,
      to,
      ownerId,
      start,
      end,
    };
  }
  if ((requestedType === 'pass' || requestedType === 'board-pass') && fromPlayerId && toPlayerId) {
    if (requestedType === 'board-pass') {
      return {
        type: 'board-pass',
        from,
        to,
        fromPlayerId,
        toPlayerId,
        incoming: start,
        impact: playmakerBoardImpact(start, end),
        exitTarget: end,
        restitution: 0.68,
      };
    }
    return { type: 'pass', from, to, fromPlayerId, toPlayerId, start, end };
  }
  if (requestedType === 'shot' && fromPlayerId) {
    return { type: 'shot', from, to, fromPlayerId, start, end };
  }
  return {
    type: 'loose',
    from,
    to,
    start,
    end,
    ...(toPlayerId ? { toPlayerId } : {}),
  };
}

export function playmakerDecisionIssues(value) {
  const draft = normalizePlaymakerDraft(value);
  const issues = [];

  draft.frames.slice(1).forEach((destination, index) => {
    const source = draft.frames[index];
    const momentNumber = index + 2;
    const sourcePlayer = PLAYMAKER_ROSTER.find(({ id }) => id === source.ball.ownerId);
    const receiver = PLAYMAKER_ROSTER.find(({ id }) => id === destination.ball.receiverId);

    if (destination.ball.transition === 'carry' && !sourcePlayer) {
      issues.push(`Ball decision into moment ${momentNumber} needs a carrier.`);
    }
    if (destination.ball.transition === 'pass' || destination.ball.transition === 'board-pass') {
      if (!sourcePlayer) {
        issues.push(`Ball decision into moment ${momentNumber} needs a passer.`);
      }
      if (!receiver) {
        issues.push(`Ball decision into moment ${momentNumber} needs an explicit receiver.`);
      } else if (sourcePlayer && (receiver.team !== sourcePlayer.team || receiver.id === sourcePlayer.id)) {
        issues.push(`Ball receiver into moment ${momentNumber} must be a different teammate.`);
      }
      if (receiver && destination.ball.ownerId !== receiver.id) {
        issues.push(`Ball receiver and possession disagree in moment ${momentNumber}.`);
      }
    }
    if (destination.ball.transition === 'shot' && !sourcePlayer) {
      issues.push(`Ball decision into moment ${momentNumber} needs a shooter.`);
    }
  });

  return issues;
}

function roleSummary(draft, roles, fallback) {
  const actions = draft.frames.flatMap((frame) => roles
    .map((role) => PLAYMAKER_ROSTER.find((player) => player.team === 'us' && player.role === role))
    .filter(Boolean)
    .map((player) => frame.players[player.id].action)
    .filter((action) => action !== 'hold'));
  const unique = [...new Set(actions)];
  return unique.length
    ? unique.slice(0, 2).map((action) => actionLabels.get(action) ?? action).join(' then ')
    : fallback;
}

export function compilePlaymakerScene(value) {
  const draft = normalizePlaymakerDraft(value);
  const times = playmakerFrameTimes(draft);
  const duration = times.at(-1);
  const players = PLAYMAKER_ROSTER.map((player) => ({
    ...player,
    uniform: player.team === 'us' ? homeUniform : awayUniform,
    keyframes: playerKeyframes(draft, times, player),
  }));
  const segments = draft.frames.slice(1).map((frame, index) => compileBallSegment(
    draft.frames[index],
    frame,
    times[index],
    times[index + 1],
  ));

  return {
    schemaVersion: 1,
    id: `playmaker-scene-${draft.id}`,
    kind: 'play',
    generatedFrom2d: true,
    title: draft.title,
    sourcePlayId: `custom:${draft.id}`,
    duration,
    sourcePhaseTimes: times,
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
      purpose: draft.description || draft.title,
      responsibilities: [
        { role: 'Winger', action: roleSummary(draft, ['LW', 'RW'], 'Hold width and support the ball.') },
        { role: 'Center', action: roleSummary(draft, ['C'], 'Support through the middle.') },
        { role: 'Defense', action: roleSummary(draft, ['LD', 'RD'], 'Maintain support behind the play.') },
      ],
    },
    teachingPoints: draft.frames.map((frame) => frame.label),
    players,
    ball: { radius: 0.13, segments },
    events: draft.frames.map((frame, index) => ({
      time: times[index],
      label: frame.label,
      nextRead: draft.frames[index + 1]?.label ?? 'Complete the play shape',
    })),
  };
}

export function playmakerReadiness(value) {
  const scene = compilePlaymakerScene(value);
  const baseReport = validatePlayScene(scene);
  const decisionIssues = playmakerDecisionIssues(value);
  const errors = [...baseReport.errors, ...decisionIssues];
  const report = { ...baseReport, valid: errors.length === 0, errors };
  const ballErrors = errors.filter((error) => error.startsWith('Ball'));
  return {
    scene,
    report,
    valid: report.valid,
    movingCount: report.movingPlayerIds.length,
    playerCount: report.playerCount,
    ballValid: ballErrors.length === 0,
    duration: scene.duration,
    momentCount: value.frames?.length ?? 0,
  };
}
