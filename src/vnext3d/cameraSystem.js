const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ROLE_DECISION_TYPES = new Set(['pass', 'board-pass', 'shot']);
const ROLE_DECISION_LEAD_SECONDS = 1.2;
const ROLE_RELEASE_GRACE_SECONDS = 0.24;

function point(position, fallback = [0, 0, 0]) {
  if (!Array.isArray(position)) return fallback;
  return position.map((value, index) => (Number.isFinite(value) ? value : fallback[index]));
}

export const CAMERA_TRACKING_RATE = 4.6;
export const ROLE_CAMERA_POSITION_TRACKING_RATE = 7.2;
export const ROLE_CAMERA_AIM_TRACKING_RATE = 3.4;

export const CAMERA_OPERATOR_COMMANDS = Object.freeze([
  'orbit-left',
  'orbit-right',
  'orbit-up',
  'orbit-down',
  'pan-left',
  'pan-right',
  'pan-forward',
  'pan-back',
  'zoom-in',
  'zoom-out',
]);

const BASE_CAMERA_INTERACTION = Object.freeze({
  enablePan: true,
  enableRotate: true,
  enableZoom: true,
  minDistance: 5.5,
  maxDistance: 92,
  minPolarAngle: 0.035,
  maxPolarAngle: Math.PI * 0.485,
  orbitStepRadians: Math.PI / 18,
  panStepMeters: 1.4,
  zoomStepRatio: 0.84,
  targetBounds: Object.freeze({
    x: Object.freeze([-25, 25]),
    y: Object.freeze([0, 3.5]),
    z: Object.freeze([-44, 44]),
  }),
});

export function cameraInteractionPolicy(cameraId, { portrait = false } = {}) {
  return {
    ...BASE_CAMERA_INTERACTION,
    minDistance: cameraId === 'overhead' ? 5.5 : portrait ? 3.8 : 3.2,
    maxDistance: cameraId === 'overhead' ? 108 : BASE_CAMERA_INTERACTION.maxDistance,
    panStepMeters: portrait ? 1 : BASE_CAMERA_INTERACTION.panStepMeters,
  };
}

export function clampCameraTarget(target, policy = BASE_CAMERA_INTERACTION) {
  const [x, y, z] = point(target);
  return [
    clamp(x, ...policy.targetBounds.x),
    clamp(y, ...policy.targetBounds.y),
    clamp(z, ...policy.targetBounds.z),
  ];
}

function cameraDistance(position, target) {
  return Math.hypot(
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2],
  );
}

export function stepOperatorCamera(
  position,
  target,
  command,
  policy = BASE_CAMERA_INTERACTION,
) {
  const nextTarget = clampCameraTarget(target, policy);
  const nextPosition = point(position);
  const offset = nextPosition.map((value, index) => value - nextTarget[index]);
  const radius = Math.max(cameraDistance(nextPosition, nextTarget), 0.001);

  if (command === 'zoom-in' || command === 'zoom-out') {
    const desiredRadius = command === 'zoom-in'
      ? radius * policy.zoomStepRatio
      : radius / policy.zoomStepRatio;
    const clampedRadius = clamp(desiredRadius, policy.minDistance, policy.maxDistance);
    const scale = clampedRadius / radius;
    return {
      position: offset.map((value, index) => nextTarget[index] + value * scale),
      target: nextTarget,
    };
  }

  if (command.startsWith('orbit-')) {
    const thetaDelta = command === 'orbit-left'
      ? -policy.orbitStepRadians
      : command === 'orbit-right'
        ? policy.orbitStepRadians
        : 0;
    const phiDelta = command === 'orbit-up'
      ? -policy.orbitStepRadians
      : command === 'orbit-down'
        ? policy.orbitStepRadians
        : 0;
    const theta = Math.atan2(offset[0], offset[2]) + thetaDelta;
    const phi = clamp(
      Math.acos(clamp(offset[1] / radius, -1, 1)) + phiDelta,
      policy.minPolarAngle,
      policy.maxPolarAngle,
    );
    const sinPhiRadius = Math.sin(phi) * radius;
    return {
      position: [
        nextTarget[0] + sinPhiRadius * Math.sin(theta),
        nextTarget[1] + Math.cos(phi) * radius,
        nextTarget[2] + sinPhiRadius * Math.cos(theta),
      ],
      target: nextTarget,
    };
  }

  if (command.startsWith('pan-')) {
    const horizontalLength = Math.max(Math.hypot(offset[0], offset[2]), 0.001);
    const right = [offset[2] / horizontalLength, 0, -offset[0] / horizontalLength];
    const forward = [-offset[0] / horizontalLength, 0, -offset[2] / horizontalLength];
    const direction = command === 'pan-left'
      ? right.map((value) => -value)
      : command === 'pan-right'
        ? right
        : command === 'pan-forward'
          ? forward
          : forward.map((value) => -value);
    const requestedTarget = nextTarget.map(
      (value, index) => value + direction[index] * policy.panStepMeters,
    );
    const clampedTarget = clampCameraTarget(requestedTarget, policy);
    const appliedDelta = clampedTarget.map((value, index) => value - nextTarget[index]);
    return {
      position: nextPosition.map((value, index) => value + appliedDelta[index]),
      target: clampedTarget,
    };
  }

  return { position: nextPosition, target: nextTarget };
}

export function cameraTrackingMode(cameraId) {
  if (cameraId === 'overhead') return 'full-court';
  if (cameraId === 'player') return 'role';
  return 'action';
}

function worldPoint(value, fallback = [0, 0, 0]) {
  if (Array.isArray(value)) return point(value, fallback);
  if (Array.isArray(value?.worldPosition)) return point(value.worldPosition, fallback);
  if (value && Number.isFinite(value.x) && Number.isFinite(value.z)) {
    return [value.x, Number.isFinite(value.y) ? value.y : fallback[1], value.z];
  }
  return fallback;
}

function smoothstep(value) {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function horizontalDirection(from, to, fallback = [0, 0, 1]) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return fallback;
  return [dx / distance, 0, dz / distance];
}

export function roleCameraDecision(
  replay,
  playbackTime,
  focusPlayerId,
  players = [],
) {
  if (!focusPlayerId) return null;
  const time = Number.isFinite(playbackTime) ? playbackTime : 0;
  const segment = replay?.ball?.segments?.find((candidate) => (
    ROLE_DECISION_TYPES.has(candidate.type)
    && candidate.fromPlayerId === focusPlayerId
    && candidate.from >= time - ROLE_RELEASE_GRACE_SECONDS
    && candidate.from - time <= ROLE_DECISION_LEAD_SECONDS
  ));
  if (!segment) return null;

  const targetPlayer = segment.toPlayerId
    ? players.find((player) => player.id === segment.toPlayerId)
    : null;
  const secondsUntil = Math.max(0, segment.from - time);
  return {
    type: segment.type,
    targetPlayerId: targetPlayer?.id ?? segment.toPlayerId ?? null,
    targetPosition: targetPlayer?.worldPosition ?? null,
    secondsUntil,
    readiness: smoothstep(1 - secondsUntil / ROLE_DECISION_LEAD_SECONDS),
  };
}

export function roleCameraPose({
  ball,
  ballPosition,
  focusPlayer,
  focusPlayerPosition,
  players = [],
  playbackTime = 0,
  portrait = false,
  replay,
} = {}) {
  const playerPosition = worldPoint(
    focusPlayer?.worldPosition ?? focusPlayerPosition,
  );
  const ballWorldPosition = worldPoint(
    ball?.worldPosition ?? ballPosition,
    [playerPosition[0], 0.45, playerPosition[2] + 8],
  );
  const heading = Number.isFinite(focusPlayer?.worldRotation)
    ? focusPlayer.worldRotation
    : 0;
  const forward = [Math.sin(heading), 0, Math.cos(heading)];
  const forwardDistance = portrait ? 8.5 : 10.5;
  const forwardTarget = [
    playerPosition[0] + forward[0] * forwardDistance,
    1.08,
    playerPosition[2] + forward[2] * forwardDistance,
  ];
  const decision = roleCameraDecision(
    replay,
    playbackTime,
    focusPlayer?.id,
    players,
  );
  const ownsBall = Boolean(
    focusPlayer?.id
    && (
      ball?.ownerId === focusPlayer.id
      || (
        ball?.fromPlayerId === focusPlayer.id
        && (
          ['release', 'faceoff-release'].includes(ball?.state)
          || ball?.stickContact === 'release'
        )
      )
    )
  );

  let intent = 'ball';
  let rawTarget = [
    ballWorldPosition[0],
    Math.max(ballWorldPosition[1], 0.45),
    ballWorldPosition[2],
  ];

  if (ownsBall) {
    intent = 'carry';
    rawTarget = forwardTarget;
    if (decision?.targetPosition) {
      const decisionTarget = worldPoint(decision.targetPosition, forwardTarget);
      const readiness = Math.max(decision.readiness, ball?.state === 'release' ? 1 : 0);
      rawTarget = forwardTarget.map(
        (value, index) => value + (decisionTarget[index] - value) * readiness,
      );
      rawTarget[1] = 1.08;
      intent = decision.type === 'shot' ? 'shot-read' : 'pass-read';
    }
  }

  const aimDirection = horizontalDirection(playerPosition, rawTarget, forward);
  const targetDistance = Math.hypot(
    rawTarget[0] - playerPosition[0],
    rawTarget[2] - playerPosition[2],
  );
  const framedDistance = clamp(targetDistance, 4.5, portrait ? 9.5 : 12);
  const target = [
    playerPosition[0] + aimDirection[0] * framedDistance,
    rawTarget[1],
    playerPosition[2] + aimDirection[2] * framedDistance,
  ];
  const right = [aimDirection[2], 0, -aimDirection[0]];
  const cameraDistance = portrait ? 6.2 : 5.2;
  const shoulderOffset = portrait ? 0.42 : 0.62;

  return {
    position: [
      playerPosition[0] - aimDirection[0] * cameraDistance + right[0] * shoulderOffset,
      portrait ? 3.05 : 2.72,
      playerPosition[2] - aimDirection[2] * cameraDistance + right[2] * shoulderOffset,
    ],
    target,
    fov: portrait ? 56 : 50,
    tracking: 'role',
    intent,
    focusPlayerId: focusPlayer?.id ?? null,
    targetPlayerId: decision?.targetPlayerId ?? null,
  };
}

export function roleCameraIntentLabel(intent) {
  if (intent === 'pass-read') return 'PASS READ';
  if (intent === 'shot-read') return 'SHOT READ';
  if (intent === 'carry') return 'CARRY';
  return 'BALL';
}

export function productionCameraPose(
  cameraId,
  {
    ball,
    ballPosition,
    focusPlayer,
    focusPlayerPosition,
    players,
    playbackTime,
    portrait = false,
    replay,
  } = {},
) {
  const [focusX, , focusZ] = point(focusPlayerPosition);
  const [ballX, , ballZ] = worldPoint(ball?.worldPosition ?? ballPosition);
  const actionX = clamp(ballX * 0.25, -4, 4);
  const actionZ = clamp(ballZ * 0.18 - 2, -6, 2);

  if (cameraId === 'overhead') {
    return {
      position: [0, portrait ? 78 : 74, portrait ? -5.5 : -6.5],
      target: [0, 0, 0],
      fov: portrait ? 44 : 40,
      tracking: cameraTrackingMode(cameraId),
    };
  }

  if (cameraId === 'bench') {
    return {
      position: portrait ? [-46, 28, 0] : [-32, 13, 0],
      target: [actionX * 0.35, 0.85, actionZ * 0.25],
      fov: portrait ? 52 : 40,
      tracking: cameraTrackingMode(cameraId),
    };
  }

  if (cameraId === 'player') {
    return roleCameraPose({
      ball,
      ballPosition,
      focusPlayer,
      focusPlayerPosition: focusPlayer?.worldPosition ?? [focusX, 0, focusZ],
      players,
      playbackTime,
      portrait,
      replay,
    });
  }

  return {
    position: portrait
      ? [actionX, 54, actionZ - 35]
      : [-26, 17, actionZ - 2],
    target: portrait
      ? [actionX, -1, actionZ]
      : [actionX * 0.2, 0.6, actionZ],
    fov: portrait ? 40 : 44,
    tracking: cameraTrackingMode(cameraId),
  };
}
