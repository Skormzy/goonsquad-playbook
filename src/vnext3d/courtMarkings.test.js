import { describe, expect, it } from 'vitest';
import { neutralFaceoffDots, PRODUCTION_COURT_MARKINGS } from './courtMarkings';

describe('production court markings', () => {
  it('uses the shared 24 by 48 meter ball hockey court scale', () => {
    expect(PRODUCTION_COURT_MARKINGS).toMatchObject({
      widthMeters: 24,
      lengthMeters: 48,
      cornerRadiusMeters: 3.8,
      goalLineZ: 21.12,
    });
  });

  it('keeps zone, goal, and neutral faceoff markings symmetric', () => {
    expect(PRODUCTION_COURT_MARKINGS.zoneLineZ).toBeCloseTo(8.64, 4);
    expect(PRODUCTION_COURT_MARKINGS.neutralFaceoffZ).toBeCloseTo(7.14, 4);
    const dots = neutralFaceoffDots();
    expect(dots).toHaveLength(4);
    expect([...new Set(dots.map(({ x }) => Math.sign(x)))]).toEqual([-1, 1]);
    expect([...new Set(dots.map(({ z }) => Math.sign(z)))]).toEqual([-1, 1]);
    dots.forEach(({ x, z }) => {
      expect(Math.abs(x)).toBeCloseTo(PRODUCTION_COURT_MARKINGS.faceoffX, 4);
      expect(Math.abs(z)).toBeCloseTo(PRODUCTION_COURT_MARKINGS.neutralFaceoffZ, 4);
    });
  });

  it('places each neutral dot between center and its blue line', () => {
    for (const dot of neutralFaceoffDots()) {
      expect(Math.abs(dot.z)).toBeLessThan(PRODUCTION_COURT_MARKINGS.zoneLineZ);
      expect(Math.abs(dot.x)).toBeLessThan(PRODUCTION_COURT_MARKINGS.widthMeters / 2);
    }
  });
});
