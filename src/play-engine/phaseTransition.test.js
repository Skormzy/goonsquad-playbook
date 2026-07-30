import { describe, expect, it } from 'vitest';
import {
  PHASE_TRANSITION_MAX_MS,
  PHASE_TRANSITION_MIN_MS,
  phaseTransitionDuration,
  phaseTransitionProgress,
  phaseTransitionTime,
} from './phaseTransition';

describe('phase transitions', () => {
  it('uses a bounded duration for short and long phase seeks', () => {
    expect(phaseTransitionDuration(2, 2.1)).toBeGreaterThanOrEqual(PHASE_TRANSITION_MIN_MS);
    expect(phaseTransitionDuration(0, 120)).toBe(PHASE_TRANSITION_MAX_MS);
  });

  it('eases without overshooting either replay anchor', () => {
    expect(phaseTransitionProgress(-1)).toBe(0);
    expect(phaseTransitionProgress(0)).toBe(0);
    expect(phaseTransitionProgress(0.5)).toBeCloseTo(0.5);
    expect(phaseTransitionProgress(1)).toBe(1);
    expect(phaseTransitionProgress(2)).toBe(1);
  });

  it('interpolates forward and backward seeks continuously', () => {
    expect(phaseTransitionTime(2, 8, 0)).toBe(2);
    expect(phaseTransitionTime(2, 8, 0.5)).toBeCloseTo(5);
    expect(phaseTransitionTime(2, 8, 1)).toBe(8);
    expect(phaseTransitionTime(8, 2, 0.5)).toBeCloseTo(5);
  });
});
