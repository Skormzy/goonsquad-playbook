import { describe, expect, it } from 'vitest';
import { canRenderVNext3D, VNEXT_3D_GATES, VNEXT_3D_RELEASE } from './productionReadiness';

describe('vNext 3D production gate', () => {
  it('fails closed until a production athlete is visually accepted', () => {
    expect(canRenderVNext3D()).toBe(false);
    expect(VNEXT_3D_RELEASE.acceptedForPublicRuntime).toBe(false);
    expect(VNEXT_3D_RELEASE.rejectedRuntime).toBe('legacy-generated-athlete');
  });

  it('does not unlock the full replay ahead of its asset gates', () => {
    expect(VNEXT_3D_GATES.map((gate) => gate.id)).toEqual([
      'athlete',
      'equipment',
      'movement',
      'replay',
    ]);
    expect(VNEXT_3D_GATES[0]?.status).toBe('accepted');
    expect(VNEXT_3D_GATES[1]).toMatchObject({ status: 'accepted', statusLabel: 'AUTHORED' });
    expect(VNEXT_3D_GATES[2]).toMatchObject({ status: 'accepted', statusLabel: 'CONTACT LOCKED' });
    expect(VNEXT_3D_GATES.at(-1)).toMatchObject({ status: 'review', statusLabel: 'RUNTIME REVIEW' });
  });
});
