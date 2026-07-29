import { describe, expect, it } from 'vitest';
import {
  measureAuthoredContactSliding,
  measureFootDisplacement,
  measurePlantedFootSliding,
  summarizeFootSlideSamples,
} from './footSliding';

describe('production planted-foot sliding telemetry', () => {
  it('measures world movement only while the same foot remains planted', () => {
    const previous = new Map([
      ['US_LD:left', { x: 1, z: 2, planted: true }],
      ['US_LD:right', { x: 1.2, z: 2, planted: false }],
    ]);
    const contacts = new Map([
      ['US_LD', {
        feet: {
          left: { x: 1.003, z: 2.004, minimumY: 0.004 },
          right: { x: 1.205, z: 2, minimumY: 0.004 },
        },
      }],
    ]);

    const result = measurePlantedFootSliding(contacts.entries(), previous);
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]).toBeCloseTo(5, 6);
    expect(result.nextFeet.get('US_LD:right')).toMatchObject({ planted: true });
  });

  it('excludes airborne shoes from planted-foot samples', () => {
    const previous = new Map([['US_LW:left', { x: 0, z: 0, planted: true }]]);
    const contacts = new Map([['US_LW', {
      feet: { left: { x: 0.04, z: 0, minimumY: 0.022 } },
    }]]);

    expect(measurePlantedFootSliding(contacts.entries(), previous).samples).toEqual([]);
  });

  it('measures authored shoe motion during flight for transition review', () => {
    const previous = new Map([['US_LD:left', { x: 0, z: 0 }]]);
    const contacts = new Map([['US_LD', {
      feet: { left: { x: 0.03, z: 0.04, minimumY: 0.08 } },
    }]]);

    expect(measureFootDisplacement(contacts.entries(), previous).samples[0]).toBeCloseTo(50, 6);
  });

  it('measures only the authored stance shoe without relaxing planted clearance', () => {
    const previous = new Map([[
      'US_LD:jog-to-sprint-ik:right',
      { x: 1, z: 2, planted: true },
    ]]);
    const contacts = new Map([['US_LD', {
      authoredContact: { clipName: 'jog-to-sprint-ik', side: 'right', progress: 0.4 },
      feet: {
        left: { x: 4, z: 5, minimumY: 0.004 },
        right: { x: 1.003, z: 2.004, minimumY: 0.012 },
      },
    }]]);

    const result = measureAuthoredContactSliding(contacts.entries(), previous);
    expect(result).toMatchObject({
      clearanceSamples: [12],
      contactSampleCount: 1,
      oppositeClearanceSamples: [4],
      plantedContactSampleCount: 1,
    });
    expect(result.samples[0]).toBeCloseTo(5, 6);

    const airborne = new Map([['US_LD', {
      authoredContact: { clipName: 'jog-to-sprint-ik', side: 'right', progress: 0.4 },
      feet: { right: { x: 1.006, z: 2.008, minimumY: 0.016 } },
    }]]);
    expect(measureAuthoredContactSliding(airborne.entries(), result.nextFeet)).toMatchObject({
      contactSampleCount: 1,
      plantedContactSampleCount: 0,
      samples: [],
    });
  });

  it('summarizes the planted-foot distribution in millimeters per frame', () => {
    expect(summarizeFootSlideSamples([1, 2, 3, 4, 5])).toEqual({
      footSlideSampleCount: 5,
      footSlideMeanMm: 3,
      footSlideP95Mm: 5,
      footSlideMaxMm: 5,
    });
  });
});
