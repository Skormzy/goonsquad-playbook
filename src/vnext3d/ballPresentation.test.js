import { describe, expect, it } from 'vitest';
import {
  ballLocatorRadii,
  ballMotionStreakWidth,
  ballRenderSampleTime,
} from './ballPresentation';

describe('3D ball presentation', () => {
  it('keeps the locator restrained at game distance and readable from overhead', () => {
    expect(ballLocatorRadii('broadcast')).toEqual([0.14, 0.22]);
    expect(ballLocatorRadii('bench')).toEqual([0.16, 0.25]);
    expect(ballLocatorRadii('player')).toEqual([0.16, 0.25]);
    expect(ballLocatorRadii('overhead')).toEqual([0.32, 0.46]);
  });

  it('falls back to the restrained broadcast locator', () => {
    expect(ballLocatorRadii('unknown')).toEqual([0.14, 0.22]);
  });

  it('shows a short streak only while the authoritative ball is freely in flight', () => {
    expect(ballMotionStreakWidth({ segmentType: 'carry', stickContactWeight: 1 })).toBe(0);
    expect(ballMotionStreakWidth({ segmentType: 'board-pass', stickContactWeight: 0.4 })).toBe(0);
    expect(ballMotionStreakWidth({ segmentType: 'board-pass', stickContactWeight: 0 })).toBe(1);
    expect(ballMotionStreakWidth({
      segmentType: 'board-pass',
      stickContactWeight: 0,
      boardPhase: 'impact',
    })).toBe(1.25);
  });

  it('samples the canonical replay at render cadence without running ahead after a stall', () => {
    expect(ballRenderSampleTime({
      publishedTime: 3.4,
      elapsedSeconds: 0.016,
      playbackRate: 2,
      duration: 8.8,
    })).toBeCloseTo(3.432, 6);
    expect(ballRenderSampleTime({
      publishedTime: 3.4,
      elapsedSeconds: 1,
      playbackRate: 2,
      duration: 8.8,
    })).toBeCloseTo(3.9, 6);
    expect(ballRenderSampleTime({
      publishedTime: 8.7,
      elapsedSeconds: 0.2,
      playbackRate: 1,
      duration: 8.8,
    })).toBe(8.8);
    expect(ballRenderSampleTime({
      publishedTime: 4.6,
      elapsedSeconds: 0.2,
      playbackRate: 0,
      duration: 8.8,
    })).toBe(4.6);
  });
});
