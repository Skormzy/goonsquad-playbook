export const PLAYBACK_SPEEDS = Object.freeze([0.5, 1, 1.5, 2]);

export function normalizePlaybackSpeed(value, fallback = 1) {
  const parsed = Number(value);
  return PLAYBACK_SPEEDS.includes(parsed) ? parsed : fallback;
}
