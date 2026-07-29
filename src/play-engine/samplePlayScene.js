import { calculateBoardBounce, sampleBoardPass } from './boardBounce';
import {
  BALL_RECEIVE_CONTACT_SECONDS,
  BALL_RECEIVE_PREP_SECONDS,
  BALL_RELEASE_CONTACT_SECONDS,
  ballTimingProgressWindow,
} from './ballContactTiming';
import { fieldMovementAction, rinkDistanceMeters } from './movementMetrics';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(2));
const STICK_CONTACT_EASE = 3.5;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPosition(a, b, t) {
  return {
    x: round(lerp(a.x, b.x, t)),
    y: round(lerp(a.y, b.y, t)),
  };
}

function catmullRom(a, b, c, d, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * b
    + (-a + c) * t
    + (2 * a - 5 * b + 4 * c - d) * t2
    + (-a + 3 * b - 3 * c + d) * t3
  );
}

function curvePosition(keyframes, index, t) {
  const previous = keyframes[Math.max(0, index - 1)].position;
  const current = keyframes[index].position;
  const next = keyframes[index + 1].position;
  const following = keyframes[Math.min(keyframes.length - 1, index + 2)].position;

  return {
    x: round(clamp(catmullRom(previous.x, current.x, next.x, following.x, t), 0, 100)),
    y: round(clamp(catmullRom(previous.y, current.y, next.y, following.y, t), 0, 100)),
  };
}

function lerpAngle(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

function velocityBetween(a, b, seconds) {
  const duration = Math.max(seconds, 0.001);
  return {
    x: round((b.x - a.x) / duration),
    y: round((b.y - a.y) / duration),
  };
}

function blendPosition(a, b, t) {
  return {
    x: round(lerp(a.x, b.x, clamp(t, 0, 1))),
    y: round(lerp(a.y, b.y, clamp(t, 0, 1))),
  };
}

function delayedSmoothstep(progress) {
  const delayed = Math.pow(clamp(progress, 0, 1), STICK_CONTACT_EASE);
  return delayed * delayed * (3 - 2 * delayed);
}

function stickContactBlend(progress, contactWindow) {
  return delayedSmoothstep(progress / contactWindow);
}

function stickReceiveBlend(progress, contactWindow) {
  const normalized = (progress - (1 - contactWindow)) / contactWindow;
  return 1 - delayedSmoothstep(1 - normalized);
}

function stickPocketPosition(player, progress = 0) {
  const facing = player.facing ?? 0;
  const forward = {
    x: Math.sin(facing),
    y: Math.cos(facing),
  };
  const right = {
    x: Math.cos(facing),
    y: -Math.sin(facing),
  };
  const handleSweep = Math.sin(progress * Math.PI * 6) * 0.18;
  const lateral = (player.team === 'us' ? 0.58 : -0.52) + handleSweep;
  const forwardReach = 0.84;

  return {
    x: round(clamp(player.position.x + forward.x * forwardReach + right.x * lateral, 1.2, 98.8)),
    y: round(clamp(player.position.y + forward.y * forwardReach + right.y * lateral, 1.2, 98.8)),
  };
}

export function samplePlayerKeyframes(keyframes, time) {
  if (time <= keyframes[0].time) return { ...keyframes[0], speedMps: 0 };

  for (let i = 0; i < keyframes.length - 1; i += 1) {
    const current = keyframes[i];
    const next = keyframes[i + 1];
    if (time <= next.time) {
      const span = next.time - current.time;
      const t = span === 0 ? 1 : (time - current.time) / span;
      const position = curvePosition(keyframes, i, t);
      const speedMps = round(rinkDistanceMeters(current.position, next.position) / Math.max(span, 0.001));
      return {
        time,
        position,
        facing: lerpAngle(current.facing ?? 0, next.facing ?? 0, t),
        speedMps,
      };
    }
  }

  return { ...keyframes.at(-1), speedMps: 0 };
}

function samePosition(first, second) {
  return Math.abs(first.x - second.x) < 0.001
    && Math.abs(first.y - second.y) < 0.001;
}

function segmentPath(segment) {
  const authored = Array.isArray(segment.path) && segment.path.length >= 2
    ? segment.path
    : [segment.start, segment.end];
  const path = authored.map((point) => ({ x: point.x, y: point.y }));

  if (!samePosition(path[0], segment.start)) path.unshift(segment.start);
  if (!samePosition(path.at(-1), segment.end)) path.push(segment.end);

  return path.filter((point, index) => (
    index === 0 || !samePosition(point, path[index - 1])
  ));
}

function samplePolyline(segment, progress, duration) {
  const path = segmentPath(segment);
  const legs = path.slice(1).map((end, index) => {
    const start = path[index];
    return {
      start,
      end,
      distance: rinkDistanceMeters(start, end),
    };
  }).filter((leg) => leg.distance > 0.0001);
  const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);

  if (totalDistance <= 0.0001) {
    return {
      position: { ...segment.end },
      path,
      velocity: { x: 0, y: 0 },
    };
  }

  const requestedDistance = totalDistance * progress;
  let distanceBeforeLeg = 0;
  let activeLeg = legs.at(-1);
  for (const leg of legs) {
    if (requestedDistance <= distanceBeforeLeg + leg.distance) {
      activeLeg = leg;
      break;
    }
    distanceBeforeLeg += leg.distance;
  }

  const legProgress = clamp(
    (requestedDistance - distanceBeforeLeg) / activeLeg.distance,
    0,
    1,
  );
  const legDuration = duration * activeLeg.distance / totalDistance;
  return {
    position: lerpPosition(activeLeg.start, activeLeg.end, legProgress),
    path,
    velocity: velocityBetween(activeLeg.start, activeLeg.end, legDuration),
  };
}

function sampleBallSegment(segment, time) {
  const progress = clamp((time - segment.from) / (segment.to - segment.from), 0, 1);
  const duration = segment.to - segment.from;

  if (segment.type === 'board-pass') {
    const boardPass = calculateBoardBounce(segment);
    const position = sampleBoardPass(boardPass, progress);
    const inbound = progress <= boardPass.impactT;
    const legStart = inbound ? segment.incoming : segment.impact;
    const legEnd = inbound ? segment.impact : segment.exitTarget;
    const legDuration = duration * (inbound ? boardPass.impactT : (1 - boardPass.impactT));
    return {
      position,
      path: boardPass.path,
      ownerId: progress >= 1 ? segment.toPlayerId : null,
      fromPlayerId: segment.fromPlayerId,
      toPlayerId: segment.toPlayerId,
      segmentType: segment.type,
      segmentDuration: duration,
      progress,
      velocity: velocityBetween(legStart, legEnd, legDuration),
      board: boardPass.board,
      boardPhase: position.phase,
      impactProgress: boardPass.impactT,
      impactPosition: segment.impact,
    };
  }

  const sampledPath = samplePolyline(segment, progress, duration);
  const transfersToReceiver = ['pass', 'faceoff'].includes(segment.type)
    || (segment.type === 'loose' && segment.toPlayerId);
  return {
    position: sampledPath.position,
    path: sampledPath.path,
    ownerId: transfersToReceiver
      ? (progress >= 0.92 ? segment.toPlayerId : null)
      : (segment.ownerId ?? null),
    fromPlayerId: segment.fromPlayerId,
    toPlayerId: segment.toPlayerId,
    segmentType: segment.type,
    transitionType: segment.transitionType ?? null,
    faceoffState: segment.faceoffState ?? null,
    segmentDuration: duration,
    progress,
    velocity: sampledPath.velocity,
  };
}

function sampleBall(replay, time) {
  const segment = replay.ball.segments.find((item) => time >= item.from && time <= item.to) ?? replay.ball.segments.at(-1);
  return sampleBallSegment(segment, time);
}

function resolveBallStickContext(ball, players) {
  const progress = ball.progress ?? 0;
  const trajectoryPosition = ball.position;

  if (ball.segmentType === 'carry' && ball.ownerId) {
    const owner = players.find((player) => player.id === ball.ownerId);
    if (!owner) return ball;

    const pocket = stickPocketPosition(owner, progress);
    return {
      ...ball,
      position: pocket,
      trajectoryPosition,
      stickTargetPlayerId: owner.id,
      stickContact: 'carry',
      stickContactWeight: 1,
    };
  }

  const contactFlight = ball.segmentType === 'pass'
    || ball.segmentType === 'board-pass'
    || ball.segmentType === 'shot'
    || ball.segmentType === 'faceoff'
    || (ball.segmentType === 'loose' && ball.fromPlayerId);
  if (contactFlight) {
    const passer = players.find((player) => player.id === ball.fromPlayerId);
    const receiver = players.find((player) => player.id === ball.toPlayerId);
    const releaseWindow = ballTimingProgressWindow(
      BALL_RELEASE_CONTACT_SECONDS,
      ball.segmentDuration,
    );
    const receiveWindow = ballTimingProgressWindow(
      BALL_RECEIVE_CONTACT_SECONDS,
      ball.segmentDuration,
    );
    if (passer && progress <= releaseWindow) {
      const pocket = stickPocketPosition(passer, progress);
      const releaseBlend = stickContactBlend(progress, releaseWindow);
      const releasePosition = blendPosition(pocket, trajectoryPosition, releaseBlend);
      return {
        ...ball,
        position: releasePosition,
        trajectoryPosition,
        stickTargetPlayerId: passer.id,
        stickContact: 'release',
        stickContactWeight: round(1 - releaseBlend),
      };
    }

    if (receiver && progress >= 1 - receiveWindow) {
      const pocket = stickPocketPosition(receiver, progress);
      const receiveBlend = stickReceiveBlend(progress, receiveWindow);
      const receivePosition = blendPosition(trajectoryPosition, pocket, receiveBlend);
      return {
        ...ball,
        position: receivePosition,
        trajectoryPosition,
        stickTargetPlayerId: receiver.id,
        stickContact: 'receive',
        stickContactWeight: round(receiveBlend),
      };
    }
  }

  return {
    ...ball,
    trajectoryPosition,
    stickContactWeight: 0,
  };
}

function currentEvent(events, time) {
  return events
    .filter((event) => event.time <= time)
    .sort((a, b) => b.time - a.time)[0] ?? null;
}

function movementAction(player) {
  if (player.role === 'G') return { action: 'goalie-ready', actionIntensity: 1 };
  return fieldMovementAction(player.speedMps);
}

function ballSkillAction(player, ball) {
  if (player.role === 'G') return movementAction(player);

  const progress = ball.progress ?? 0;
  const releaseWindow = ballTimingProgressWindow(
    BALL_RELEASE_CONTACT_SECONDS,
    ball.segmentDuration,
  );
  const receivePrepWindow = ballTimingProgressWindow(
    BALL_RECEIVE_PREP_SECONDS,
    ball.segmentDuration,
  );

  if (ball.segmentType === 'faceoff') {
    if (player.id === ball.toPlayerId && progress >= 1 - receivePrepWindow) {
      return {
        action: 'receive-pass',
        actionIntensity: clamp((progress - (1 - receivePrepWindow)) / receivePrepWindow, 0.2, 1),
      };
    }
    if (player.role === 'C' && player.active !== false) {
      return {
        action: 'forehand-pass',
        actionIntensity: 0.72 + Math.sin(progress * Math.PI) * 0.28,
      };
    }
  }

  const releasesFromPlayer = ball.segmentType === 'board-pass'
    || ball.segmentType === 'pass'
    || ball.segmentType === 'shot'
    || (ball.segmentType === 'loose' && ball.fromPlayerId);
  if (releasesFromPlayer && player.id === ball.fromPlayerId && progress <= releaseWindow) {
    return { action: 'forehand-pass', actionIntensity: 1 - clamp(progress / releaseWindow, 0, 1) * 0.35 };
  }

  const receivesFromFlight = ball.segmentType === 'board-pass'
    || ball.segmentType === 'pass'
    || (ball.segmentType === 'loose' && ball.toPlayerId);
  if (receivesFromFlight && player.id === ball.toPlayerId && progress >= 1 - receivePrepWindow) {
    return {
      action: 'receive-pass',
      actionIntensity: clamp((progress - (1 - receivePrepWindow)) / receivePrepWindow, 0.2, 1),
    };
  }

  if (ball.segmentType === 'carry' && ball.ownerId === player.id) {
    return { action: 'stick-handle', actionIntensity: 0.65 + Math.abs(Math.sin(progress * Math.PI * 5)) * 0.35 };
  }

  return movementAction(player);
}

export function samplePlayScene(scene, requestedTime) {
  const time = clamp(requestedTime, 0, scene.duration);
  const sampledPlayers = scene.players.map((player) => ({
    ...player,
    ...samplePlayerKeyframes(player.keyframes, time),
  }));
  const ball = resolveBallStickContext(sampleBall(scene, time), sampledPlayers);
  const players = sampledPlayers.map((sampled) => {
    return {
      ...sampled,
      ...ballSkillAction(sampled, ball),
    };
  });

  return {
    time,
    event: currentEvent(scene.events, time),
    players,
    ball,
  };
}
