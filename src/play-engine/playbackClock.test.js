import { describe, expect, it } from 'vitest';
import {
  PLAYBACK_STATE_PUBLISH_INTERVAL_MS,
  REPLAY_3D_STATE_PUBLISH_INTERVAL_MS,
  replayTimeFromMonotonicClock,
} from './playbackClock';

describe('monotonic replay clock', () => {
  it('does not discard elapsed replay time after a delayed render frame', () => {
    expect(replayTimeFromMonotonicClock({
      startReplayTime: 1.2,
      startWallTime: 1000,
      wallTime: 1750,
      speed: 2,
      duration: 8.8,
    })).toBeCloseTo(2.7);
  });

  it('clamps at the authored replay duration', () => {
    expect(replayTimeFromMonotonicClock({
      startReplayTime: 8,
      startWallTime: 1000,
      wallTime: 2000,
      speed: 1,
      duration: 8.8,
    })).toBe(8.8);
  });

  it('publishes state often enough for controls while leaving rendering imperative', () => {
    expect(PLAYBACK_STATE_PUBLISH_INTERVAL_MS).toBeCloseTo(33.333, 2);
    expect(REPLAY_3D_STATE_PUBLISH_INTERVAL_MS).toBe(50);
  });
});
