const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function point(position, fallback = [0, 0, 0]) {
  if (!Array.isArray(position)) return fallback;
  return position.map((value, index) => (Number.isFinite(value) ? value : fallback[index]));
}

export const CAMERA_TRACKING_RATE = 4.6;

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

export function productionCameraPose(
  cameraId,
  { portrait = false, focusPlayerPosition, ballPosition } = {},
) {
  const [focusX, , focusZ] = point(focusPlayerPosition);
  const ballX = Number.isFinite(ballPosition?.x) ? ballPosition.x : 0;
  const ballZ = Number.isFinite(ballPosition?.z) ? ballPosition.z : 0;
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
    return {
      position: [focusX, portrait ? 8.4 : 7.2, focusZ - (portrait ? 16.5 : 12.4)],
      target: [focusX, 0.9, focusZ + (portrait ? 1 : 1.8)],
      fov: portrait ? 48 : 42,
      tracking: cameraTrackingMode(cameraId),
    };
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
