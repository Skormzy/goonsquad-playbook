import { describe, expect, it } from 'vitest';
import { stabilizedKneeFlexionRadians } from './kneeStabilization';

describe('stabilizedKneeFlexionRadians', () => {
  it('keeps normal knee flexion and reflects hyperextension into the safe direction', () => {
    expect(stabilizedKneeFlexionRadians(-0.6)).toBeCloseTo(-0.6, 6);
    expect(stabilizedKneeFlexionRadians(0.6)).toBeCloseTo(-0.6, 6);
  });

  it('caps extreme retargeted calf rotation', () => {
    expect(stabilizedKneeFlexionRadians(Math.PI)).toBeCloseTo(-82 * Math.PI / 180, 6);
    expect(stabilizedKneeFlexionRadians(Number.NaN)).toBe(0);
  });
});
