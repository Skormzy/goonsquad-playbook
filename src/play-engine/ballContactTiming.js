const clamp01 = (value) => Math.min(1, Math.max(0, value));

export const BALL_RELEASE_CONTACT_SECONDS = 0.16;
export const BALL_RECEIVE_CONTACT_SECONDS = 0.22;
export const BALL_RECEIVE_PREP_SECONDS = 0.5;

export function ballTimingProgressWindow(seconds, segmentDuration) {
  return clamp01(seconds / Math.max(segmentDuration ?? 0, 0.001));
}
