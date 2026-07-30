const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const PHASE_TRANSITION_DEFAULT_RATE = 1;

export function phaseTransitionDuration(
  fromTime,
  toTime,
  playbackRate = PHASE_TRANSITION_DEFAULT_RATE,
) {
  const replayDistance = Math.abs(Number(toTime) - Number(fromTime));
  const requestedRate = Number(playbackRate);
  const safeRate = Number.isFinite(requestedRate) && requestedRate > 0
    ? requestedRate
    : PHASE_TRANSITION_DEFAULT_RATE;
  return replayDistance / safeRate * 1000;
}

export function phaseTransitionProgress(progress) {
  return clamp(Number(progress) || 0, 0, 1);
}

export function phaseTransitionTime(fromTime, toTime, progress) {
  const eased = phaseTransitionProgress(progress);
  return Number(fromTime) + (Number(toTime) - Number(fromTime)) * eased;
}
