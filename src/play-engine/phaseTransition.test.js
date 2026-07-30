import { describe, expect, it } from 'vitest';
import {
  PHASE_NAVIGATION_BURST_WINDOW_MS,
  PHASE_TRANSITION_DEFAULT_RATE,
  PHASE_TRANSITION_RATE_MULTIPLIER,
  phaseTransitionDuration,
  phaseTransitionProgress,
  phaseTransitionTime,
  shouldSkipPhaseTransition,
  steppedPhaseTarget,
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

  it('animates one deliberate phase request but skips an active or rapid repeat', () => {
    expect(PHASE_NAVIGATION_BURST_WINDOW_MS).toBe(600);
    expect(shouldSkipPhaseTransition({
      activeTransition: false,
      lastRequestAt: Number.NEGATIVE_INFINITY,
      requestedAt: 1000,
    })).toBe(false);
    expect(shouldSkipPhaseTransition({
      activeTransition: true,
      lastRequestAt: 0,
      requestedAt: 5000,
    })).toBe(true);
    expect(shouldSkipPhaseTransition({
      activeTransition: false,
      lastRequestAt: 1000,
      requestedAt: 1500,
    })).toBe(true);
    expect(shouldSkipPhaseTransition({
      activeTransition: false,
      lastRequestAt: 1000,
      requestedAt: 1601,
    })).toBe(false);
  });

  it('steps rapid navigation from the intended destination instead of an intermediate frame', () => {
    expect(steppedPhaseTarget({
      currentPhase: 4,
      transitionTarget: null,
      delta: -1,
      phaseCount: 6,
    })).toBe(3);
    expect(steppedPhaseTarget({
      currentPhase: 4,
      transitionTarget: 3,
      delta: -1,
      phaseCount: 6,
    })).toBe(2);
    expect(steppedPhaseTarget({
      currentPhase: 4,
      transitionTarget: 0,
      delta: 1,
      phaseCount: 6,
    })).toBe(1);
    expect(steppedPhaseTarget({
      currentPhase: 2,
      transitionTarget: null,
      delta: -3,
      phaseCount: 6,
    })).toBe(0);
    expect(steppedPhaseTarget({
      currentPhase: 4,
      transitionTarget: null,
      delta: 8,
      phaseCount: 6,
    })).toBe(5);
  });
});
