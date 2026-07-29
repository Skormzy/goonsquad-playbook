import { describe, expect, it } from 'vitest';
import { runtimeAnimationTransitionMode } from './runtimeAnimationPolicy';

describe('production runtime animation policy', () => {
  it('snaps a paused seek to the exact authored clip pose', () => {
    expect(runtimeAnimationTransitionMode({
      hasPreviousAction: true,
      hasAuthoredBridge: false,
      playbackRate: 0,
    })).toBe('immediate');
  });

  it('blends ordinary clip changes only during live playback', () => {
    expect(runtimeAnimationTransitionMode({
      hasPreviousAction: true,
      hasAuthoredBridge: false,
      playbackRate: 1,
    })).toBe('blend');
  });

  it('keeps an accepted authored bridge ahead of the generic policy', () => {
    expect(runtimeAnimationTransitionMode({
      hasPreviousAction: true,
      hasAuthoredBridge: true,
      playbackRate: 1,
    })).toBe('authored');
  });
});
