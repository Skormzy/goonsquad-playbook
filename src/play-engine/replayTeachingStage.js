import { sceneTimeForPhase } from './synchronizePlayback';

export function replayTeachingStage({
  currentPhase,
  isPlaying,
  isTransitioning,
  phaseCount,
  playbackTime,
  scene,
}) {
  if (!scene) return 'ready';
  if (isTransitioning) return 'watch';
  if (playbackTime >= scene.duration - 0.035) return 'complete';
  if (!isPlaying) return 'ready';
  const anchor = sceneTimeForPhase(scene, currentPhase, phaseCount);
  return Math.abs(playbackTime - anchor) <= 0.055 ? 'read' : 'watch';
}
