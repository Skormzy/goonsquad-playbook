import { describe, expect, it } from 'vitest';
import { resolveRoleFocus, sourceRoleForFocus } from './roleFocus';

const phase = {
  pos: {
    LW: { role: 'Left route' },
    C: { role: 'Middle route' },
    RW: { role: 'Right route' },
    LD: { role: 'Left support' },
    RD: { role: 'Right support' },
    G: { role: 'Set in the crease' },
  },
};

describe('role focus', () => {
  it('resolves all six ball hockey roles, including goalie', () => {
    expect(resolveRoleFocus(phase, 'G')).toEqual({
      role: 'G',
      roleLabel: 'Goalie',
      sourceRole: 'G',
      responsibility: phase.pos.G,
    });
  });

  it('mirrors left and right assignments without changing the selected role label', () => {
    expect(resolveRoleFocus(phase, 'LW', true)).toEqual({
      role: 'LW',
      roleLabel: 'Left Wing',
      sourceRole: 'RW',
      responsibility: phase.pos.RW,
    });
    expect(sourceRoleForFocus('RD', true)).toBe('LD');
  });

  it('falls back to center for invalid URL or caller values', () => {
    expect(resolveRoleFocus(phase, 'invalid').role).toBe('C');
  });
});
