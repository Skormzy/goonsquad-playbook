import { describe, expect, it } from 'vitest';
import {
  cameraInteractionPolicy,
  cameraTrackingMode,
  clampCameraTarget,
  productionCameraPose,
  stepOperatorCamera,
} from './cameraSystem';

describe('production 3D camera system', () => {
  it('tracks the ball while preserving a side-on landscape broadcast composition', () => {
    const pose = productionCameraPose('broadcast', {
      ballPosition: { x: -9.12, z: -2.4 },
    });

    expect(pose.tracking).toBe('action');
    expect(pose.position).toEqual([-26, 17, -4.432]);
    expect(pose.target[0]).toBeCloseTo(-0.456);
    expect(pose.target.slice(1)).toEqual([0.6, -2.432]);
    expect(Math.hypot(
      pose.position[0] - pose.target[0],
      pose.position[1] - pose.target[1],
      pose.position[2] - pose.target[2],
    )).toBeLessThan(55);
    expect(pose.fov).toBe(44);
  });

  it('keeps the overhead preset centered on the complete court', () => {
    const pose = productionCameraPose('overhead', {
      ballPosition: { x: -10, z: -20 },
    });

    expect(pose).toMatchObject({
      target: [0, 0, 0],
      tracking: 'full-court',
    });
    expect(pose.position[1]).toBeGreaterThanOrEqual(70);
    expect(Math.abs(pose.position[2])).toBeGreaterThanOrEqual(5);
    expect(pose.position[1] / Math.abs(pose.position[2])).toBeGreaterThan(10);
  });

  it('anchors the role camera to the selected athlete', () => {
    const pose = productionCameraPose('player', {
      focusPlayerPosition: [-4.5, 0, -8],
      ballPosition: { x: 7, z: 9 },
    });

    expect(pose.tracking).toBe('role');
    expect(pose.position[0]).toBe(-4.5);
    expect(pose.target).toEqual([-4.5, 0.9, -6.2]);
    expect(pose.position).toEqual([-4.5, 7.2, -20.4]);
    expect(pose.fov).toBe(42);
    expect(Math.hypot(
      pose.position[1] - pose.target[1],
      pose.position[2] - pose.target[2],
    )).toBeGreaterThan(15);
  });

  it('uses a centered portrait broadcast offset', () => {
    const pose = productionCameraPose('broadcast', {
      portrait: true,
      ballPosition: { x: 8, z: 20 },
    });

    expect(pose.position[0]).toBe(pose.target[0]);
    expect(pose.target[2]).toBeCloseTo(1.6);
    expect(pose.fov).toBe(40);
  });

  it('exposes stable tracking modes for runtime evidence', () => {
    expect(cameraTrackingMode('broadcast')).toBe('action');
    expect(cameraTrackingMode('bench')).toBe('action');
    expect(cameraTrackingMode('overhead')).toBe('full-court');
    expect(cameraTrackingMode('player')).toBe('role');
  });

  it.each(['broadcast', 'overhead', 'bench', 'player'])(
    'keeps free-look navigation available from the %s preset',
    (cameraId) => {
      expect(cameraInteractionPolicy(cameraId)).toMatchObject({
        enablePan: true,
        enableRotate: true,
        enableZoom: true,
      });
    },
  );

  it('bounds panning to the playable court envelope', () => {
    const policy = cameraInteractionPolicy('bench');
    expect(clampCameraTarget([80, -4, -90], policy)).toEqual([25, 0, -44]);
  });

  it('orbits around the current target without changing camera distance', () => {
    const policy = cameraInteractionPolicy('broadcast');
    const initialPosition = [22, 30, -38];
    const initialTarget = [0, 0, 0];
    const next = stepOperatorCamera(initialPosition, initialTarget, 'orbit-left', policy);

    expect(next.position).not.toEqual(initialPosition);
    expect(Math.hypot(...next.position)).toBeCloseTo(Math.hypot(...initialPosition), 5);
    expect(next.target).toEqual(initialTarget);
  });

  it('supports bounded keyboard and button dolly steps', () => {
    const policy = cameraInteractionPolicy('player');
    const pose = productionCameraPose('player', { focusPlayerPosition: [0, 0, 0] });
    const close = Array.from({ length: 16 }).reduce(
      (camera) => stepOperatorCamera(camera.position, camera.target, 'zoom-in', policy),
      { position: pose.position, target: pose.target },
    );
    const far = stepOperatorCamera(close.position, close.target, 'zoom-out', policy);

    expect(Math.hypot(
      close.position[0] - close.target[0],
      close.position[1] - close.target[1],
      close.position[2] - close.target[2],
    )).toBeCloseTo(policy.minDistance, 5);
    expect(Math.hypot(
      far.position[0] - far.target[0],
      far.position[1] - far.target[1],
      far.position[2] - far.target[2],
    )).toBeGreaterThan(policy.minDistance);
  });

  it('allows close athlete inspection without letting the overhead camera enter the court', () => {
    expect(cameraInteractionPolicy('player').minDistance).toBe(3.2);
    expect(cameraInteractionPolicy('bench').minDistance).toBe(3.2);
    expect(cameraInteractionPolicy('player', { portrait: true }).minDistance).toBe(3.8);
    expect(cameraInteractionPolicy('overhead').minDistance).toBe(5.5);
  });

  it('keeps portrait role review centered on the selected athlete with added context', () => {
    const pose = productionCameraPose('player', {
      portrait: true,
      focusPlayerPosition: [3, 0, 12],
    });

    expect(pose.target).toEqual([3, 0.9, 13]);
    expect(pose.position).toEqual([3, 8.4, -4.5]);
    expect(pose.fov).toBe(48);
  });

  it('widens portrait bench review around the tracked action', () => {
    const pose = productionCameraPose('bench', {
      portrait: true,
      ballPosition: { x: -6.7, z: 9.1 },
    });

    expect(pose.position).toEqual([-46, 28, 0]);
    expect(pose.fov).toBe(52);
    expect(Math.hypot(
      pose.position[0] - pose.target[0],
      pose.position[1] - pose.target[1],
      pose.position[2] - pose.target[2],
    )).toBeGreaterThan(52);
  });

  it('keeps landscape bench review elevated and centered for full-play context', () => {
    const pose = productionCameraPose('bench', {
      ballPosition: { x: -8, z: -20 },
    });

    expect(pose.position).toEqual([-32, 13, 0]);
    expect(pose.target).toEqual([-0.7, 0.85, -1.4]);
    expect(pose.fov).toBe(40);
  });
});
