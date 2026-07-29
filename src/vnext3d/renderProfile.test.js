import { describe, expect, it } from 'vitest';
import { productionRenderProfile, summarizeFrameIntervals } from './renderProfile';

describe('vNext 3D render profiles', () => {
  it('uses an efficient one-pixel-ratio mobile profile', () => {
    expect(productionRenderProfile('mobile')).toEqual({
      id: 'mobile-efficient',
      dpr: [1, 1],
      antialias: false,
      ballSegments: [16, 10],
    });
  });

  it('scales quality deliberately for tablet and desktop', () => {
    expect(productionRenderProfile('tablet')).toMatchObject({
      id: 'tablet-balanced',
      dpr: [1, 1.25],
      antialias: true,
    });
    expect(productionRenderProfile('desktop')).toMatchObject({
      id: 'desktop-high',
      dpr: [1, 1.5],
      antialias: true,
    });
  });

  it('fails safely to the desktop profile for an unknown layout', () => {
    expect(productionRenderProfile('unknown')).toBe(productionRenderProfile('desktop'));
  });

  it('summarizes measured render intervals without accepting invalid samples', () => {
    expect(summarizeFrameIntervals([16, 16.5, 17, 34, 500, Number.NaN])).toEqual({
      sampleCount: 4,
      meanMs: 20.88,
      p95Ms: 34,
      maxMs: 34,
      under30FpsFrames: 1,
    });
    expect(summarizeFrameIntervals([])).toBeNull();
  });
});
