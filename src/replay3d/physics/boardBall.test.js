import { describe, expect, it } from 'vitest';
import { calculateBoardBounce, sampleBoardPass } from './boardBall';

describe('calculateBoardBounce', () => {
  it('reflects a ball off the side boards with dampened outbound speed', () => {
    const bounce = calculateBoardBounce({
      incoming: { x: 24, y: 22 },
      impact: { x: 4, y: 30 },
      exitTarget: { x: 29, y: 42 },
      restitution: 0.68,
    });

    expect(bounce.path).toEqual([
      { x: 24, y: 22 },
      { x: 4, y: 30 },
      { x: 29, y: 42 },
    ]);
    expect(bounce.inboundDistance).toBeCloseTo(21.54, 2);
    expect(bounce.outboundDistance).toBeCloseTo(40.78, 2);
    expect(bounce.totalEffectiveDistance).toBeCloseTo(62.32, 2);
    expect(bounce.board).toBe('left');
    expect(bounce.speedDropRatio).toBe(0.68);
    expect(bounce.angleErrorDegrees).toBeLessThan(18);
    expect(bounce.validPhysics).toBe(true);
  });

  it('flags authored exits that do not resemble a realistic board rebound', () => {
    const bounce = calculateBoardBounce({
      incoming: { x: 24, y: 22 },
      impact: { x: 4, y: 30 },
      exitTarget: { x: 2, y: 48 },
      restitution: 0.68,
    });

    expect(bounce.board).toBe('left');
    expect(bounce.angleErrorDegrees).toBeGreaterThan(22);
    expect(bounce.validPhysics).toBe(false);
  });
});

describe('sampleBoardPass', () => {
  it('moves through the board impact before continuing to the receiver', () => {
    const pass = calculateBoardBounce({
      incoming: { x: 24, y: 22 },
      impact: { x: 4, y: 30 },
      exitTarget: { x: 29, y: 42 },
      restitution: 0.68,
    });

    expect(sampleBoardPass(pass, 0)).toMatchObject({ x: 24, y: 22 });
    expect(sampleBoardPass(pass, pass.impactT)).toMatchObject({ x: 4, y: 30 });
    expect(sampleBoardPass(pass, 1)).toMatchObject({ x: 29, y: 42 });
  });
});
