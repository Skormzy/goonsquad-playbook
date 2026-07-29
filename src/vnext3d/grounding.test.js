import { describe, expect, it } from 'vitest';
import {
  createFrameSampleBudget,
  groundCorrectionForMinimum,
  groundTelemetryPhaseOffset,
  NORMAL_GROUND_SAMPLE_INTERVAL_SECONDS,
  summarizeGroundContacts,
} from './grounding';

describe('production athlete grounding', () => {
  it('corrects floor penetration beyond the four millimeter tolerance', () => {
    expect(groundCorrectionForMinimum(-0.003)).toBe(0);
    expect(groundCorrectionForMinimum(-0.021)).toBe(0.021);
    expect(groundCorrectionForMinimum(-0.2)).toBe(0.08);
  });

  it('does not pull natural running flight phases down to the floor', () => {
    expect(groundCorrectionForMinimum(0.026, undefined, true)).toBe(0);
  });

  it('lowers planted poses to the shoe-clearance tolerance', () => {
    expect(groundCorrectionForMinimum(0.026)).toBe(-0.022);
    expect(groundCorrectionForMinimum(0.08)).toBe(-0.04);
    expect(groundCorrectionForMinimum(0.065, undefined, false, 0.05)).toBe(-0.05);
  });

  it('summarizes corrected shoe clearance across the full roster', () => {
    const contacts = Array.from({ length: 12 }, (_, index) => ({
      minimumY: index === 0 ? -0.002 : index * 0.001,
      correction: index === 0 ? 0.019 : 0,
      shoeCount: 2,
    }));

    expect(summarizeGroundContacts(contacts)).toEqual({
      groundSampleCount: 12,
      groundMinimumMm: -2,
      groundMaximumMm: 11,
      groundMaximumCorrectionMm: 19,
      groundedPlayerCount: 12,
    });
  });

  it('staggers recurring shoe telemetry without delaying the initial sample', () => {
    const playerIds = [
      'US_LW', 'US_C', 'US_RW', 'US_LD', 'US_RD', 'US_G',
      'OPP_LW', 'OPP_C', 'OPP_RW', 'OPP_LD', 'OPP_RD', 'OPP_G',
    ];
    const offsets = playerIds.map((playerId) => groundTelemetryPhaseOffset(playerId, 0.125));

    expect(new Set(offsets).size).toBe(12);
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...offsets)).toBeLessThan(0.125);
    expect(groundTelemetryPhaseOffset('US_LD', 0)).toBe(0);
  });

  it('caps catch-up telemetry per render frame without dropping overdue work', () => {
    const budget = createFrameSampleBudget(2);

    expect([1, 2, 3].map(() => budget.claim(40))).toEqual([true, true, false]);
    expect([1, 2, 3].map(() => budget.claim(41))).toEqual([true, true, false]);
  });

  it('keeps normal tactical grounding telemetry below the render-frame rate', () => {
    expect(NORMAL_GROUND_SAMPLE_INTERVAL_SECONDS).toBe(0.25);
  });
});
