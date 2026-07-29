const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function phaseAnchors(scene, phaseCount) {
  if (!scene || phaseCount <= 0) return [];
  if (scene.sourcePhaseTimes?.length === phaseCount) return scene.sourcePhaseTimes;
  if (phaseCount === 1) return [0];

  return Array.from({ length: phaseCount }, (_, index) => (
    scene.duration * index / (phaseCount - 1)
  ));
}

export function clampPhase(phase, phaseCount) {
  if (phaseCount <= 0) return 0;
  const parsed = Number.isFinite(Number(phase)) ? Math.trunc(Number(phase)) : 0;
  return clamp(parsed, 0, phaseCount - 1);
}

export function sceneTimeForPhase(scene, phase, phaseCount) {
  if (!scene) return 0;
  const anchors = phaseAnchors(scene, phaseCount);
  return anchors[clampPhase(phase, phaseCount)] ?? 0;
}

export function scenePhaseForTime(scene, time, phaseCount) {
  if (!scene || phaseCount <= 0) return 0;
  const anchors = phaseAnchors(scene, phaseCount);
  const clampedTime = clamp(Number(time) || 0, 0, scene.duration);
  let phase = 0;

  anchors.forEach((anchor, index) => {
    if (clampedTime >= anchor) phase = index;
  });

  return phase;
}

export function createSynchronizedPlayback({
  scene,
  phaseCount,
  requestedPhase,
  requestedTime,
}) {
  if (scene && Number.isFinite(requestedTime)) {
    const time = clamp(requestedTime, 0, scene.duration);
    return {
      phase: scenePhaseForTime(scene, time, phaseCount),
      time,
    };
  }

  const phase = clampPhase(requestedPhase, phaseCount);
  return {
    phase,
    time: sceneTimeForPhase(scene, phase, phaseCount),
  };
}

export function synchronizedPlaybackReducer(state, action) {
  if (action.type === 'reset') return { phase: 0, time: 0 };

  if (action.type === 'phase') {
    const requested = typeof action.value === 'function'
      ? action.value(state.phase)
      : action.value;
    const phase = clampPhase(requested, action.phaseCount);
    return {
      phase,
      time: sceneTimeForPhase(action.scene, phase, action.phaseCount),
    };
  }

  if (action.type === 'time') {
    if (!action.scene) return state;
    const requested = typeof action.value === 'function'
      ? action.value(state.time)
      : action.value;
    const time = clamp(Number(requested) || 0, 0, action.scene.duration);
    return {
      phase: scenePhaseForTime(action.scene, time, action.phaseCount),
      time,
    };
  }

  return state;
}
