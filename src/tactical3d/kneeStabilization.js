const MAX_KNEE_FLEXION_RADIANS = 82 * Math.PI / 180;

export const TACTICAL_KNEE_CLIPS = new Set(['jog', 'sprint']);

export function stabilizedKneeFlexionRadians(relativeRotationX) {
  if (!Number.isFinite(relativeRotationX)) return 0;
  return -Math.min(Math.abs(relativeRotationX), MAX_KNEE_FLEXION_RADIANS);
}
