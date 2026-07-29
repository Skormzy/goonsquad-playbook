export const PLAYBACK_STATE_PUBLISH_INTERVAL_MS = 1000 / 30;
export const REPLAY_3D_STATE_PUBLISH_INTERVAL_MS = 1000 / 20;

export function replayTimeFromMonotonicClock({
  startReplayTime,
  startWallTime,
  wallTime,
  speed,
  duration,
}) {
  const elapsedSeconds = Math.max(0, wallTime - startWallTime) / 1000;
  return Math.min(duration, startReplayTime + elapsedSeconds * speed);
}
