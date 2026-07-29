import { describe, expect, it } from 'vitest';
import { CAMERA_PRESETS, REPLAY_COLORS } from './replayStyles';

function hexToRgb01(hex) {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16) / 255,
    g: Number.parseInt(value.slice(2, 4), 16) / 255,
    b: Number.parseInt(value.slice(4, 6), 16) / 255,
  };
}

describe('3D replay surface palette', () => {
  it('uses a muted sport-court base instead of a bright ice-white floor', () => {
    const floor = hexToRgb01(REPLAY_COLORS.floor);
    const channelAverage = (floor.r + floor.g + floor.b) / 3;

    expect(channelAverage).toBeLessThanOrEqual(0.74);
    expect(floor.g).toBeGreaterThanOrEqual(floor.r);
    expect(Math.abs(floor.g - floor.b)).toBeLessThanOrEqual(0.08);
  });

  it('keeps the player-read camera tighter than broadcast while preserving context', () => {
    const playerCamera = CAMERA_PRESETS.player;
    const broadcastCamera = CAMERA_PRESETS.broadcast;
    const distance = Math.hypot(
      playerCamera.position[0] - playerCamera.target[0],
      playerCamera.position[1] - playerCamera.target[1],
      playerCamera.position[2] - playerCamera.target[2],
    );
    const broadcastDistance = Math.hypot(
      broadcastCamera.position[0] - broadcastCamera.target[0],
      broadcastCamera.position[1] - broadcastCamera.target[1],
      broadcastCamera.position[2] - broadcastCamera.target[2],
    );

    expect(playerCamera.fov).toBeLessThanOrEqual(35);
    expect(distance).toBeLessThanOrEqual(28);
    expect(distance).toBeLessThan(broadcastDistance * 0.58);
  });

  it('frames the broadcast replay from the near end without clipping the home goalie', () => {
    const broadcastCamera = CAMERA_PRESETS.broadcast;

    expect(broadcastCamera.position[0]).toBeLessThanOrEqual(-7);
    expect(broadcastCamera.position[1]).toBeGreaterThanOrEqual(28);
    expect(broadcastCamera.position[2]).toBeLessThanOrEqual(-54);
    expect(broadcastCamera.target[2]).toBeLessThanOrEqual(-6.5);
    expect(broadcastCamera.fov).toBeGreaterThanOrEqual(34.4);
    expect(broadcastCamera.fov).toBeLessThanOrEqual(35.5);
  });
});
