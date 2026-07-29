export const PLAYBACK_SPEEDS = Object.freeze([0.25, 0.5, 1]);

export function normalizePlaybackSpeed(value, fallback = 1) {
  const parsed = Number(value);
  return PLAYBACK_SPEEDS.includes(parsed) ? parsed : fallback;
}
