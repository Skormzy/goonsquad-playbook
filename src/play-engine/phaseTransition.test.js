import { describe, expect, it } from 'vitest';
import {
  PHASE_TRANSITION_DEFAULT_RATE,
  PHASE_TRANSITION_RATE_MULTIPLIER,
  phaseTransitionDuration,
  phaseTransitionProgress,
  phaseTransitionTime,
} from './phaseTransition';

describe('phase transitions', () => {
  it('travels through authored replay time 20% faster than regular playback', () => {
    expect(PHASE_TRANSITION_DEFAULT_RATE).toBe(1);
    expect(PHASE_TRANSITION_RATE_MULTIPLIER).toBe(1.2);
    expect(phaseTransitionDuration(2, 5)).toBe(2500);
    expect(phaseTransitionDuration(8, 2)).toBe(5000);
    expect(phaseTransitionDuration(2, 5, 0.5)).toBe(5000);
    expect(phaseTransitionDuration(2, 5, 0.25)).toBe(10000);
  });

  it('uses linear progress so manual travel matches regular playback', () => {
    expect(phaseTransitionProgress(-1)).toBe(0);
    expect(phaseTransitionProgress(0)).toBe(0);
    expect(phaseTransitionProgress(0.25)).toBeCloseTo(0.25);
    expect(phaseTransitionProgress(0.5)).toBeCloseTo(0.5);
    expect(phaseTransitionProgress(1)).toBe(1);
    expect(phaseTransitionProgress(2)).toBe(1);
  });

  it('interpolates forward and backward travel continuously', () => {
    expect(phaseTransitionTime(2, 8, 0)).toBe(2);
    expect(phaseTransitionTime(2, 8, 0.5)).toBeCloseTo(5);
    expect(phaseTransitionTime(2, 8, 1)).toBe(8);
    expect(phaseTransitionTime(8, 2, 0.5)).toBeCloseTo(5);
  });

  it('advances 1.2 replay seconds per wall second at 1x', () => {
    const duration = phaseTransitionDuration(2, 8);
    const oneSecondProgress = 1000 / duration;
    expect(phaseTransitionTime(2, 8, oneSecondProgress)).toBeCloseTo(3.2);
  });
});
