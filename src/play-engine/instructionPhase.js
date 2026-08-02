import { clampPhase, sceneTimeForPhase } from './synchronizePlayback';

export const INSTRUCTION_PHASE_EPSILON_SECONDS = 0.001;

export function resolveInstructionPhase({
  currentPhase = 0,
  phaseTransitionTarget = null,
  phaseCount = 0,
  playbackTime = 0,
  scene = null,
} = {}) {
  const count = Math.max(0, Math.trunc(Number(phaseCount) || 0));
  if (count === 0) return 0;

  const renderedPhase = clampPhase(currentPhase, count);
  const hasTransitionTarget = phaseTransitionTarget !== null
    && phaseTransitionTarget !== undefined
    && Number.isFinite(Number(phaseTransitionTarget));

  if (hasTransitionTarget) {
    return clampPhase(phaseTransitionTarget, count);
  }

  if (!scene || renderedPhase >= count - 1) return renderedPhase;

  const time = Number(playbackTime);
  if (!Number.isFinite(time)) return renderedPhase;

  const phaseAnchor = sceneTimeForPhase(scene, renderedPhase, count);
  return time > phaseAnchor + INSTRUCTION_PHASE_EPSILON_SECONDS
    ? renderedPhase + 1
    : renderedPhase;
}
