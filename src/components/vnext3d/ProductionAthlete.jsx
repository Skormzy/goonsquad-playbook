import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AnimationMixer,
  Box3,
  LoopOnce,
  LoopRepeat,
  Vector3,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  createFrameSampleBudget,
  GROUNDING_RESPONSE_RATE,
  groundCorrectionForMinimum,
  groundTelemetryPhaseOffset,
  NORMAL_GROUND_SAMPLE_INTERVAL_SECONDS,
} from '../../vnext3d/grounding';
import { isTacticalDistanceMeshVisible } from '../../vnext3d/tacticalVisibility';
import { runtimeAnimationTransitionMode } from '../../vnext3d/runtimeAnimationPolicy';

const LOCOMOTION_CLIPS = new Set(['jog', 'sprint', 'goalie-shuffle']);
const FLIGHT_CLIPS = new Set(['jog', 'sprint']);
const DEFAULT_BLEND_SECONDS = 0.18;
const AUTHORED_CONTACT_MAX_LOWERING_METERS = 0.052;
const AUTHORED_CONTACT_GROUNDING_MULTIPLIER = 8;
const AUTHORED_TRANSITION_MAX_STEP_SECONDS = 1 / 30;
const WORLD_TRANSFORM_RESPONSE_RATE = 32;
const AUTHORED_TRANSITION_RUNTIME_SECONDS = Object.freeze({
  'jog-to-sprint-ik': 0.3333,
});
const normalGroundTelemetryBudget = createFrameSampleBudget(1);

export default function ProductionAthlete({
  assetUrl,
  actionPhase,
  authoredTransitionClip = null,
  blendSeconds = DEFAULT_BLEND_SECONDS,
  clipName,
  contactActive,
  contactPoints,
  groundContacts,
  groundSampleInterval = NORMAL_GROUND_SAMPLE_INTERVAL_SECONDS,
  hideJerseyNumber = false,
  motionPhaseCycles,
  motionCyclesPerSecond = 0,
  onClipTransition,
  playbackRate,
  playbackTime,
  playerId,
  poseSamples,
  position,
  rotation,
  transitionEventsRef,
  worldAngularVelocity,
  worldVelocity,
}) {
  const source = useGLTF(assetUrl);
  const model = useMemo(() => clone(source.scene), [source.scene]);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const contactBounds = useMemo(() => new Box3(), []);
  const contactWorld = useMemo(() => new Vector3(), []);
  const worldPositionTarget = useMemo(() => new Vector3(), []);
  const groundBounds = useMemo(() => new Box3(), []);
  const footBounds = useMemo(() => ({ left: new Box3(), right: new Box3() }), []);
  const footCenters = useMemo(() => ({ left: new Vector3(), right: new Vector3() }), []);
  const shoeBounds = useMemo(() => new Box3(), []);
  const activeClipRef = useRef(null);
  const activeClipNameRef = useRef(null);
  const authoredTransitionWindowRef = useRef(null);
  const contactBallRef = useRef(null);
  const correctionGroupRef = useRef(null);
  const athleteGroupRef = useRef(null);
  const shoeMeshesRef = useRef([]);
  const poseBonesRef = useRef({ leftHand: null, rightHand: null });
  const transitionRef = useRef(null);
  const desiredGroundCorrectionRef = useRef(0);
  const groundSampleElapsedRef = useRef(Number.POSITIVE_INFINITY);
  const initialGroundSampleRef = useRef(true);
  const groundSamplePhaseOffset = useMemo(
    () => groundTelemetryPhaseOffset(playerId, groundSampleInterval),
    [groundSampleInterval, playerId],
  );
  const playbackTimeRef = useRef(playbackTime);
  const worldMotionRef = useRef({
    angularVelocity: worldAngularVelocity,
    cycles: motionPhaseCycles,
    cyclesPerSecond: motionCyclesPerSecond,
    position,
    rotation,
    sampleElapsed: 0,
    velocity: worldVelocity,
  });

  useEffect(() => {
    playbackTimeRef.current = playbackTime;
  }, [playbackTime]);

  useEffect(() => {
    worldMotionRef.current = {
      angularVelocity: worldAngularVelocity,
      cycles: motionPhaseCycles,
      cyclesPerSecond: motionCyclesPerSecond,
      position,
      rotation,
      sampleElapsed: 0,
      velocity: worldVelocity,
    };
  }, [motionCyclesPerSecond, motionPhaseCycles, position, rotation, worldAngularVelocity, worldVelocity]);

  useEffect(() => {
    contactBallRef.current = model.getObjectByName('GS_Contact_Ball');
    poseBonesRef.current = {
      leftHand: model.getObjectByName('CC_Base_L_Hand'),
      rightHand: model.getObjectByName('CC_Base_R_Hand'),
    };
    shoeMeshesRef.current = [];
    model.traverse((object) => {
      if (object.name === 'GS_Contact_Ball') {
        object.visible = false;
        return;
      }
      if (!object.isMesh) return;
      if (hideJerseyNumber && /jersey_back_number/i.test(object.name)) {
        object.visible = false;
        return;
      }
      if (!isTacticalDistanceMeshVisible(object.name)) {
        object.visible = false;
        return;
      }
      if (/shoe|sole/i.test(object.name)) shoeMeshesRef.current.push(object);
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = false;
    });
  }, [hideJerseyNumber, model]);

  useEffect(() => {
    const requestedClip = source.animations.find((candidate) => candidate.name === clipName)
      ?? source.animations.find((candidate) => candidate.name === 'ready')
      ?? source.animations[0];
    if (!requestedClip) return undefined;

    const previous = activeClipRef.current;
    const previousClipName = activeClipNameRef.current;
    if (previous && previousClipName === clipName && previous.getRoot() === model) return undefined;
    const authoredWindow = authoredTransitionWindowRef.current;
    if (
      previousClipName === 'sprint'
      && clipName === 'jog'
      && authoredWindow
      && playbackTimeRef.current >= authoredWindow.start - 0.05
      && playbackTimeRef.current <= authoredWindow.end + 0.05
    ) return undefined;
    if (clipName === 'jog' && authoredWindow && playbackTimeRef.current < authoredWindow.start - 0.05) {
      authoredTransitionWindowRef.current = null;
    }
    const bridgeClip = previousClipName === 'jog'
      && clipName === 'sprint'
      && authoredTransitionClip
      && playbackRate > 0
      ? source.animations.find((candidate) => candidate.name === authoredTransitionClip)
      : null;
    const selectedClip = bridgeClip ?? requestedClip;
    const next = mixer.clipAction(selectedClip, model);
    if (previous === next) return undefined;
    const transitionMode = runtimeAnimationTransitionMode({
      hasPreviousAction: Boolean(previous),
      hasAuthoredBridge: Boolean(bridgeClip),
      playbackRate,
    });

    if (previous && activeClipNameRef.current) {
      const event = {
        playerId,
        from: previousClipName,
        to: clipName,
        replayTime: Number(playbackTimeRef.current.toFixed(3)),
        authoredClip: bridgeClip?.name ?? null,
      };
      transitionEventsRef?.current?.push(event);
      onClipTransition?.(event);
    }

    if (transitionMode === 'authored') {
      previous?.stop();
      const target = mixer.clipAction(requestedClip, model);
      const duration = Math.max(bridgeClip.duration, 0.001);
      const runtimeDuration = AUTHORED_TRANSITION_RUNTIME_SECONDS[bridgeClip.name] ?? duration;
      const worldMotion = worldMotionRef.current;
      target.reset().setLoop(LoopRepeat, Infinity).setEffectiveWeight(0).play();
      next.reset().setLoop(LoopOnce, 1).setEffectiveWeight(1).play();
      next.clampWhenFinished = true;
      transitionRef.current = {
        kind: 'authored',
        from: next,
        to: target,
        elapsed: 0,
        startPlaybackTime: playbackTimeRef.current,
        startPosition: athleteGroupRef.current?.position.toArray() ?? [...worldMotion.position],
        startRotation: athleteGroupRef.current?.rotation.y ?? worldMotion.rotation,
        worldAngularVelocity: worldMotion.angularVelocity,
        worldVelocity: [...worldMotion.velocity],
        duration,
        runtimeDuration,
      };
      authoredTransitionWindowRef.current = {
        start: playbackTimeRef.current,
        end: playbackTimeRef.current + runtimeDuration,
      };
    } else if (transitionMode === 'blend') {
      next.reset().setLoop(LoopRepeat, Infinity).setEffectiveWeight(previous ? 0 : 1).play();
      transitionRef.current = { kind: 'blend', from: previous, to: next, elapsed: 0 };
    } else {
      previous?.stop();
      next.reset().setLoop(LoopRepeat, Infinity).setEffectiveWeight(1).play();
      transitionRef.current = null;
    }
    activeClipRef.current = next;
    activeClipNameRef.current = clipName;
    return undefined;
  }, [authoredTransitionClip, clipName, mixer, model, onClipTransition, playbackRate, playerId, source.animations, transitionEventsRef]);

  useFrame((state, delta) => {
    let action = activeClipRef.current;
    if (!action) return;

    const transition = transitionRef.current;
    const athleteGroup = athleteGroupRef.current;
    if (athleteGroup && transition?.kind !== 'authored') {
      const worldMotion = worldMotionRef.current;
      worldMotion.sampleElapsed = Math.min(
        worldMotion.sampleElapsed + delta * playbackRate,
        0.25,
      );
      worldPositionTarget.set(
        worldMotion.position[0] + worldMotion.velocity[0] * worldMotion.sampleElapsed,
        worldMotion.position[1] + worldMotion.velocity[1] * worldMotion.sampleElapsed,
        worldMotion.position[2] + worldMotion.velocity[2] * worldMotion.sampleElapsed,
      );
      const targetRotation = worldMotion.rotation
        + worldMotion.angularVelocity * worldMotion.sampleElapsed;
      const transformBlend = playbackRate > 0
        ? 1 - Math.exp(-WORLD_TRANSFORM_RESPONSE_RATE * delta)
        : 1;
      athleteGroup.position.lerp(worldPositionTarget, transformBlend);
      const rotationDelta = Math.atan2(
        Math.sin(targetRotation - athleteGroup.rotation.y),
        Math.cos(targetRotation - athleteGroup.rotation.y),
      );
      athleteGroup.rotation.y += rotationDelta * transformBlend;
    }
    let authoredContact = null;
    if (transition?.kind === 'authored') {
      transition.elapsed = Math.min(
        transition.elapsed + Math.min(delta, AUTHORED_TRANSITION_MAX_STEP_SECONDS) * playbackRate,
        transition.runtimeDuration,
      );
      const progress = transition.elapsed / transition.runtimeDuration;
      if (athleteGroup) {
        athleteGroup.position.set(
          transition.startPosition[0] + transition.worldVelocity[0] * transition.elapsed,
          transition.startPosition[1] + transition.worldVelocity[1] * transition.elapsed,
          transition.startPosition[2] + transition.worldVelocity[2] * transition.elapsed,
        );
        athleteGroup.rotation.set(
          0,
          transition.startRotation + transition.worldAngularVelocity * transition.elapsed,
          0,
        );
      }
      authoredContact = {
        clipName: authoredTransitionClip,
        progress,
        side: progress <= 0.8 ? 'right' : progress <= 0.9 ? 'left' : null,
      };
      transition.from.time = progress * transition.duration;
      if (progress >= 1) {
        transition.from.stop();
        transition.to.setEffectiveWeight(1);
        activeClipRef.current = transition.to;
        action = transition.to;
        transitionRef.current = null;
      }
    }

    if (transition?.kind === 'blend') {
      transition.elapsed = Math.min(transition.elapsed + delta, blendSeconds);
      const progress = transition.elapsed / blendSeconds;
      const eased = progress * progress * (3 - 2 * progress);
      transition.from.setEffectiveWeight(1 - eased);
      transition.to.setEffectiveWeight(eased);
      if (progress >= 1) {
        transition.from.stop();
        transitionRef.current = null;
      }
    }

    if (transition?.kind !== 'authored' || transitionRef.current === null) {
      const duration = Math.max(action.getClip().duration, 0.001);
      const animationTime = LOCOMOTION_CLIPS.has(clipName)
        ? (
          worldMotionRef.current.cycles
          + worldMotionRef.current.cyclesPerSecond * worldMotionRef.current.sampleElapsed
        ) * duration
        : actionPhase == null
          ? playbackTime
          : actionPhase * duration;
      action.time = ((animationTime % duration) + duration) % duration;
    }

    mixer.update(0);
    const correctionGroup = correctionGroupRef.current;
    athleteGroup?.updateMatrixWorld(true);

    const { leftHand, rightHand } = poseBonesRef.current;
    if (leftHand && rightHand) {
      const left = leftHand.getWorldPosition(footCenters.left);
      const right = rightHand.getWorldPosition(footCenters.right);
      poseSamples.set(playerId, {
        actionTime: action.time,
        effectiveWeight: action.getEffectiveWeight(),
        handSpan: left.distanceTo(right),
      });
    }

    groundSampleElapsedRef.current += delta;
    const groundSampleDue = groundSampleInterval <= 0
      || groundSampleElapsedRef.current >= groundSampleInterval;
    const shouldMeasureGround = groundSampleDue && (
      groundSampleInterval <= 0
      || normalGroundTelemetryBudget.claim(state.gl.info.render.frame)
    );
    if (shouldMeasureGround) {
      groundSampleElapsedRef.current = initialGroundSampleRef.current
        ? -groundSamplePhaseOffset
        : 0;
      initialGroundSampleRef.current = false;
      groundBounds.makeEmpty();
      footBounds.left.makeEmpty();
      footBounds.right.makeEmpty();
      for (const shoe of shoeMeshesRef.current) {
        shoe.skeleton?.update();
        shoe.computeBoundingBox?.();
        if (!shoe.boundingBox) continue;
        shoeBounds.copy(shoe.boundingBox).applyMatrix4(shoe.matrixWorld);
        groundBounds.union(shoeBounds);
        const side = /left/i.test(shoe.name) ? 'left' : /right/i.test(shoe.name) ? 'right' : null;
        if (side) footBounds[side].union(shoeBounds);
      }
    }

    if (shouldMeasureGround && !groundBounds.isEmpty() && correctionGroup) {
      const floorY = position[1] ?? 0;
      const currentCorrection = correctionGroup.position.y;
      const rawMinimumY = groundBounds.min.y - floorY - currentCorrection;
      const authoredBounds = authoredContact?.side ? footBounds[authoredContact.side] : null;
      const correctionMinimumY = authoredBounds && !authoredBounds.isEmpty()
        ? authoredBounds.min.y - floorY - currentCorrection
        : rawMinimumY;
      desiredGroundCorrectionRef.current = groundCorrectionForMinimum(
        correctionMinimumY,
        undefined,
        authoredContact?.side ? false : FLIGHT_CLIPS.has(clipName),
        authoredContact?.side ? AUTHORED_CONTACT_MAX_LOWERING_METERS : undefined,
      );
      const feet = {};
      for (const side of ['left', 'right']) {
        const bounds = footBounds[side];
        if (bounds.isEmpty()) continue;
        const center = bounds.getCenter(footCenters[side]);
        feet[side] = {
          x: center.x,
          z: center.z,
          minimumY: bounds.min.y - floorY - currentCorrection,
        };
      }
      groundContacts.set(playerId, {
        authoredContact,
        minimumY: rawMinimumY,
        correction: currentCorrection,
        feet,
        shoeCount: shoeMeshesRef.current.length,
      });
    }

    if (correctionGroup) {
      const groundingRate = GROUNDING_RESPONSE_RATE * (
        authoredContact?.side ? AUTHORED_CONTACT_GROUNDING_MULTIPLIER : 1
      );
      const groundingBlend = 1 - Math.exp(-groundingRate * delta);
      const previousCorrection = correctionGroup.position.y;
      correctionGroup.position.y += (
        desiredGroundCorrectionRef.current - correctionGroup.position.y
      ) * groundingBlend;
      const correctionDelta = correctionGroup.position.y - previousCorrection;
      const previousContact = groundContacts.get(playerId);
      if (previousContact && Math.abs(correctionDelta) > 0.000001) {
        groundContacts.set(playerId, {
          ...previousContact,
          correction: correctionGroup.position.y,
          minimumY: previousContact.minimumY + correctionDelta,
          feet: Object.fromEntries(Object.entries(previousContact.feet).map(([side, foot]) => [
            side,
            { ...foot, minimumY: foot.minimumY + correctionDelta },
          ])),
        });
      }
      correctionGroup.updateMatrixWorld(true);
    }

    if (contactActive && contactBallRef.current) {
      contactBallRef.current.skeleton?.update();
      contactBallRef.current.visible = true;
      contactBounds.makeEmpty().setFromObject(contactBallRef.current).getCenter(contactWorld);
      contactBallRef.current.visible = false;
      contactPoints.set(playerId, contactWorld);
    }
  }, -1);

  useEffect(() => () => {
    activeClipRef.current = null;
    activeClipNameRef.current = null;
    authoredTransitionWindowRef.current = null;
    transitionRef.current = null;
    contactPoints.delete(playerId);
    groundContacts.delete(playerId);
    poseSamples.delete(playerId);
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  }, [contactPoints, groundContacts, mixer, model, playerId, poseSamples]);

  return (
    <group ref={athleteGroupRef} position={position} rotation={[0, rotation, 0]}>
      <group ref={correctionGroupRef}>
        <primitive object={model} dispose={null} />
      </group>
    </group>
  );
}
