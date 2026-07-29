export const COURT_WIDTH_METERS = 24;
export const COURT_LENGTH_METERS = 48;
export const FIELD_JOG_SPEED_THRESHOLD_MPS = 0.5;
export const FIELD_SPRINT_SPEED_THRESHOLD_MPS = 2.2;

export function rinkDistanceMeters(from, to) {
  const xMeters = ((to.x - from.x) / 100) * COURT_WIDTH_METERS;
  const zMeters = ((to.y - from.y) / 100) * COURT_LENGTH_METERS;
  return Math.hypot(xMeters, zMeters);
}

export function fieldMovementAction(speedMps) {
  if (speedMps > FIELD_SPRINT_SPEED_THRESHOLD_MPS) {
    return { action: 'sprint-forward', actionIntensity: 1 };
  }
  if (speedMps > FIELD_JOG_SPEED_THRESHOLD_MPS) {
    return {
      action: 'jog-forward',
      actionIntensity: Math.min(1, Math.max(0.35, speedMps / FIELD_SPRINT_SPEED_THRESHOLD_MPS)),
    };
  }
  return { action: 'idle-ready', actionIntensity: 0 };
}
