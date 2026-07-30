import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AnimationMixer,
  Box3,
  Euler,
  LoopRepeat,
  Quaternion,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { isTacticalDistanceMeshVisible } from '../vnext3d/tacticalVisibility';
import {
  stabilizedKneeFlexionRadians,
  TACTICAL_KNEE_CLIPS,
} from './kneeStabilization';

const ACTION_BLEND_SECONDS = 0.16;

const TacticalAthlete = forwardRef(function TacticalAthlete({
  assetUrl,
  presentationScale = 1,
}, ref) {
  const source = useGLTF(assetUrl);
  const model = useMemo(() => clone(source.scene), [source.scene]);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const kneeConstraints = useMemo(() => {
    const constraints = [];
    model.traverse((object) => {
      if (!object.isBone || !/^CC_Base_[LR]_Calf$/.test(object.name)) return;
      constraints.push({
        bone: object,
        rest: object.quaternion.clone(),
        restInverse: object.quaternion.clone().invert(),
        relative: new Quaternion(),
        euler: new Euler(0, 0, 0, 'XYZ'),
      });
    });
    return constraints;
  }, [model]);
  const athleteRef = useRef(null);
  const groundOffsetRef = useRef(null);
  const activeActionRef = useRef(null);
  const activeClipRef = useRef(null);
  const latestSampleRef = useRef(null);

  useEffect(() => {
    model.traverse((object) => {
      if (object.name === 'GS_Contact_Ball') {
        object.visible = false;
        return;
      }
      if (!object.isMesh) return;
      object.visible = isTacticalDistanceMeshVisible(object.name);
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = false;
    });

    const readyClip = source.animations.find((clip) => clip.name === 'ready')
      ?? source.animations.find((clip) => clip.name === 'goalie-ready')
      ?? source.animations[0];
    if (readyClip) {
      const readyAction = mixer.clipAction(readyClip, model);
      readyAction.reset().setLoop(LoopRepeat, Infinity).play();
      readyAction.setEffectiveTimeScale(0);
      readyAction.time = 0;
      mixer.update(0);

      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model);
      if (!bounds.isEmpty() && Number.isFinite(bounds.min.y) && groundOffsetRef.current) {
        groundOffsetRef.current.position.y = Math.min(0.35, Math.max(-0.35, -bounds.min.y));
      }
      readyAction.stop();
      mixer.update(0);
    }
  }, [mixer, model, presentationScale, source.animations]);

  useImperativeHandle(ref, () => ({
    applySample(sample) {
      latestSampleRef.current = sample;
      const athlete = athleteRef.current;
      if (!athlete) return;

      athlete.position.set(...sample.worldPosition);
      athlete.rotation.set(0, sample.worldRotation, 0);

      const requestedClip = source.animations.find((clip) => clip.name === sample.clipName)
        ?? source.animations.find((clip) => clip.name === (sample.role === 'G' ? 'goalie-ready' : 'ready'))
        ?? source.animations[0];
      if (!requestedClip || activeClipRef.current === requestedClip.name) return;

      const previous = activeActionRef.current;
      const next = mixer.clipAction(requestedClip, model);
      next.reset().setLoop(LoopRepeat, Infinity).setEffectiveTimeScale(0).play();
      if (previous && previous !== next) {
        previous.crossFadeTo(next, ACTION_BLEND_SECONDS, false);
      } else {
        next.setEffectiveWeight(1);
      }
      activeActionRef.current = next;
      activeClipRef.current = requestedClip.name;
    },
  }), [mixer, model, source.animations]);

  useFrame((_, delta) => {
    mixer.update(Math.min(delta, 0.05));
    const action = activeActionRef.current;
    const sample = latestSampleRef.current;
    if (!action || !sample) return;
    const duration = Math.max(action.getClip().duration, 0.001);
    const phase = ((sample.clipPhase % 1) + 1) % 1;
    action.time = phase * duration;
    mixer.update(0);

    if (TACTICAL_KNEE_CLIPS.has(sample.clipName)) {
      kneeConstraints.forEach(({ bone, euler, relative, rest, restInverse }) => {
        relative.copy(restInverse).multiply(bone.quaternion);
        euler.setFromQuaternion(relative, 'XYZ');
        euler.x = stabilizedKneeFlexionRadians(euler.x);
        relative.setFromEuler(euler);
        bone.quaternion.copy(rest).multiply(relative);
      });
    }
  }, -1);

  useEffect(() => () => {
    activeActionRef.current = null;
    activeClipRef.current = null;
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  }, [mixer, model]);

  return (
    <group ref={athleteRef}>
      <group ref={groundOffsetRef}>
        <group scale={presentationScale}>
          <primitive object={model} dispose={null} />
        </group>
      </group>
    </group>
  );
});

export default TacticalAthlete;
