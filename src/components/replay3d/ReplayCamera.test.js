import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rinkToWorld } from '../../replay3d/coords';
import { standardBreakout3dReplay } from '../../replay3d/data/standardBreakout3d';
import { sampleReplayAt } from '../../replay3d/timeline';
import { resolveReplayCameraFov, resolveReplayCameraFrame } from './ReplayCamera';
import { CAMERA_PRESETS } from './replayStyles';

function projectPoint(camera, point) {
  return point.clone().project(camera);
}

function buildCamera(frame, aspect, preset = CAMERA_PRESETS.broadcast) {
  const focus = rinkToWorld({ ...frame.ball.position, height: 0.72 });
  const cameraFrame = resolveReplayCameraFrame(preset, focus, aspect);
  const camera = new THREE.PerspectiveCamera(cameraFrame.fov, aspect, 0.1, 145);
  camera.position.fromArray(cameraFrame.position);
  camera.lookAt(new THREE.Vector3(...cameraFrame.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function projectedPlayerHeight(camera, player) {
  const worldBase = rinkToWorld({ ...player.position, height: 0.25 });
  const worldHead = rinkToWorld({ ...player.position, height: player.role === 'G' ? 1.9 : 2.05 });
  const projectedBase = projectPoint(camera, new THREE.Vector3(worldBase.x, worldBase.y, worldBase.z));
  const projectedHead = projectPoint(camera, new THREE.Vector3(worldHead.x, worldHead.y, worldHead.z));

  return Math.abs(projectedHead.y - projectedBase.y);
}

describe('ReplayCamera broadcast framing', () => {
  it('keeps all 12 players inside the default replay frame on desktop and mobile aspects', () => {
    const sampleTimes = [0, 2.2, 4.4, 6.6, standardBreakout3dReplay.duration];
    const aspects = [1.81, 1.48, 1.2, 0.83, 0.73];

    for (const time of sampleTimes) {
      const frame = sampleReplayAt(standardBreakout3dReplay, time);
      for (const aspect of aspects) {
        const camera = buildCamera(frame, aspect);
        for (const player of frame.players) {
          const worldBase = rinkToWorld({ ...player.position, height: 0.25 });
          const worldHead = rinkToWorld({ ...player.position, height: player.role === 'G' ? 1.9 : 2.05 });
          const projectedBase = projectPoint(camera, new THREE.Vector3(worldBase.x, worldBase.y, worldBase.z));
          const projectedHead = projectPoint(camera, new THREE.Vector3(worldHead.x, worldHead.y, worldHead.z));
          const lowerFrameBound = player.role === 'G' ? -0.9 : -0.98;

          expect(projectedBase.x, `${player.id} base x at ${time}s/aspect ${aspect}`).toBeGreaterThanOrEqual(-1.04);
          expect(projectedBase.x, `${player.id} base x at ${time}s/aspect ${aspect}`).toBeLessThanOrEqual(1.04);
          expect(projectedBase.y, `${player.id} base y at ${time}s/aspect ${aspect}`).toBeGreaterThanOrEqual(lowerFrameBound);
          expect(projectedBase.y, `${player.id} base y at ${time}s/aspect ${aspect}`).toBeLessThanOrEqual(1.04);
          expect(projectedHead.y, `${player.id} head y at ${time}s/aspect ${aspect}`).toBeGreaterThanOrEqual(-1.04);
          expect(projectedHead.y, `${player.id} head y at ${time}s/aspect ${aspect}`).toBeLessThanOrEqual(1.04);
        }
      }
    }
  });

  it('keeps the default broadcast frame tight enough that field players read as athletes', () => {
    const sampleTimes = [0, 2.2, 4.4, 6.6, standardBreakout3dReplay.duration];
    const aspects = [1.81, 1.48, 1.2, 0.83, 0.73];

    for (const time of sampleTimes) {
      const frame = sampleReplayAt(standardBreakout3dReplay, time);
      for (const aspect of aspects) {
        const camera = buildCamera(frame, aspect);
        const fieldPlayerHeights = frame.players
          .filter((player) => player.role !== 'G')
          .map((player) => projectedPlayerHeight(camera, player));

        expect(
          Math.min(...fieldPlayerHeights),
          `minimum field-player projection at ${time}s/aspect ${aspect}`,
        ).toBeGreaterThanOrEqual(aspect < 0.78 ? 0.062 : aspect < 1 ? 0.069 : 0.075);
      }
    }
  });

  it('widens the broadcast fov only on tall mobile screens so the tight camera does not clip players', () => {
    expect(resolveReplayCameraFov(CAMERA_PRESETS.broadcast, 1.81)).toBe(CAMERA_PRESETS.broadcast.fov);
    expect(resolveReplayCameraFov(CAMERA_PRESETS.broadcast, 0.73)).toBeGreaterThan(CAMERA_PRESETS.broadcast.fov + 5);
    expect(resolveReplayCameraFov(CAMERA_PRESETS.bench, 0.73)).toBe(CAMERA_PRESETS.bench.fov);
    expect(resolveReplayCameraFov(CAMERA_PRESETS.player, 1.81)).toBe(CAMERA_PRESETS.player.fov);
    expect(resolveReplayCameraFov(CAMERA_PRESETS.player, 0.73)).toBeGreaterThan(CAMERA_PRESETS.player.fov + 2);
  });

  it('keeps all 12 players visible in the bench review camera at the player-read moment', () => {
    const frame = sampleReplayAt(standardBreakout3dReplay, 4.6);
    const aspects = [1.81, 0.83];

    for (const aspect of aspects) {
      const camera = buildCamera(frame, aspect, CAMERA_PRESETS.bench);
      for (const player of frame.players) {
        const worldBase = rinkToWorld({ ...player.position, height: 0.25 });
        const worldHead = rinkToWorld({ ...player.position, height: player.role === 'G' ? 1.9 : 2.05 });
        const projectedBase = projectPoint(camera, new THREE.Vector3(worldBase.x, worldBase.y, worldBase.z));
        const projectedHead = projectPoint(camera, new THREE.Vector3(worldHead.x, worldHead.y, worldHead.z));

        expect(projectedBase.x, `${player.id} base x/aspect ${aspect}`).toBeGreaterThanOrEqual(-1.06);
        expect(projectedBase.x, `${player.id} base x/aspect ${aspect}`).toBeLessThanOrEqual(1.06);
        expect(projectedBase.y, `${player.id} base y/aspect ${aspect}`).toBeGreaterThanOrEqual(-1.06);
        expect(projectedBase.y, `${player.id} base y/aspect ${aspect}`).toBeLessThanOrEqual(1.06);
        expect(projectedHead.y, `${player.id} head y/aspect ${aspect}`).toBeGreaterThanOrEqual(-1.06);
        expect(projectedHead.y, `${player.id} head y/aspect ${aspect}`).toBeLessThanOrEqual(1.06);
      }
    }
  });

  it('keeps all 12 players visible in the player-read close camera at the player-read moment', () => {
    const frame = sampleReplayAt(standardBreakout3dReplay, 4.6);
    const aspects = [1.81, 0.83];

    for (const aspect of aspects) {
      const camera = buildCamera(frame, aspect, CAMERA_PRESETS.player);
      for (const player of frame.players) {
        const worldBase = rinkToWorld({ ...player.position, height: 0.25 });
        const worldHead = rinkToWorld({ ...player.position, height: player.role === 'G' ? 1.9 : 2.05 });
        const projectedBase = projectPoint(camera, new THREE.Vector3(worldBase.x, worldBase.y, worldBase.z));
        const projectedHead = projectPoint(camera, new THREE.Vector3(worldHead.x, worldHead.y, worldHead.z));

        expect(projectedBase.x, `${player.id} base x/aspect ${aspect}`).toBeGreaterThanOrEqual(-1.08);
        expect(projectedBase.x, `${player.id} base x/aspect ${aspect}`).toBeLessThanOrEqual(1.08);
        expect(projectedBase.y, `${player.id} base y/aspect ${aspect}`).toBeGreaterThanOrEqual(-1.08);
        expect(projectedBase.y, `${player.id} base y/aspect ${aspect}`).toBeLessThanOrEqual(1.08);
        expect(projectedHead.y, `${player.id} head y/aspect ${aspect}`).toBeGreaterThanOrEqual(-1.08);
        expect(projectedHead.y, `${player.id} head y/aspect ${aspect}`).toBeLessThanOrEqual(1.08);
      }
    }
  });

  it('keeps the player-read camera tight enough for field-player gear review', () => {
    const frame = sampleReplayAt(standardBreakout3dReplay, 4.6);
    const camera = buildCamera(frame, 1.81, CAMERA_PRESETS.player);
    const fieldPlayerHeights = frame.players
      .filter((player) => player.role !== 'G')
      .map((player) => projectedPlayerHeight(camera, player));

    expect(Math.min(...fieldPlayerHeights)).toBeGreaterThanOrEqual(0.145);
    expect(CAMERA_PRESETS.player.fov).toBeLessThanOrEqual(30);
  });

  it('keeps the bench camera tight enough for close field-player review', () => {
    const frame = sampleReplayAt(standardBreakout3dReplay, 4.6);
    const desktopCamera = buildCamera(frame, 1.81, CAMERA_PRESETS.bench);
    const mobileCamera = buildCamera(frame, 0.83, CAMERA_PRESETS.bench);
    const desktopFieldPlayerHeights = frame.players
      .filter((player) => player.role !== 'G')
      .map((player) => projectedPlayerHeight(desktopCamera, player));
    const mobileFieldPlayerHeights = frame.players
      .filter((player) => player.role !== 'G')
      .map((player) => projectedPlayerHeight(mobileCamera, player));

    expect(Math.min(...desktopFieldPlayerHeights)).toBeGreaterThanOrEqual(0.105);
    expect(Math.min(...mobileFieldPlayerHeights)).toBeGreaterThanOrEqual(0.095);
    expect(CAMERA_PRESETS.bench.fov).toBeLessThanOrEqual(50);
  });

  it('keeps both goalies clear of the bench camera stage edges', () => {
    const frame = sampleReplayAt(standardBreakout3dReplay, 4.6);
    const aspects = [1.81, 0.83];

    for (const aspect of aspects) {
      const camera = buildCamera(frame, aspect, CAMERA_PRESETS.bench);
      for (const player of frame.players.filter((candidate) => candidate.role === 'G')) {
        const worldBase = rinkToWorld({ ...player.position, height: 0.25 });
        const worldHead = rinkToWorld({ ...player.position, height: 1.9 });
        const projectedBase = projectPoint(camera, new THREE.Vector3(worldBase.x, worldBase.y, worldBase.z));
        const projectedHead = projectPoint(camera, new THREE.Vector3(worldHead.x, worldHead.y, worldHead.z));

        expect(projectedBase.y, `${player.id} base y/aspect ${aspect}`).toBeGreaterThanOrEqual(-0.9);
        expect(projectedHead.y, `${player.id} head y/aspect ${aspect}`).toBeLessThanOrEqual(0.98);
      }
    }
  });

});
