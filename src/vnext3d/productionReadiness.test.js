import { describe, expect, it } from 'vitest';
import { canRenderVNext3D, VNEXT_3D_GATES, VNEXT_3D_RELEASE } from './productionReadiness';

describe('vNext 3D production gate', () => {
  it('releases only the accepted tactical-distance runtime', () => {
    expect(canRenderVNext3D()).toBe(true);
    expect(VNEXT_3D_RELEASE.acceptedForPublicRuntime).toBe(true);
    expect(VNEXT_3D_RELEASE.rejectedRuntime).toBe('legacy-generated-athlete');
  });

  it('records every public replay gate as accepted', () => {
    expect(VNEXT_3D_GATES.map((gate) => gate.id)).toEqual([
      'athlete',
      'equipment',
      'movement',
      'replay',
    ]);
    expect(VNEXT_3D_GATES[0]?.status).toBe('accepted');
    expect(VNEXT_3D_GATES[1]).toMatchObject({ status: 'accepted', statusLabel: 'AUTHORED' });
    expect(VNEXT_3D_GATES[2]).toMatchObject({ status: 'accepted', statusLabel: 'CONTACT LOCKED' });
    expect(VNEXT_3D_GATES.at(-1)).toMatchObject({ status: 'accepted', statusLabel: 'PUBLIC' });
  });
});
