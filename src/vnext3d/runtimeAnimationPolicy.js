export function runtimeAnimationTransitionMode({
  hasPreviousAction,
  hasAuthoredBridge,
  playbackRate,
}) {
  if (hasAuthoredBridge) return 'authored';
  if (hasPreviousAction && playbackRate > 0) return 'blend';
  return 'immediate';
}
