import { rinkDistanceMeters } from './movementMetrics';
import { samplePlayScene } from './samplePlayScene';
import { validatePlayScene } from './validatePlayScene';

const EXPECTED_OPENING_STATES = ['draw', 'secured'];
const MIN_RESTRAINING_DISTANCE_METERS = 4.5;
const MIN_NON_CENTER_CLEARANCE_METERS = 4.57;
const MIN_CENTER_SEPARATION_METERS = 1.35;
const MAX_CENTER_SEPARATION_METERS = 1.9;
const MAX_DRAW_SECONDS = 0.9;
const MAX_DRAW_SPEED_METERS_PER_SECOND = 10;

function expectedDrawTarget(play) {
  return play.faceoff?.outcomeTarget ?? play.faceoff?.drawTarget ?? null;
}

function sourceDrawTarget(play) {
  const target = expectedDrawTarget(play);
  return target?.startsWith('OP_') ? `op-${target.slice(3).toLowerCase()}` : target;
}

const distance = (a, b) => Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0));

function angleDifference(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function activeSourcePlayers(phase) {
  return [
    ...Object.entries(phase.pos)
      .filter(([role, player]) => role !== 'C' && role !== 'G' && !player.inactive)
      .map(([role, player]) => ({ id: `US_${role}`, ...player })),
    ...phase.opp
      .filter((player) => player.l !== 'C' && player.l !== 'G' && !player.inactive)
      .map((player) => ({ id: player.id, ...player })),
  ];
}

function sourceOpeningErrors(play) {
  const errors = [];
  const dot = play.faceoff?.dot;
  const outcome = play.faceoff?.outcome ?? 'won';
  const drawTarget = expectedDrawTarget(play);
  const sourceTarget = sourceDrawTarget(play);
  const [drawPhase, securedPhase] = play.phases;
  if (!dot) return [`${play.id} needs faceoff dot metadata.`];

  const openingStates = play.phases.slice(0, 2).map((phase) => phase.faceoffState);
  if (openingStates.some((state, index) => state !== EXPECTED_OPENING_STATES[index])) {
    errors.push(`${play.id} must begin with the draw, then secured possession.`);
  }
  if (drawPhase.ballOwner !== null) {
    errors.push(`${play.id} must keep the ball loose until draw contact.`);
  }
  if (distance(drawPhase.ball, dot) > 0.01) {
    errors.push(`${play.id} must keep the ball on the faceoff dot before contact.`);
  }

  const homeCenter = drawPhase.pos.C;
  const opponentCenter = drawPhase.opp.find((player) => player.l === 'C');
  if (!opponentCenter) {
    errors.push(`${play.id} needs an opposing center at the draw.`);
  } else {
    if (homeCenter.y >= dot.y || opponentCenter.y <= dot.y) {
      errors.push(`${play.id} centers must square up on opposite sides of the dot.`);
    }
    if (Math.abs(homeCenter.x - dot.x) > 0.35 || Math.abs(opponentCenter.x - dot.x) > 0.35) {
      errors.push(`${play.id} centers must align through the dot.`);
    }
    const separation = rinkDistanceMeters(homeCenter, opponentCenter);
    if (separation < MIN_CENTER_SEPARATION_METERS || separation > MAX_CENTER_SEPARATION_METERS) {
      errors.push(`${play.id} center separation is ${separation.toFixed(2)}m.`);
    }
  }

  activeSourcePlayers(drawPhase).forEach((player) => {
    const restrainingDistance = rinkDistanceMeters(player, dot);
    if (restrainingDistance < MIN_RESTRAINING_DISTANCE_METERS) {
      errors.push(`${play.id} ${player.id} starts inside the restraining circle (${restrainingDistance.toFixed(2)}m).`);
    }
    if (opponentCenter) {
      const homeCenterClearance = rinkDistanceMeters(player, homeCenter);
      const opponentCenterClearance = rinkDistanceMeters(player, opponentCenter);
      if (Math.min(homeCenterClearance, opponentCenterClearance) < MIN_NON_CENTER_CLEARANCE_METERS) {
        errors.push(`${play.id} ${player.id} is inside the 4.57m faceoff clearance (${Math.min(homeCenterClearance, opponentCenterClearance).toFixed(2)}m).`);
      }
    }
    const homePlayer = player.id.startsWith('US_');
    if ((homePlayer && player.y > dot.y) || (!homePlayer && player.y < dot.y)) {
      errors.push(`${play.id} ${player.id} starts on the wrong side of the faceoff line.`);
    }
  });

  if (!['won', 'lost'].includes(outcome)) {
    errors.push(`${play.id} has an unsupported faceoff outcome: ${outcome}.`);
  }
  if (outcome === 'won' && !drawTarget?.startsWith('US_')) {
    errors.push(`${play.id} won outcome must resolve to a home player.`);
  }
  if (outcome === 'lost' && !drawTarget?.startsWith('OP_')) {
    errors.push(`${play.id} lost outcome must resolve to an opponent.`);
  }
  if (securedPhase.ballOwner !== sourceTarget) {
    errors.push(`${play.id} ${outcome} outcome must resolve the draw to ${drawTarget}.`);
  }

  return errors;
}

function runtimeErrors(play, scene) {
  const errors = [];
  const drawTarget = expectedDrawTarget(play);
  const validation = validatePlayScene(scene);
  if (!validation.valid) errors.push(...validation.errors.map((error) => `${play.id}: ${error}`));

  const opening = samplePlayScene(scene, 0);
  if (opening.players.length !== 12) errors.push(`${play.id} must render 12 players.`);
  if (opening.ball.ownerId) errors.push(`${play.id} cannot assign possession before the drop.`);
  if (!['loose', 'faceoff'].includes(opening.ball.segmentType)) {
    errors.push(`${play.id} must begin with a loose draw.`);
  }

  const drawSegment = scene.ball.segments.find((segment) => segment.type === 'faceoff');
  if (!drawSegment) {
    errors.push(`${play.id} needs an authoritative faceoff segment.`);
    return errors;
  }
  if (drawSegment.fromPlayerId) errors.push(`${play.id} draw cannot begin with a preassigned carrier.`);
  if (drawSegment.toPlayerId !== drawTarget) {
    errors.push(`${play.id} draw receiver must be ${drawTarget}.`);
  }
  const drawDuration = drawSegment.to - drawSegment.from;
  if (drawDuration > MAX_DRAW_SECONDS) errors.push(`${play.id} draw takes too long (${drawDuration.toFixed(2)}s).`);
  const drawSpeed = rinkDistanceMeters(drawSegment.start, drawSegment.end) / drawDuration;
  if (drawSpeed > MAX_DRAW_SPEED_METERS_PER_SECOND) {
    errors.push(`${play.id} draw speed is too high (${drawSpeed.toFixed(2)}m/s).`);
  }

  const homeCenter = scene.players.find((player) => player.id === 'US_C');
  const opponentCenter = scene.players.find((player) => player.id === 'OP_C');
  if (!homeCenter || angleDifference(homeCenter.keyframes[0].facing, 0) > 0.25) {
    errors.push(`${play.id} home center must face the attacking end at the draw.`);
  }
  if (!opponentCenter || angleDifference(opponentCenter.keyframes[0].facing, Math.PI) > 0.25) {
    errors.push(`${play.id} opposing center must face the defending end at the draw.`);
  }

  for (let index = 1; index < scene.ball.segments.length; index += 1) {
    const previous = scene.ball.segments[index - 1];
    const current = scene.ball.segments[index];
    if (distance(previous.end, current.start) > 0.05) {
      errors.push(`${play.id} ball jumps between segments ${index - 1} and ${index}.`);
    }
  }

  return errors;
}

export function auditFaceoffPlay(play, scene) {
  const errors = [
    ...sourceOpeningErrors(play),
    ...runtimeErrors(play, scene),
  ];
  return {
    valid: errors.length === 0,
    errors,
    playId: play.id,
  };
}
