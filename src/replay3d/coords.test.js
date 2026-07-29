import { describe, expect, it } from 'vitest';
import { rinkToWorld, RINK_WORLD } from './coords';

describe('rinkToWorld', () => {
  it('maps the vertical 2D rink orientation into a 3D court', () => {
    expect(rinkToWorld({ x: 50, y: 6 })).toMatchObject({ x: 0, z: -26.82 });
    expect(rinkToWorld({ x: 50, y: 94 })).toMatchObject({ x: 0, z: 26.82 });
    expect(rinkToWorld({ x: 0, y: 50 })).toMatchObject({ x: -15.24, z: 0 });
    expect(rinkToWorld({ x: 100, y: 50 })).toMatchObject({ x: 15.24, z: 0 });
  });

  it('keeps the 3D surface dimensions stable for all replay components', () => {
    expect(RINK_WORLD.width).toBe(30.48);
    expect(RINK_WORLD.length).toBe(60.96);
    expect(RINK_WORLD.cornerRadius).toBe(8.53);
  });
}
);
