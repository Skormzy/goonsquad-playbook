const clamp = (value, minimum, maximum) => (
  Math.min(maximum, Math.max(minimum, value))
);

const ANCHOR_EPSILON_SECONDS = 0.035;

export const GUIDED_PHASE_HOLD_SECONDS = 2;
export const GUIDED_READ_MIN_SECONDS = GUIDED_PHASE_HOLD_SECONDS;
export const GUIDED_READ_MAX_SECONDS = GUIDED_PHASE_HOLD_SECONDS;

function phaseAnchors(scene) {
  if (!scene) return [];
  const source = Array.isArray(scene.sourcePhaseTimes)
    ? scene.sourcePhaseTimes
    : [0];
  return source
    .map((time) => clamp(Number(time) || 0, 0, scene.duration))
    .filter((time, index, values) => index === 0 || time > values[index - 1]);
}

function phaseIndexForTime(anchors, time) {
  let phaseIndex = 0;
  anchors.forEach((anchor, index) => {
    if (time >= anchor - ANCHOR_EPSILON_SECONDS) phaseIndex = index;
  });
  return phaseIndex;
}

function anchorIndexAtTime(anchors, time) {
  return anchors.findIndex((anchor) => (
    Math.abs(anchor - time) <= ANCHOR_EPSILON_SECONDS
  ));
}

export function guidedReadSeconds() {
  return GUIDED_PHASE_HOLD_SECONDS;
}

export function createGuidedReplayState(
  scene,
  requestedTime = 0,
  { skipCurrentHold = false } = {},
) {
  if (!scene) {
    return {
      time: 0,
      mode: 'complete',
      phaseIndex: 0,
      holdRemaining: 0,
      heldAnchorIndex: -1,
    };
  }

  const anchors = phaseAnchors(scene);
  const time = clamp(Number(requestedTime) || 0, 0, scene.duration);
  if (time >= scene.duration - ANCHOR_EPSILON_SECONDS) {
    return {
      time: scene.duration,
      mode: 'complete',
      phaseIndex: Math.max(0, anchors.length - 1),
      holdRemaining: 0,
      heldAnchorIndex: Math.max(0, anchors.length - 1),
    };
  }

  const anchorIndex = anchorIndexAtTime(anchors, time);
  if (anchorIndex >= 0) {
    return {
      time: anchors[anchorIndex],
      mode: skipCurrentHold ? 'watch' : 'read',
      phaseIndex: anchorIndex,
      holdRemaining: skipCurrentHold ? 0 : guidedReadSeconds(),
      heldAnchorIndex: anchorIndex,
    };
  }

  return {
    time,
    mode: 'watch',
    phaseIndex: phaseIndexForTime(anchors, time),
    holdRemaining: 0,
    heldAnchorIndex: -1,
  };
}

export function advanceGuidedReplay(state, {
  scene,
  deltaSeconds,
  speed = 1,
}) {
  if (!scene || state.mode === 'complete') return state;

  let wallSeconds = Math.max(0, Number(deltaSeconds) || 0);
  const replaySpeed = Math.max(0.01, Number(speed) || 1);
  let next = { ...state };

  if (next.mode === 'read') {
    if (wallSeconds < next.holdRemaining) {
      return {
        ...next,
        holdRemaining: next.holdRemaining - wallSeconds,
      };
    }
    wallSeconds -= next.holdRemaining;
    next = {
      ...next,
      mode: 'watch',
      holdRemaining: 0,
    };
  }

  if (wallSeconds <= 0) return next;

  const anchors = phaseAnchors(scene);
  const nextAnchorIndex = anchors.findIndex((anchor, index) => (
    index > next.heldAnchorIndex
    && anchor > next.time + ANCHOR_EPSILON_SECONDS
  ));
  const targetTime = nextAnchorIndex >= 0
    ? anchors[nextAnchorIndex]
    : scene.duration;
  const requestedTime = next.time + wallSeconds * replaySpeed;

  if (requestedTime >= targetTime - ANCHOR_EPSILON_SECONDS) {
    if (nextAnchorIndex >= 0) {
      return {
        time: targetTime,
        mode: 'read',
        phaseIndex: nextAnchorIndex,
        holdRemaining: guidedReadSeconds(),
        heldAnchorIndex: nextAnchorIndex,
      };
    }
    return {
      time: scene.duration,
      mode: 'complete',
      phaseIndex: Math.max(0, anchors.length - 1),
      holdRemaining: 0,
      heldAnchorIndex: Math.max(0, anchors.length - 1),
    };
  }

  return {
    ...next,
    time: requestedTime,
    mode: 'watch',
    phaseIndex: phaseIndexForTime(anchors, requestedTime),
  };
}
