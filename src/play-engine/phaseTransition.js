const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const PHASE_TRANSITION_MIN_MS = 420;
export const PHASE_TRANSITION_MAX_MS = 900;

export function phaseTransitionDuration(fromTime, toTime) {
  const replayDistance = Math.abs(Number(toTime) - Number(fromTime));
  return clamp(
    PHASE_TRANSITION_MIN_MS + replayDistance * 85,
    PHASE_TRANSITION_MIN_MS,
    PHASE_TRANSITION_MAX_MS,
  );
}

export function phaseTransitionProgress(progress) {
  const normalized = clamp(Number(progress) || 0, 0, 1);
  return normalized * normalized * normalized * (
    normalized * (normalized * 6 - 15) + 10
  );
}

export function phaseTransitionTime(fromTime, toTime, progress) {
  const eased = phaseTransitionProgress(progress);
  return Number(fromTime) + (Number(toTime) - Number(fromTime)) * eased;
}
