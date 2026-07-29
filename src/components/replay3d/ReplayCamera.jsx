import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const targetVector = new THREE.Vector3();
const positionVector = new THREE.Vector3();
const lookAtVector = new THREE.Vector3();
const followPositionVector = new THREE.Vector3();
const followTargetVector = new THREE.Vector3();

export function cameraArrayWithFollow(base, focus, strength = {}) {
  if (!focus) return base;
  const focusX = THREE.MathUtils.clamp(focus.x, -5.5, 5.5);
  const focusZ = THREE.MathUtils.clamp(focus.z, -8.2, 4.2);
  return [
    base[0] + focusX * (strength.x ?? 0),
    base[1],
    base[2] + focusZ * (strength.z ?? 0),
  ];
}

export function resolveReplayCameraFov(preset, aspect = 1.81) {
  const baseFov = preset.fov;
  const narrowScreen = THREE.MathUtils.clamp((0.9 - aspect) / 0.2, 0, 1);
  if (preset.followBall) return baseFov + narrowScreen * 8.0;
  return baseFov + narrowScreen * (preset.mobileFovBoost ?? 0);
}

export function resolveReplayCameraFrame(preset, focus, aspect = 1.81) {
  if (!preset.followBall) {
    return {
      position: preset.position,
      target: preset.target,
      fov: resolveReplayCameraFov(preset, aspect),
    };
  }

  return {
    position: cameraArrayWithFollow(preset.position, focus, preset.followPosition),
    target: cameraArrayWithFollow(preset.target, focus, preset.followTarget),
    fov: resolveReplayCameraFov(preset, aspect),
  };
}

export default function ReplayCamera({ preset, focus }) {
  const { camera } = useThree();

  useFrame(() => {
    const frame = resolveReplayCameraFrame(preset, focus, camera.aspect);
    followPositionVector.fromArray(frame.position);
    followTargetVector.fromArray(frame.target);
    positionVector.copy(followPositionVector);
    targetVector.copy(followTargetVector);
    camera.position.lerp(positionVector, 0.08);
    if (frame.fov && camera.fov !== frame.fov) {
      // Three.js cameras are mutable render objects; the replay camera eases fov like position.
      // eslint-disable-next-line react-hooks/immutability
      camera.fov = THREE.MathUtils.lerp(camera.fov, frame.fov, 0.08);
      camera.updateProjectionMatrix();
    }
    lookAtVector.lerp(targetVector, 0.1);
    camera.lookAt(lookAtVector);
  });

  return null;
}
