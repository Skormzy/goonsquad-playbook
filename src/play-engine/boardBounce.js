const round = (value) => Number(value.toFixed(2));
const clamp01 = (value) => Math.min(1, Math.max(0, value));

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function unitVector(a, b) {
  const length = distance(a, b);
  if (length < 0.001) return { x: 0, y: 0 };
  return {
    x: (b.x - a.x) / length,
    y: (b.y - a.y) / length,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function angleBetweenDegrees(a, b) {
  const value = Math.min(1, Math.max(-1, dot(a, b)));
  return round(Math.acos(value) * (180 / Math.PI));
}

function lerpPoint(a, b, t) {
  return {
    x: round(a.x + (b.x - a.x) * t),
    y: round(a.y + (b.y - a.y) * t),
  };
}

function boardFromImpact(impact) {
  if (impact.x <= 5) return 'left';
  if (impact.x >= 95) return 'right';
  if (impact.y <= 5) return 'bottom';
  if (impact.y >= 95) return 'top';
  return 'open';
}

function boardNormal(board) {
  if (board === 'left') return { x: 1, y: 0 };
  if (board === 'right') return { x: -1, y: 0 };
  if (board === 'bottom') return { x: 0, y: 1 };
  if (board === 'top') return { x: 0, y: -1 };
  return { x: 0, y: 0 };
}

function reflectDirection(direction, normal) {
  const amount = 2 * dot(direction, normal);
  return {
    x: direction.x - amount * normal.x,
    y: direction.y - amount * normal.y,
  };
}

export function calculateBoardBounce({ incoming, impact, exitTarget, restitution = 0.68 }) {
  const safeRestitution = Math.max(0.2, Math.min(1, restitution));
  const board = boardFromImpact(impact);
  const inboundDistance = distance(incoming, impact);
  const rawOutboundDistance = distance(impact, exitTarget);
  const outboundDistance = rawOutboundDistance / safeRestitution;
  const totalEffectiveDistance = inboundDistance + outboundDistance;
  const impactT = totalEffectiveDistance === 0 ? 0 : inboundDistance / totalEffectiveDistance;
  const inboundUnit = unitVector(incoming, impact);
  const idealOutboundUnit = reflectDirection(inboundUnit, boardNormal(board));
  const authoredOutboundUnit = unitVector(impact, exitTarget);
  const angleErrorDegrees = angleBetweenDegrees(idealOutboundUnit, authoredOutboundUnit);

  return {
    path: [incoming, impact, exitTarget],
    board,
    restitution: safeRestitution,
    inboundDistance: round(inboundDistance),
    rawOutboundDistance: round(rawOutboundDistance),
    outboundDistance: round(outboundDistance),
    totalEffectiveDistance: round(totalEffectiveDistance),
    impactT,
    inboundUnit,
    idealOutboundUnit,
    authoredOutboundUnit,
    angleErrorDegrees,
    speedDropRatio: safeRestitution,
    validPhysics: board !== 'open' && angleErrorDegrees <= 22,
  };
}

export function sampleBoardPass(boardPass, progress) {
  const t = clamp01(progress);
  const [start, impact, end] = boardPass.path;

  if (t <= boardPass.impactT) {
    const inboundT = boardPass.impactT === 0 ? 1 : t / boardPass.impactT;
    return {
      ...lerpPoint(start, impact, inboundT),
      board: boardPass.board,
      phase: 'inbound',
    };
  }

  const outboundT = boardPass.impactT === 1 ? 1 : (t - boardPass.impactT) / (1 - boardPass.impactT);
  return {
    ...lerpPoint(impact, end, outboundT),
    board: boardPass.board,
    phase: outboundT < 0.08 ? 'impact' : 'outbound',
  };
}
