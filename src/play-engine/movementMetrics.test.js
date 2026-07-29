import { describe, expect, it } from 'vitest';
import {
  FIELD_SPRINT_SPEED_THRESHOLD_MPS,
  fieldMovementAction,
  rinkDistanceMeters,
} from './movementMetrics';

describe('shared ball hockey movement metrics', () => {
  it('uses the physical 24 m by 48 m court instead of isotropic percentages', () => {
    expect(rinkDistanceMeters({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(24);
    expect(rinkDistanceMeters({ x: 0, y: 0 }, { x: 0, y: 100 })).toBe(48);
  });

  it('selects sprint for the flagship upper-speed quartile', () => {
    expect(fieldMovementAction(FIELD_SPRINT_SPEED_THRESHOLD_MPS)).toMatchObject({ action: 'jog-forward' });
    expect(fieldMovementAction(FIELD_SPRINT_SPEED_THRESHOLD_MPS + 0.01)).toEqual({
      action: 'sprint-forward',
      actionIntensity: 1,
    });
  });
});
