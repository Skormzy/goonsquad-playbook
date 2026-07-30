import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rinkSource = readFileSync(new URL('./RinkSVG.jsx', import.meta.url), 'utf8');
const courtSource = readFileSync(
  new URL('./vnext3d/ProductionCourt.jsx', import.meta.url),
  'utf8',
);

describe('special-teams presentation', () => {
  it('keeps one fixed 2D rink coordinate system for every lineup', () => {
    expect(rinkSource).toContain('viewBox={`0 0 ${W} ${H}`}');
    expect(rinkSource).toContain('style={{ maxWidth: W }}');
    expect(rinkSource).not.toContain('viewWidth');
    expect(rinkSource).not.toContain('PenaltyBox2D');
    expect(rinkSource).not.toContain('rink-penalty-box');
  });

  it('keeps one fixed 3D court without penalty-box geometry', () => {
    expect(courtSource).toContain('export default function ProductionCourt({ theme =');
    expect(courtSource).not.toContain('PenaltyBox');
    expect(courtSource).not.toContain('penaltyBoxTeams');
    expect(courtSource).not.toContain('rink-side-penalty-boxes');
  });
});
