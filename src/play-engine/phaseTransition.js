const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const PHASE_TRANSITION_DEFAULT_RATE = 1;
export const PHASE_TRANSITION_RATE_MULTIPLIER = 1.2;
export const PHASE_NAVIGATION_BURST_WINDOW_MS = 600;

export function shouldSkipPhaseTransition({
  activeTransition = false,
  lastRequestAt = Number.NEGATIVE_INFINITY,
  requestedAt = 0,
} = {}) {
  const previous = Number(lastRequestAt);
  const current = Number(requestedAt);
  const repeatedQuickly = Number.isFinite(previous)
    && Number.isFinite(current)
    && current >= previous
    && current - previous <= PHASE_NAVIGATION_BURST_WINDOW_MS;

  return activeTransition || repeatedQuickly;
}

export function steppedPhaseTarget({
  currentPhase = 0,
  transitionTarget = null,
  delta = 0,
  phaseCount = 0,
} = {}) {
  const count = Math.max(0, Math.round(Number(phaseCount) || 0));
  if (count === 0) return 0;

  const hasTransitionTarget = transitionTarget !== null
    && transitionTarget !== undefined
    && Number.isFinite(Number(transitionTarget));
  const base = hasTransitionTarget ? Number(transitionTarget) : Number(currentPhase);
  const next = Math.round((Number.isFinite(base) ? base : 0) + (Number(delta) || 0));
  return clamp(next, 0, count - 1);
}

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
  return replayDistance / (safeRate * PHASE_TRANSITION_RATE_MULTIPLIER) * 1000;
}

export function phaseTransitionProgress(progress) {
  return clamp(Number(progress) || 0, 0, 1);
}

export function phaseTransitionTime(fromTime, toTime, progress) {
  const eased = phaseTransitionProgress(progress);
  return Number(fromTime) + (Number(toTime) - Number(fromTime)) * eased;
}
