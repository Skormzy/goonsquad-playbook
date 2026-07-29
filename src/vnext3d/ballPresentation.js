const LOCATOR_RADII_BY_CAMERA = Object.freeze({
  broadcast: Object.freeze([0.14, 0.22]),
  bench: Object.freeze([0.16, 0.25]),
  player: Object.freeze([0.16, 0.25]),
  overhead: Object.freeze([0.32, 0.46]),
});

const FREE_FLIGHT_SEGMENTS = new Set(['pass', 'board-pass']);
export const MAX_BALL_RENDER_EXTRAPOLATION_SECONDS = 0.25;

export function ballLocatorRadii(cameraId) {
  return LOCATOR_RADII_BY_CAMERA[cameraId] ?? LOCATOR_RADII_BY_CAMERA.broadcast;
}

export function ballMotionStreakWidth(ball) {
  const freeFlight = FREE_FLIGHT_SEGMENTS.has(ball?.segmentType)
    && (ball?.stickContactWeight ?? 0) <= 0.02;
  if (!freeFlight) return 0;
  return ball?.boardPhase === 'impact' ? 1.25 : 1;
}

export function ballRenderSampleTime({
  publishedTime,
  elapsedSeconds,
  playbackRate,
  duration,
}) {
  const safePublishedTime = Number.isFinite(publishedTime) ? publishedTime : 0;
  const safeElapsed = Math.min(
    Math.max(Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0, 0),
    MAX_BALL_RENDER_EXTRAPOLATION_SECONDS,
  );
  const safeRate = Math.max(Number.isFinite(playbackRate) ? playbackRate : 0, 0);
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : safePublishedTime;
  return Math.min(Math.max(safePublishedTime + safeElapsed * safeRate, 0), safeDuration);
}
